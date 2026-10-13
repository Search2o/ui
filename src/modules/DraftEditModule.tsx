import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import { TraceType } from "@/orval/search2o.schemas";
import type {
    DraftResponseModel,
    SaveDraftNewModel,
    ValidateDraftModel,
    ValidateDraftResponseModel,
    ValidationResult,
} from "@/orval/search2o.schemas";
import { resetPagedList } from "@/shared/pagedList";
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";
import { toast } from "sonner";
import { useUnsavedWork } from "@/shared/sessionExpiry";
import { Button } from "@/components/ui/button";
import {
    CheckCircle2,
    CircleCheck,
    Loader2,
    Rocket,
    Save,
    Terminal,
    Undo2,
    XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import MonacoJsonc, { type MonacoJsoncHandle } from "@/shared/MonacoJsonc";
import { tracePathToJsonPath } from "@/shared/agentPath";
import { ValidationErrors } from "@/shared/ValidationErrors";
import { useJsonStream } from "@/shared/useJsonStream";
import { AskInputsForm, type AskBlockAnswers, type AskBlocks } from "@/shared/AskInputsForm";
import { hasAskBlocks } from "@/shared/askBlocks";
import { DraftQueryField } from "@/shared/DraftQueryField";
import { runStartedConversation } from "@/shared/draftConversation";
import { definitionHasAskCommand } from "@/shared/agentAskCommand";
import { OutputCategoryFilter } from "@/shared/OutputCategoryFilter";
import {
    DEFAULT_OUTPUT_CATEGORIES,
    OUTPUT_CATEGORY_INFO,
    type OutputCategory,
} from "@/shared/outputCategories";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { DraftAiPanel } from "@/shared/DraftAiPanel";
import { DraftAssistTabs } from "@/shared/DraftAssistTabs";
import { validationStatus } from "@/shared/validationStatus";
import { DraftUsedProfiles } from "@/shared/DraftUsedProfiles";
import { MergeDraftDialog } from "@/shared/MergeDraftDialog";
import { ReadyToPublishNotice } from "@/shared/ReadyToPublishNotice";
import { PublishedDialog } from "@/shared/PublishedDialog";
import {
    normalizeUsedProfiles,
    popAiUndo,
    pushAiUndo,
    sameUsedProfiles,
    type UsedProfiles,
} from "@/shared/draftHelpPrompt";
import { unreachable } from "@/shared/orvalFetcher";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import { AGENT_NAME, matchesRule } from "@/shared/schemaRules";
const BACK_FALLBACK = "Drafts";

function limitText(value: number | null | undefined): string {
    return value == null ? "" : String(value);
}

function parseLimits(
    timeText: string,
    costText: string,
): { maxTime: number; maxCost: number } | { error: string } {
    const time = Number(timeText.trim());
    const cost = Number(costText.trim());
    if (!timeText.trim() || !Number.isInteger(time) || time < 1) {
        return { error: uiText("validate.maxTime") };
    }
    if (!costText.trim() || !Number.isFinite(cost) || cost <= 0) {
        return { error: uiText("validate.maxCost") };
    }
    return { maxTime: time, maxCost: cost };
}

type PayloadType = {
    draftid?: string;
    create?: boolean;
};

type TraceKind = "trace" | "progress" | "data";

type TraceItem = {
    kind: TraceKind;
    traceType?: TraceType;
    node: ReactNode;
    duration?: number;
    path?: string;
    id: number;
};

function formatTraceAge(ms: number): string {
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

const SAVED_NOTICE_MS = 3000;

export default function DraftEditModule() {
    const editorHandle = useRef<MonacoJsoncHandle>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [assistMode, setAssistMode] = useState<"validate" | "ai">("ai");
    const [aiBusy, setAiBusy] = useState(false);
    const [aiUndo, setAiUndo] = useState<string[]>([]);
    const [confirmAiUndo, setConfirmAiUndo] = useState(false);
    const sawOutputRef = useRef(false);
    const [traceItems, setTraceItems] = useState<TraceItem[]>([]);
    const [shownCategories, setShownCategories] = useState<Set<OutputCategory>>(
        () => new Set(DEFAULT_OUTPUT_CATEGORIES),
    );
    const [inConversation, setInConversation] = useState(false);
    const [confirmAskPublish, setConfirmAskPublish] = useState(false);
    const [usedProfiles, setUsedProfiles] = useState<UsedProfiles>({});
    const [mergeOpen, setMergeOpen] = useState(false);
    const [followupQuery, setFollowupQuery] = useState("");
    const queryRef = useRef<HTMLDivElement>(null);
    const pinQueryRef = useRef(false);
    const errorBlockRef = useRef<HTMLDivElement>(null);

    const payload = UI.useModulePayload<PayloadType>() ?? {};
    const createdIdRef = useRef<string | null>(null);
    const draftid = payload.draftid;
    const createOnOpen = payload.create === true;

    const [loading, setLoading] = useState(true);
    const [pageState, setPageState] = useState<DraftResponseModel | null>(null);

    const [name, setName] = useState<string>("");
    const [title, setTitle] = useState<string>("");
    const titleTouchedRef = useRef(false);
    const [tag, setTag] = useState<string>("general");
    const [maxTime, setMaxTime] = useState<string>("");
    const [maxCost, setMaxCost] = useState<string>("");
    const fh = useFieldHelp("DraftResponseModel");
    const ft = useFieldTitle("DraftResponseModel");
    const [definitionText, setDefinitionText] = useState<string>("");
    const [validationQuery, setValidationQuery] = useState<string>("");

    const [validationErrors, setValidationErrors] = useState<ValidationResult[] | null>(null);
    const [runtimeError, setRuntimeError] = useState<string | null>(null);
    const [pendingNav, setPendingNav] = useState<{
        next: UI.ModuleKey;
        payload?: UI.ModulePayload;
    } | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [pendingAsk, setPendingAsk] = useState<AskBlocks | null>(null);
    const [askWithoutForm, setAskWithoutForm] = useState(false);

    const [postPublishPrompt, setPostPublishPrompt] = useState<{
        open: boolean;
        isIndexed: boolean;
    }>({
        open: false,
        isIndexed: false,
    });

    const originalRef = useRef<{
        name: string;
        title: string;
        tag: string;
        maxTime: string;
        maxCost: string;
        definitionText: string;
        validationQuery: string;
        usedProfiles: UsedProfiles;
    }>({
        name: "",
        title: "",
        tag: "general",
        maxTime: "",
        maxCost: "",
        definitionText: "",
        validationQuery: "",
        usedProfiles: {},
    });

    function addTraceElement(
        kind: TraceKind,
        content: string | ReactNode,
        traceType?: TraceType,
        meta?: { duration?: number; path?: string },
    ) {
        const toNode = (c: string | ReactNode, key: number) =>
            typeof c === "string" ? (
                <div key={key} className="font-mono text-xs whitespace-pre-wrap break-words">
                    {c}
                </div>
            ) : kind === "data" ? (
                <pre key={key} className="text-xs whitespace-pre-wrap font-mono">
                    {c}
                </pre>
            ) : (
                <div key={key} className="font-mono text-xs whitespace-pre-wrap break-words">
                    {c}
                </div>
            );

        const lines =
            typeof content === "string"
                ? kind === "data"
                    ? [toNode(content, 0)]
                    : content
                          .split(/\r?\n/)
                          .filter(Boolean)
                          .map((ln, i) => toNode(ln, i))
                : [toNode(content, 0)];

        setTraceItems((prev) => [
            ...prev,
            ...lines.map((node) => ({
                kind,
                traceType,
                node,
                duration: meta?.duration,
                path: meta?.path,
                id: crypto.getRandomValues(new Uint32Array(1))[0],
            })),
        ]);

        requestAnimationFrame(() => {
            if (pinQueryRef.current) queryRef.current?.scrollIntoView({ block: "start" });
        });
    }

    function revealTracePath(path: string) {
        const jsonPath = tracePathToJsonPath(path, definitionText);
        if (!jsonPath || !editorHandle.current?.revealJsonPath(jsonPath)) {
            toast.info(`${path} is not in the definition any more.`);
        }
    }

    const fetchDraft = useCallback(async () => {
        let id = draftid ?? createdIdRef.current;
        setLoading(true);
        if (!id && createOnOpen) {
            try {
                const made = await API.createNewDraft({});
                id = made.success ? made.draftid || made.draft?.draftid || null : null;
                if (!id) {
                    toast.error(made.error?.message ?? "Failed to create new draft");
                    setLoading(false);
                    UI.goBack("Drafts");
                    return;
                }
            } catch (e) {
                toast.error(errorText(e, "Failed to create new draft"));
                setLoading(false);
                UI.goBack("Drafts");
                return;
            }
            createdIdRef.current = id;
            resetPagedList("drafts");
        }
        if (!id) {
            toast.warning("Missing draftid for draft");
            setLoading(false);
            return;
        }
        try {
            const resp = await API.getDraft({ draftid: id });
            if (!resp?.success) {
                toast.warning(resp?.error?.message || "Failed to load draft");
                setPageState(null);
            } else {
                setPageState(resp);
                const loadedName = resp.draftName ?? (resp.isNewDraft ? "" : resp.draftid);
                setName(loadedName);
                setTitle(resp.agentTitle ?? "");
                titleTouchedRef.current = Boolean(resp.agentTitle);
                setTag(resp.agentTag ?? "");
                setMaxTime(limitText(resp.maxTime));
                setMaxCost(limitText(resp.maxCost));
                const defText =
                    typeof resp.agentDefinition === "string"
                        ? resp.agentDefinition
                        : JSON.stringify(resp.agentDefinition ?? {}, null, 2);
                setDefinitionText(defText);
                setValidationQuery(resp.validationQuery ?? "");
                const loadedProfiles = normalizeUsedProfiles(resp.usedProfiles);
                setUsedProfiles(loadedProfiles);
                originalRef.current = {
                    name: loadedName,
                    title: resp.agentTitle ?? "",
                    tag: resp.agentTag ?? "",
                    maxTime: limitText(resp.maxTime),
                    maxCost: limitText(resp.maxCost),
                    definitionText: defText,
                    validationQuery: resp.validationQuery ?? "",
                    usedProfiles: loadedProfiles,
                };
            }
        } catch (e) {
            toast.warning(errorText(e, "Failed to load the draft."));
            setPageState(null);
        } finally {
            setLoading(false);
        }
    }, [draftid, createOnOpen]);

    useEffect(() => {
        fetchDraft();
    }, [fetchDraft]);

    const dirtyName =
        Boolean(pageState?.isNewDraft) &&
        name.trim() !== "" &&
        name.trim() !== originalRef.current.name;
    const dirtyTitle = title !== originalRef.current.title;
    const dirtyTag = tag !== originalRef.current.tag;
    const dirtyLimits =
        maxTime.trim() !== originalRef.current.maxTime ||
        maxCost.trim() !== originalRef.current.maxCost;
    const dirtyDefinition = definitionText !== originalRef.current.definitionText;
    const dirtyValidationQuery = validationQuery !== originalRef.current.validationQuery;
    const dirtyUsedProfiles = !sameUsedProfiles(usedProfiles, originalRef.current.usedProfiles);

    const valuesRef = useRef({
        name,
        title,
        tag,
        definitionText,
        validationQuery,
        usedProfiles,
        isNewDraft: false,
    });
    valuesRef.current = {
        name,
        title,
        tag,
        definitionText,
        validationQuery,
        usedProfiles,
        isNewDraft: Boolean(pageState?.isNewDraft),
    };

    const computeDirtyNow = useCallback(() => {
        const v = valuesRef.current;
        const o = originalRef.current;
        return (
            (v.isNewDraft && v.name.trim() !== "" && v.name.trim() !== o.name) ||
            v.title !== o.title ||
            v.tag !== o.tag ||
            v.definitionText !== o.definitionText ||
            v.validationQuery !== o.validationQuery ||
            !sameUsedProfiles(v.usedProfiles, o.usedProfiles)
        );
    }, []);

    const saveDefinition = useCallback(
        async (text: string): Promise<boolean> => {
            if (!pageState) return false;
            try {
                const body: Pick<SaveDraftNewModel, "draftid" | "agentDefinition"> = {
                    draftid: pageState.draftid,
                    agentDefinition: text,
                };
                const resp = pageState.isNewDraft
                    ? await API.saveDraftNew(body)
                    : await API.saveDraftAgent(body);
                if (!resp?.success) {
                    toast.warning(resp?.error?.message || "Failed to save draft");
                    return false;
                }
                originalRef.current = { ...originalRef.current, definitionText: text };
                resetPagedList("drafts");
                setSavedAt(Date.now());
                setPageState((prev) =>
                    prev
                        ? {
                              ...prev,
                              agentDefinition: text,
                              draftCompilationValidated: false,
                              draftExecutionValidated: false,
                          }
                        : prev,
                );
                return true;
            } catch (e) {
                toast.warning(errorText(e, "Failed to save the draft."));
                return false;
            }
        },
        [pageState],
    );

    const onMerged = useCallback((merged: string) => {
        setDefinitionText(merged);
        originalRef.current = { ...originalRef.current, definitionText: merged };
        setAiUndo([]);
        resetPagedList("drafts");
        setSavedAt(Date.now());
        setPageState((prev) =>
            prev
                ? {
                      ...prev,
                      agentDefinition: merged,
                      draftAgentHasChanged: false,
                      draftCompilationValidated: false,
                      draftExecutionValidated: false,
                  }
                : prev,
        );
        toast.success(uiText("draft.mergedValidateAgain"));
    }, []);

    const onAiReplace = useCallback(
        (next: string) => {
            setAiUndo((stack) => pushAiUndo(stack, definitionText));
            setDefinitionText(next);
            void saveDefinition(next);
        },
        [definitionText, saveDefinition],
    );

    const undoAiEdit = useCallback(async () => {
        const { previous, stack } = popAiUndo(aiUndo);
        if (previous === null) return;
        setAiUndo(stack);
        setDefinitionText(previous);
        await saveDefinition(previous);
    }, [aiUndo, saveDefinition]);

    const saveChanges = useCallback(async () => {
        if (!pageState) return;
        if (!(
            dirtyName ||
            dirtyTitle ||
            dirtyTag ||
            dirtyLimits ||
            dirtyDefinition ||
            dirtyValidationQuery ||
            dirtyUsedProfiles
        )) {
            return { success: true };
        }
        try {
            const newName = name.trim();
            const limits = dirtyLimits ? parseLimits(maxTime, maxCost) : null;
            if (limits && "error" in limits) {
                toast.error(limits.error);
                return { success: false };
            }
            if (dirtyName) {
                if (!matchesRule(AGENT_NAME, newName)) {
                    toast.error(uiText("validate.agentName"));
                    return { success: false };
                }
            }

            const resp = pageState.isNewDraft
                ? await API.saveDraftNew({
                      draftid: pageState.draftid,
                      ...(dirtyName ? { draftName: newName } : {}),
                      ...(dirtyTitle ? { agentTitle: title } : {}),
                      ...(dirtyTag ? { agentTag: tag } : {}),
                      ...(limits ?? {}),
                      ...(dirtyDefinition ? { agentDefinition: definitionText } : {}),
                      ...(dirtyValidationQuery ? { validationQuery } : {}),
                      ...(dirtyUsedProfiles ? { usedProfiles } : {}),
                  })
                : await API.saveDraftAgent({
                      draftid: pageState.draftid,
                      ...(dirtyTitle ? { agentTitle: title } : {}),
                      ...(limits ?? {}),
                      ...(dirtyDefinition ? { agentDefinition: definitionText } : {}),
                      ...(dirtyValidationQuery ? { validationQuery } : {}),
                      ...(dirtyUsedProfiles ? { usedProfiles } : {}),
                  });

            if (!resp?.success) {
                toast.warning(resp?.error?.message || "Failed to save draft");
                return { success: false };
            }

            originalRef.current = {
                name: dirtyName ? newName : originalRef.current.name,
                title,
                tag,
                maxTime: limits ? String(limits.maxTime) : originalRef.current.maxTime,
                maxCost: limits ? String(limits.maxCost) : originalRef.current.maxCost,
                definitionText,
                validationQuery,
                usedProfiles,
            };

            if (dirtyDefinition) setAiUndo([]);

            resetPagedList("drafts");
            setSavedAt(Date.now());

            setPageState((prev) =>
                prev
                    ? {
                          ...prev,
                          ...(dirtyName ? { draftName: newName } : {}),
                          agentTitle: title,
                          agentTag: tag,
                          agentDefinition: definitionText,
                          validationQuery,
                          draftCompilationValidated: false,
                          draftExecutionValidated: false,
                      }
                    : prev,
            );

            return { success: true };
        } catch (e) {
            toast.warning(errorText(e, "Failed to save the draft."));
            return { success: false };
        }
    }, [
        pageState,
        name,
        title,
        tag,
        definitionText,
        validationQuery,
        dirtyName,
        dirtyTitle,
        dirtyTag,
        dirtyLimits,
        maxTime,
        maxCost,
        dirtyDefinition,
        dirtyValidationQuery,
        dirtyUsedProfiles,
        usedProfiles,
    ]);

    const saveBeforeAi = useCallback(
        async () => (await saveChanges())?.success === true,
        [saveChanges],
    );

    const guardRef = useRef<UI.NavigationGuard | null>(null);
    useEffect(() => {
        const guard: UI.NavigationGuard = (next, navPayload) => {
            if (!computeDirtyNow()) return true;
            setPendingNav({ next, payload: navPayload });
            return false;
        };
        guardRef.current = guard;
        UI.setNavigationGuard(guard);
        return () => UI.clearNavigationGuard(guard);
    }, [computeDirtyNow]);

    useUnsavedWork(computeDirtyNow);

    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!computeDirtyNow()) return;
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [computeDirtyNow]);

    const stayHere = useCallback(() => setPendingNav(null), []);

    const discardAndLeave = useCallback(() => {
        if (!pendingNav) return;
        if (guardRef.current) UI.clearNavigationGuard(guardRef.current);
        setPendingNav(null);
        UI.openModule(pendingNav.next, pendingNav.payload);
    }, [pendingNav]);

    const saveAndLeave = useCallback(async () => {
        if (!pendingNav) return;
        const result = await saveChanges();
        if (!result?.success) return;
        setPendingNav(null);
        UI.openModule(pendingNav.next, pendingNav.payload);
    }, [pendingNav, saveChanges]);

    const { start, cancel } = useJsonStream<ValidateDraftResponseModel>();

    const onValidate = useCallback(
        async (answers?: AskBlockAnswers) => {
            if (!pageState) return;
            if (!answers) {
                if (inConversation && !followupQuery.trim()) {
                    toast.error("Type a follow-up question, or start a new conversation.");
                    return;
                }
                if (!inConversation && !validationQuery.trim()) {
                    toast.error("Please provide a validation query");
                    return;
                }
            }

            const saved = await saveChanges();
            if (!saved?.success) return;

            if (!answers) {
                sawOutputRef.current = false;
                setTraceItems([]);
                setValidationErrors([]);
                setRuntimeError("");
            }
            const isFollowup = inConversation || !!answers;

            if (!answers) setPendingAsk(null);
            setAskWithoutForm(false);
            setIsValidating(true);
            pinQueryRef.current = true;
            queryRef.current?.scrollIntoView({ block: "start" });
            try {
                start({
                    url: API.getValidateDraftStreamUrl(),
                    body: {
                        draftid: pageState.draftid,
                        inputs: answers ?? (isFollowup ? { query: followupQuery.trim() } : {}),
                        stream: true,
                        followup: isFollowup,
                    } satisfies ValidateDraftModel,
                    onMessage: (m) => {
                        if (m.type === "progress") {
                            addTraceElement("progress", m.value);
                        } else if (m.type === "trace") {
                            addTraceElement(
                                "trace",
                                <span className="whitespace-pre-wrap break-words">
                                    {m.value.message}
                                </span>,
                                m.traceType ?? TraceType.flow,
                                { duration: m.value.duration, path: m.value.path || undefined },
                            );
                        } else if (m.type === "data") {
                            sawOutputRef.current = true;
                            addTraceElement("data", JSON.stringify(m.value, null, 2));
                        } else if (m.type === "draft") {
                            const resp = m.value;
                            if (!resp?.success) {
                                setIsValidating(false);
                                if (resp?.resultCode === "unknownConversation") {
                                    setPendingAsk(null);
                                    setInConversation(false);
                                }
                                setRuntimeError(
                                    resp?.error?.message || "The validation run failed.",
                                );
                                setPageState((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              draftCompilationValidated: false,
                                              draftExecutionValidated: false,
                                          }
                                        : prev,
                                );
                                return;
                            }

                            setInConversation(runStartedConversation(resp));
                            setFollowupQuery("");

                            if (resp.resultCode === "ask") {
                                setIsValidating(false);
                                const blocks = hasAskBlocks(resp.askInput) ? resp.askInput : null;
                                setAskWithoutForm(!blocks);
                                setPendingAsk(blocks);
                                return;
                            }

                            setIsValidating(false);
                            setPendingAsk(null);
                            setAskWithoutForm(false);

                            if (resp.validationSuccess) {
                                setPageState((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              draftCompilationValidated: true,
                                              draftExecutionValidated: true,
                                          }
                                        : prev,
                                );
                                setValidationErrors(null);
                                setRuntimeError(null);
                                if (!sawOutputRef.current) {
                                    addTraceElement("data", uiText("run.noOutput"));
                                }
                            } else {
                                setPageState((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              draftCompilationValidated: false,
                                              draftExecutionValidated: false,
                                          }
                                        : prev,
                                );
                                setValidationErrors(
                                    resp.validationErrors?.length ? resp.validationErrors : null,
                                );
                                setRuntimeError(resp.runtimeError || null);
                            }
                        }
                    },
                    onError: (err) => {
                        setRuntimeError(errorText(err, unreachable()));
                    },
                    onClose: ({ cancelled }) => {
                        pinQueryRef.current = false;
                        setIsValidating(false);
                        if (cancelled) {
                            toast.info(uiText("draft.runCancelled"));
                        }
                    },
                });
            } catch (e) {
                setIsValidating(false);
                toast.warning(errorText(e, "Failed to validate the draft."));
            }
        },
        [pageState, validationQuery, followupQuery, saveChanges, start, inConversation],
    );

    const publishNow = useCallback(async () => {
        if (!pageState) return;

        if (
            dirtyTitle ||
            dirtyTag ||
            dirtyLimits ||
            dirtyDefinition ||
            dirtyValidationQuery ||
            dirtyUsedProfiles
        ) {
            const saved = await saveChanges();
            if (!saved?.success) return;
        }

        try {
            const resp = await API.publishDraft({ draftid: pageState.draftid });
            if (!resp?.success) {
                try {
                    const check = await API.getDraft({ draftid: pageState.draftid });
                    if (check?.success && check.draftAgentHasChanged) {
                        setPageState((prev) =>
                            prev ? { ...prev, draftAgentHasChanged: true } : prev,
                        );
                        setMergeOpen(true);
                        return;
                    }
                } catch {}
                toast.warning(resp?.error?.message || "Failed to publish draft");
                await fetchDraft();
                return;
            }

            resetPagedList("drafts");
            setSavedAt(Date.now());
            resetPagedList("agents");

            setPostPublishPrompt({ open: true, isIndexed: resp.isIndexed === true });
        } catch (e) {
            toast.warning(errorText(e, "Failed to publish the draft."));
        }
    }, [
        pageState,
        dirtyTitle,
        dirtyTag,
        dirtyLimits,
        dirtyDefinition,
        dirtyValidationQuery,
        dirtyUsedProfiles,
        saveChanges,
        fetchDraft,
    ]);

    const onPublish = useCallback(async () => {
        if (!pageState) return;

        if (pageState.isNewDraft) {
            await publishNow();
            return;
        }

        try {
            const live = await API.getAgent({ agentName: pageState.draftid });
            if (live.success && definitionHasAskCommand(live.agentDefinition)) {
                setConfirmAskPublish(true);
                return;
            }
        } catch {}

        await publishNow();
    }, [pageState, publishNow]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const pressedS = e.key?.toLowerCase?.() === "s";
            if (pressedS && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void saveChanges();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [saveChanges]);

    const disableSave = useMemo(
        () =>
            !(
                dirtyName ||
                dirtyTitle ||
                dirtyTag ||
                dirtyLimits ||
                dirtyDefinition ||
                dirtyValidationQuery ||
                dirtyUsedProfiles
            ),
        [
            dirtyName,
            dirtyTitle,
            dirtyTag,
            dirtyLimits,
            dirtyDefinition,
            dirtyValidationQuery,
            dirtyUsedProfiles,
        ],
    );
    useEffect(() => {
        if (!disableSave) setSavedAt(null);
    }, [disableSave]);

    useEffect(() => {
        if (savedAt === null) return;
        const timer = window.setTimeout(() => setSavedAt(null), SAVED_NOTICE_MS);
        return () => window.clearTimeout(timer);
    }, [savedAt]);

    const disableValidate = isValidating || aiBusy;
    const draftValidated = Boolean(
        pageState?.draftCompilationValidated && pageState?.draftExecutionValidated,
    );

    const disablePublish =
        !draftValidated ||
        !title?.trim() ||
        (Boolean(pageState?.isNewDraft) && !(pageState?.draftName || name.trim()));

    const categoryOf = (item: TraceItem): OutputCategory =>
        item.traceType ?? (item.kind === "progress" ? "progress" : "data");

    const categoryCounts = useMemo(() => {
        const counts: Partial<Record<OutputCategory, number>> = {};
        for (const item of traceItems) {
            const key = categoryOf(item);
            counts[key] = (counts[key] ?? 0) + 1;
        }
        return counts;
    }, [traceItems]);

    const visibleTraceItems = useMemo(
        () => traceItems.filter((item) => shownCategories.has(categoryOf(item))),
        [traceItems, shownCategories],
    );

    const hiddenTraceCount = traceItems.length - visibleTraceItems.length;

    const toggleCategory = useCallback((category: OutputCategory) => {
        setShownCategories((prev) => {
            const next = new Set(prev);
            if (next.has(category)) next.delete(category);
            else next.add(category);
            return next;
        });
    }, []);

    const showAllCategories = useCallback(
        () => setShownCategories(new Set(DEFAULT_OUTPUT_CATEGORIES)),
        [],
    );

    const hideAllCategories = useCallback(() => setShownCategories(new Set()), []);

    const hasValidationOutput =
        traceItems.length > 0 || !!runtimeError || !!validationErrors?.length;
    const runHasOutput =
        hasValidationOutput || isValidating || askWithoutForm || Boolean(pendingAsk);

    const clearValidationOutput = () => {
        setTraceItems([]);
        setRuntimeError(null);
        setValidationErrors(null);
    };

    useEffect(() => {
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
            const target = e.target as HTMLElement | null;
            if (target?.closest?.(".monaco-editor")) return;
            if (target?.closest?.("[data-ai-assist]")) return;
            e.preventDefault();
            if (!disableValidate) void onValidate();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [disableValidate, onValidate]);

    useEffect(() => {
        const release = () => {
            pinQueryRef.current = false;
        };
        window.addEventListener("wheel", release, { passive: true });
        window.addEventListener("touchmove", release, { passive: true });
        return () => {
            window.removeEventListener("wheel", release);
            window.removeEventListener("touchmove", release);
        };
    }, []);

    useEffect(() => {
        if (!runtimeError && !validationErrors?.length) return;
        const t = window.setTimeout(() => {
            errorBlockRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 200);
        return () => window.clearTimeout(t);
    }, [runtimeError, validationErrors]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading draft…
            </div>
        );
    }

    if (!pageState) {
        return (
            <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                Unable to load draft.
            </div>
        );
    }

    const draftAgentName = pageState.draftName || (pageState.isNewDraft ? "" : pageState.draftid);
    const draftHeading = draftAgentName ? `Draft - ${draftAgentName}` : "Draft";

    return (
        <>
            <Card className="shadow-sm">
                <CardHeader className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <div className="min-w-0 space-y-1">
                        <ModuleCardTitle title={draftHeading} help="draft-edit" />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={saveChanges}
                            disabled={disableSave}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onPublish}
                            disabled={disablePublish}
                        >
                            <Rocket className="mr-2 h-4 w-4" />
                            Publish
                        </Button>

                        <BackButton fallback={BACK_FALLBACK} label="Back" />
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="flex max-w-4xl flex-col gap-4 sm:flex-row">
                        <div className="sm:w-52">
                            <HoverTip
                                tip={pageState?.isNewDraft ? undefined : uiText("agent.nameLocked")}
                            >
                                <Label htmlFor="agent-name" className="text-sm">
                                    Agent name
                                </Label>
                            </HoverTip>
                            <Input
                                id="agent-name"
                                className="mt-1"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (!titleTouchedRef.current) setTitle(e.target.value);
                                }}
                                disabled={!pageState?.isNewDraft}
                                spellCheck={false}
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <Label htmlFor="title" className="text-sm">
                                Title
                            </Label>
                            <Input
                                id="title"
                                className="mt-1"
                                value={title}
                                onChange={(e) => {
                                    titleTouchedRef.current = true;
                                    setTitle(e.target.value);
                                }}
                                placeholder={uiText("placeholder.draftTitle")}
                            />
                        </div>
                        <div className="sm:w-40">
                            <HoverTip
                                tip={pageState?.isNewDraft ? undefined : uiText("agent.tagLocked")}
                            >
                                <Label htmlFor="tag" className="text-sm">
                                    Agent tag
                                </Label>
                            </HoverTip>
                            <Input
                                id="tag"
                                className="mt-1"
                                value={tag}
                                onChange={(e) => setTag(e.target.value)}
                                placeholder="general"
                                disabled={!pageState?.isNewDraft}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="sm:min-w-36">
                            <FieldLabel
                                help={fh("maxTime")}
                                htmlFor="maxTime"
                                className="whitespace-nowrap"
                            >
                                {ft("maxTime", "Max run time (seconds)")}
                            </FieldLabel>
                            <Input
                                id="maxTime"
                                className="mt-1 tabular-nums"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                step={1}
                                value={maxTime}
                                onChange={(e) => setMaxTime(e.target.value)}
                            />
                        </div>
                        <div className="sm:min-w-36">
                            <FieldLabel
                                help={fh("maxCost")}
                                htmlFor="maxCost"
                                className="whitespace-nowrap"
                            >
                                {ft("maxCost", "Max LLM cost per run (US dollars)")}
                            </FieldLabel>
                            <Input
                                id="maxCost"
                                className="mt-1 tabular-nums"
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="any"
                                value={maxCost}
                                onChange={(e) => setMaxCost(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Label className="text-sm">Agent definition</Label>
                                {savedAt !== null ? (
                                    <span
                                        role="status"
                                        className="animate-in fade-in inline-flex items-center gap-1.5 text-xs text-muted-foreground duration-200"
                                    >
                                        <CircleCheck
                                            className="h-3.5 w-3.5 text-primary"
                                            aria-hidden
                                        />
                                        Saved
                                    </span>
                                ) : null}
                            </div>
                            {aiUndo.length > 0 ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() =>
                                        dirtyDefinition ? setConfirmAiUndo(true) : void undoAiEdit()
                                    }
                                >
                                    <Undo2 className="h-3.5 w-3.5" aria-hidden />
                                    Undo AI edit
                                    <span className="text-muted-foreground">({aiUndo.length})</span>
                                </Button>
                            ) : null}
                        </div>
                        <MonacoJsonc
                            ref={editorHandle}
                            value={definitionText}
                            onChange={(v: string) => setDefinitionText(v ?? "")}
                            readOnly={false}
                        />
                    </div>

                    <div className="overflow-hidden rounded-2xl border bg-surface">
                        <DraftAssistTabs
                            mode={assistMode}
                            onModeChange={setAssistMode}
                            aiBusy={aiBusy}
                            validation={validationStatus({
                                running: isValidating,
                                failed: Boolean(runtimeError || validationErrors?.length),
                                validated: draftValidated,
                            })}
                        />
                        <div
                            id="draft-panel-validate"
                            role="tabpanel"
                            aria-labelledby="draft-tab-validate"
                            hidden={assistMode !== "validate"}
                        >
                            <div ref={queryRef} className="flex items-end gap-2 p-4 scroll-mt-16">
                                <div className="min-w-0 flex-1">
                                    <DraftQueryField
                                        inConversation={inConversation}
                                        validationQuery={validationQuery}
                                        followupQuery={followupQuery}
                                        disabled={isValidating}
                                        onValidationQueryChange={setValidationQuery}
                                        onFollowupQueryChange={setFollowupQuery}
                                        onStartOver={() => {
                                            setInConversation(false);
                                            setFollowupQuery("");
                                        }}
                                    />
                                </div>
                                <HoverTip tip="Ctrl+Enter / ⌘⏎">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void onValidate()}
                                        disabled={disableValidate}
                                    >
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Validate/Trace
                                    </Button>
                                </HoverTip>
                            </div>

                            {!disablePublish && disableSave && !isValidating && !aiBusy ? (
                                <ReadyToPublishNotice onPublish={() => void onPublish()} />
                            ) : null}

                            {runHasOutput ? (
                                <div className="divide-y border-t">
                                    {askWithoutForm ? (
                                        <div className="bg-amber-500/10 px-4 py-3 text-sm">
                                            This agent paused to ask the user for input, so the
                                            validation run stopped there — it has not failed. The
                                            response carried no form, so the answers cannot be
                                            supplied from here; run the published agent, or
                                            re-validate once the server returns the question.
                                        </div>
                                    ) : null}

                                    {pendingAsk ? (
                                        <div className="p-4">
                                            <AskInputsForm
                                                askInput={pendingAsk}
                                                agentName={pageState?.draftName ?? null}
                                                disabled={isValidating}
                                                onSubmit={(answers) => void onValidate(answers)}
                                            />
                                        </div>
                                    ) : null}

                                    {validationErrors?.length || runtimeError ? (
                                        <div
                                            ref={errorBlockRef}
                                            className="space-y-3 bg-destructive/5 p-4"
                                        >
                                            {validationErrors?.length ? (
                                                <ValidationErrors
                                                    errors={validationErrors}
                                                    onOpenPath={revealTracePath}
                                                    onOpenAllowlist={() =>
                                                        UI.openModule("AllowlistConfig")
                                                    }
                                                />
                                            ) : null}
                                            {runtimeError ? (
                                                <div>
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        Runtime error
                                                    </div>
                                                    <div className="mt-1.5 break-words text-sm text-destructive">
                                                        {runtimeError}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {hasValidationOutput || isValidating ? (
                                        <div>
                                            <div className="flex h-9 items-center gap-2 border-b bg-muted/40 px-3">
                                                <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-xs font-medium">
                                                    Validation output
                                                </span>
                                                {traceItems.length > 0 ? (
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {visibleTraceItems.length}{" "}
                                                        {visibleTraceItems.length === 1
                                                            ? "event"
                                                            : "events"}
                                                        {hiddenTraceCount > 0 ? (
                                                            <span className="opacity-70">
                                                                {" "}
                                                                · {hiddenTraceCount} hidden
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                ) : null}
                                                <span className="flex-1" />
                                                {isValidating ? (
                                                    <div className="inline-flex items-center gap-2 rounded-md border bg-muted/40 py-1.5 pl-3 pr-1 text-xs text-muted-foreground shadow-sm">
                                                        <span
                                                            className="inline-flex gap-1"
                                                            aria-hidden="true"
                                                        >
                                                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-pulse" />
                                                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-pulse [animation-delay:150ms]" />
                                                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-pulse [animation-delay:300ms]" />
                                                        </span>
                                                        <span>Validating</span>
                                                        <button
                                                            type="button"
                                                            onClick={cancel}
                                                            className="rounded px-2 py-0.5 font-medium text-destructive transition-colors hover:bg-destructive/10"
                                                        >
                                                            Stop
                                                        </button>
                                                    </div>
                                                ) : null}
                                                {!isValidating && hasValidationOutput ? (
                                                    <button
                                                        type="button"
                                                        onClick={clearValidationOutput}
                                                        className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                                                    >
                                                        Clear
                                                    </button>
                                                ) : null}
                                            </div>
                                            {traceItems.length > 0 ? (
                                                <div className="border-b bg-muted/20 px-3 py-2">
                                                    <OutputCategoryFilter
                                                        selected={shownCategories}
                                                        counts={categoryCounts}
                                                        onToggle={toggleCategory}
                                                        onShowAll={showAllCategories}
                                                        onHideAll={hideAllCategories}
                                                    />
                                                </div>
                                            ) : null}

                                            <div className="space-y-1.5 p-3">
                                                {traceItems.length ===
                                                0 ? null : visibleTraceItems.length === 0 ? (
                                                    <div className="py-8 text-center text-xs text-muted-foreground">
                                                        Every category is hidden.{" "}
                                                        {traceItems.length}{" "}
                                                        {traceItems.length === 1
                                                            ? "event is"
                                                            : "events are"}{" "}
                                                        still here — tick a category above, or use
                                                        “Show all”.
                                                    </div>
                                                ) : (
                                                    visibleTraceItems.map((item) => {
                                                        const { label, tone, Icon } =
                                                            OUTPUT_CATEGORY_INFO[categoryOf(item)];

                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-start gap-2 text-sm"
                                                            >
                                                                <HoverTip tip={label}>
                                                                    <span
                                                                        className={
                                                                            "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] " +
                                                                            tone
                                                                        }
                                                                    >
                                                                        <Icon className="h-3 w-3" />
                                                                    </span>
                                                                </HoverTip>

                                                                <span className="mt-0.5 w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                                                                    {item.duration != null
                                                                        ? formatTraceAge(
                                                                              item.duration,
                                                                          )
                                                                        : ""}
                                                                </span>

                                                                <div className="min-w-0 flex-1">
                                                                    {item.node}
                                                                </div>

                                                                {item.path ? (
                                                                    <HoverTip
                                                                        tip={`${item.path} — click to show it in the definition`}
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                revealTracePath(
                                                                                    item.path!,
                                                                                )
                                                                            }
                                                                            className="mt-0.5 hidden max-w-[14rem] shrink-0 truncate rounded font-mono text-[11px] text-muted-foreground/80 underline-offset-2 transition-colors hover:text-foreground hover:underline md:block"
                                                                        >
                                                                            {item.path}
                                                                        </button>
                                                                    </HoverTip>
                                                                ) : null}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>

                        <div
                            id="draft-panel-ai"
                            role="tabpanel"
                            aria-labelledby="draft-tab-ai"
                            hidden={assistMode !== "ai"}
                        >
                            <DraftAiPanel
                                draftid={pageState.draftid}
                                onBeforeSend={saveBeforeAi}
                                onBusyChange={setAiBusy}
                                onReplace={onAiReplace}
                                profiles={
                                    <DraftUsedProfiles
                                        value={usedProfiles}
                                        onChange={setUsedProfiles}
                                        disabled={aiBusy}
                                    />
                                }
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <MergeDraftDialog
                open={mergeOpen}
                onOpenChange={setMergeOpen}
                draftid={pageState.draftid}
                agentName={draftAgentName}
                onMerged={onMerged}
            />

            <AlertDialog open={confirmAiUndo} onOpenChange={setConfirmAiUndo}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Undo the last AI edit?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Your unsaved changes to the definition will be discarded, and the draft
                            will be saved as it was before that edit.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep my changes</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setConfirmAiUndo(false);
                                void undoAiEdit();
                            }}
                        >
                            Undo
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={confirmAskPublish}
                onOpenChange={(open) => {
                    if (!open) setConfirmAskPublish(false);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Publishing will break questions people are answering
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            The published version of this agent can pause to ask the user a
                            question. Anyone — not just you — whose conversation is waiting on one
                            of those questions will not be able to answer it once this version
                            replaces it; their run cannot be resumed and the question is lost. They
                            can start the conversation again afterwards.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Don’t publish</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setConfirmAskPublish(false);
                                void publishNow();
                            }}
                        >
                            Publish anyway
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={pendingNav !== null}
                onOpenChange={(open) => {
                    if (!open) stayHere();
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
                        <AlertDialogDescription>
                            This draft has unsaved changes. Save them before leaving, or discard
                            them?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <Button variant="outline" onClick={discardAndLeave}>
                            Discard changes
                        </Button>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                void saveAndLeave();
                            }}
                        >
                            Save and leave
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <PublishedDialog
                open={postPublishPrompt.open}
                isIndexed={postPublishPrompt.isIndexed}
                onIndex={() => {
                    setPostPublishPrompt({ open: false, isIndexed: false });
                    UI.openModule("AgentView", {
                        agentName: pageState?.draftName || pageState?.draftid,
                    });
                }}
                onLater={() => {
                    setPostPublishPrompt({ open: false, isIndexed: false });
                    UI.goBack(BACK_FALLBACK);
                }}
            />
        </>
    );
}
