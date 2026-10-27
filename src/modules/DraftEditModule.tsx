import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CircleCheck, Loader2, Plus, Undo2 } from "lucide-react";
import * as API from "@/orval/search2o";
import type { DraftResponseModel, SaveDraftNewModel } from "@/orval/search2o.schemas";
import { Button } from "@/components/ui/button";
import { resetPagedList } from "@/shared/pagedList";
import * as UI from "@/shared/uistate";
import { useUnsavedWork } from "@/shared/sessionExpiry";
import { HoverTip } from "@/shared/HoverTip";
import MonacoJsonc, { type MonacoJsoncHandle } from "@/shared/MonacoJsonc";
import { tracePathToJsonPath } from "@/shared/agentPath";
import { definitionHasAskCommand } from "@/shared/agentAskCommand";
import { DraftAiPanel } from "@/shared/DraftAiPanel";
import { validationStatus } from "@/shared/validationStatus";
import { ValidationBadge } from "@/shared/ValidationBadge";
import { PaneTabs, TabCount } from "@/shared/PaneTabs";
import { DraftUsedProfiles } from "@/shared/DraftUsedProfiles";
import { MergeDraftDialog } from "@/shared/MergeDraftDialog";
import { PublishedDialog } from "@/shared/PublishedDialog";
import { DraftHead } from "@/shared/DraftHead";
import { DraftRunPanel } from "@/shared/DraftRunPanel";
import { DraftUnavailable } from "@/shared/DraftUnavailable";
import {
    AskPublishDialog,
    MetaChangedDialog,
    UndoAiEditDialog,
    UnsavedChangesDialog,
} from "@/shared/DraftEditDialogs";
import { useDraftValidation } from "@/shared/useDraftValidation";
import { type AgentPart, limitText, parseLimits } from "@/shared/draftEdit";
import {
    normalizeUsedProfiles,
    popAiUndo,
    pushAiUndo,
    sameUsedProfiles,
    type UsedProfiles,
} from "@/shared/draftHelpPrompt";
import {
    promptErrorTarget,
    promptMap,
    promptRows,
    promptRowsError,
    samePrompts,
    type PromptRow,
} from "@/shared/agentPrompts";
import { DraftPrompts, type DraftPromptsHandle } from "@/shared/DraftPrompts";
import { constKeys, constPayload, constText, sameConst } from "@/shared/agentConst";
import { ConstError, DraftConst } from "@/shared/ConstFields";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import { useFieldTitle } from "@/shared/fieldHelp";
import { AGENT_NAME, matchesRule } from "@/shared/schemaRules";
import { useMediaQuery } from "@/shared/useMediaQuery";

const BACK_FALLBACK = "Drafts";

type PayloadType = {
    draftid?: string;
    create?: boolean;
};

const SAVED_NOTICE_MS = 3000;

export default function DraftEditModule() {
    const editorHandle = useRef<MonacoJsoncHandle>(null);
    const [savedAt, setSavedAt] = useState<number | null>(null);
    const [agentTab, setAgentTab] = useState<AgentPart>("definition");
    const [editorToolsEl, setEditorToolsEl] = useState<HTMLElement | null>(null);
    const toolsInTabRow = useMediaQuery("(min-width: 640px)");
    const runRef = useRef<HTMLDivElement>(null);
    const [aiBusy, setAiBusy] = useState(false);
    const [aiUndo, setAiUndo] = useState<string[]>([]);
    const [confirmAiUndo, setConfirmAiUndo] = useState(false);
    const [confirmAskPublish, setConfirmAskPublish] = useState(false);
    const [metaChanged, setMetaChanged] = useState<string[] | null>(null);
    const [usedProfiles, setUsedProfiles] = useState<UsedProfiles>({});
    const [prompts, setPrompts] = useState<PromptRow[]>([]);
    const promptsHandle = useRef<DraftPromptsHandle>(null);
    const [agentConst, setAgentConst] = useState("");
    const [constError, setConstError] = useState("");
    const [mergeOpen, setMergeOpen] = useState(false);

    const payload = UI.useModulePayload<PayloadType>() ?? {};
    const createdIdRef = useRef<string | null>(null);
    const draftid = payload.draftid;
    const createOnOpen = payload.create === true;

    const [loading, setLoading] = useState(true);
    const [pageState, setPageState] = useState<DraftResponseModel | null>(null);
    const [loadFailure, setLoadFailure] = useState<{ draftid?: string; reason: string } | null>(
        null,
    );

    const [name, setName] = useState<string>("");
    const [title, setTitle] = useState<string>("");
    const titleTouchedRef = useRef(false);
    const [tag, setTag] = useState<string>("general");
    const [maxTime, setMaxTime] = useState<string>("");
    const [maxCost, setMaxCost] = useState<string>("");
    const ft = useFieldTitle("DraftResponseModel");
    const [definitionText, setDefinitionText] = useState<string>("");
    const [validationQuery, setValidationQuery] = useState<string>("");

    const [pendingNav, setPendingNav] = useState<{
        next: UI.ModuleKey;
        payload?: UI.ModulePayload;
    } | null>(null);

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
        prompts: PromptRow[];
        agentConst: string;
    }>({
        name: "",
        title: "",
        tag: "general",
        maxTime: "",
        maxCost: "",
        definitionText: "",
        validationQuery: "",
        usedProfiles: {},
        prompts: [],
        agentConst: "",
    });

    function revealTracePath(path: string) {
        setAgentTab("definition");
        requestAnimationFrame(() => {
            const jsonPath = tracePathToJsonPath(path, definitionText);
            if (!jsonPath || !editorHandle.current?.revealJsonPath(jsonPath)) {
                toast.info(`${path} is not in the definition any more.`);
            }
        });
    }

    function revealErrorPath(path: string) {
        const target = promptErrorTarget(path);
        if (!target) return revealTracePath(path);
        setAgentTab("prompts");
        if (!promptsHandle.current?.reveal(target.name, target.field)) {
            toast.info(`The prompt ${target.name} is not in this draft any more.`);
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
                setLoadFailure({
                    draftid: id,
                    reason: resp?.error?.message || "Failed to load draft",
                });
                setPageState(null);
            } else {
                setLoadFailure(null);
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
                const loadedPrompts = promptRows(resp.agentPrompts);
                setPrompts(loadedPrompts);
                const loadedConst = constText(resp.const);
                setAgentConst(loadedConst);
                setConstError(resp.constError ?? "");
                originalRef.current = {
                    name: loadedName,
                    title: resp.agentTitle ?? "",
                    tag: resp.agentTag ?? "",
                    maxTime: limitText(resp.maxTime),
                    maxCost: limitText(resp.maxCost),
                    definitionText: defText,
                    validationQuery: resp.validationQuery ?? "",
                    usedProfiles: loadedProfiles,
                    prompts: loadedPrompts,
                    agentConst: loadedConst,
                };
            }
        } catch (e) {
            setLoadFailure({ draftid: id, reason: errorText(e, "Failed to load the draft.") });
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
    const dirtyPrompts = !samePrompts(prompts, originalRef.current.prompts);
    const dirtyConst = !sameConst(agentConst, originalRef.current.agentConst);

    const valuesRef = useRef({
        name,
        title,
        tag,
        maxTime,
        maxCost,
        definitionText,
        validationQuery,
        usedProfiles,
        prompts,
        agentConst,
        isNewDraft: false,
    });
    valuesRef.current = {
        name,
        title,
        tag,
        maxTime,
        maxCost,
        definitionText,
        validationQuery,
        usedProfiles,
        prompts,
        agentConst,
        isNewDraft: Boolean(pageState?.isNewDraft),
    };

    const computeDirtyNow = useCallback(() => {
        const v = valuesRef.current;
        const o = originalRef.current;
        return (
            (v.isNewDraft && v.name.trim() !== "" && v.name.trim() !== o.name) ||
            v.title !== o.title ||
            v.tag !== o.tag ||
            v.maxTime.trim() !== o.maxTime ||
            v.maxCost.trim() !== o.maxCost ||
            v.definitionText !== o.definitionText ||
            v.validationQuery !== o.validationQuery ||
            !sameUsedProfiles(v.usedProfiles, o.usedProfiles) ||
            !samePrompts(v.prompts, o.prompts) ||
            !sameConst(v.agentConst, o.agentConst)
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
            dirtyUsedProfiles ||
            dirtyPrompts ||
            dirtyConst
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
            if (dirtyPrompts) {
                const problem = promptRowsError(prompts);
                if (problem) {
                    toast.error(problem);
                    return { success: false };
                }
            }
            let constValue: string | undefined;
            if (dirtyConst) {
                const result = constPayload(agentConst);
                if ("error" in result) {
                    toast.error(result.error);
                    return { success: false };
                }
                constValue = result.value;
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
                      ...(dirtyPrompts ? { agentPrompts: promptMap(prompts) } : {}),
                      ...(constValue !== undefined ? { const: constValue } : {}),
                  })
                : await API.saveDraftAgent({
                      draftid: pageState.draftid,
                      ...(dirtyTitle ? { agentTitle: title } : {}),
                      ...(limits ?? {}),
                      ...(dirtyDefinition ? { agentDefinition: definitionText } : {}),
                      ...(dirtyValidationQuery ? { validationQuery } : {}),
                      ...(dirtyUsedProfiles ? { usedProfiles } : {}),
                      ...(dirtyPrompts ? { agentPrompts: promptMap(prompts) } : {}),
                      ...(constValue !== undefined ? { const: constValue } : {}),
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
                prompts,
                agentConst,
            };

            if (dirtyDefinition) setAiUndo([]);

            if (dirtyConst) setConstError("");

            if (limits) {
                setMaxTime(String(limits.maxTime));
                setMaxCost(String(limits.maxCost));
            }

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
        dirtyPrompts,
        dirtyConst,
        usedProfiles,
        prompts,
        agentConst,
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

    const run = useDraftValidation({ pageState, setPageState, validationQuery, saveChanges });
    const { onValidate } = run;

    const publishNow = useCallback(
        async (overwrite = false) => {
            if (!pageState) return;

            const saved = await saveChanges();
            if (!saved?.success) return;

            try {
                const resp = await API.publishDraft({
                    draftid: pageState.draftid,
                    ...(overwrite ? { overwrite } : {}),
                });
                if (!resp?.success && resp?.didMetaChange) {
                    setMetaChanged(resp.metaFieldsChanged ?? []);
                    return;
                }
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
        },
        [pageState, saveChanges, fetchDraft],
    );

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
                dirtyUsedProfiles ||
                dirtyPrompts ||
                dirtyConst
            ),
        [
            dirtyName,
            dirtyTitle,
            dirtyTag,
            dirtyLimits,
            dirtyDefinition,
            dirtyValidationQuery,
            dirtyUsedProfiles,
            dirtyPrompts,
            dirtyConst,
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

    const disableValidate = run.isValidating || aiBusy;
    const draftValidated = Boolean(
        pageState?.draftCompilationValidated && pageState?.draftExecutionValidated,
    );

    const disablePublish =
        !draftValidated ||
        !title?.trim() ||
        (Boolean(pageState?.isNewDraft) && !(pageState?.draftName || name.trim()));

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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading draft…
            </div>
        );
    }

    if (!pageState) {
        return <DraftUnavailable {...(loadFailure ?? { reason: "Unable to load draft." })} />;
    }

    const draftAgentName = pageState.draftName || (pageState.isNewDraft ? "" : pageState.draftid);

    const status = validationStatus({
        running: run.isValidating,
        failed: run.failed,
        validated: draftValidated,
    });
    const validateTip = aiBusy ? uiText("draft.tabs.waitForAi") : "Ctrl+Enter / ⌘⏎";

    const readyNoticeShown = !disablePublish && disableSave && !run.isValidating && !aiBusy;

    const keysInConst = constKeys(agentConst);
    const promptsProblem = promptRowsError(prompts);
    const limits = parseLimits(maxTime, maxCost);

    return (
        <>
            <div className="space-y-5">
                <DraftHead
                    isNewDraft={Boolean(pageState.isNewDraft)}
                    agentName={draftAgentName}
                    name={name}
                    onNameChange={(next) => {
                        setName(next);
                        if (!titleTouchedRef.current) setTitle(next);
                    }}
                    tag={tag}
                    onTagChange={setTag}
                    title={title}
                    onTitleChange={(next) => {
                        titleTouchedRef.current = true;
                        setTitle(next);
                    }}
                    maxTime={maxTime}
                    maxCost={maxCost}
                    onMaxTimeChange={setMaxTime}
                    onMaxCostChange={setMaxCost}
                    limitsInvalid={"error" in limits}
                    saveDisabled={disableSave}
                    onSave={() => void saveChanges()}
                    publishDisabled={disablePublish}
                    publishFilled={!disablePublish && !readyNoticeShown}
                    onPublish={() => void onPublish()}
                    backFallback={BACK_FALLBACK}
                />

                <div className="overflow-clip rounded-xl border bg-card shadow-sm">
                    <PaneTabs
                        idPrefix="agent"
                        label="Parts of the agent"
                        value={agentTab}
                        onChange={setAgentTab}
                        tabs={[
                            {
                                id: "const",
                                label: ft("const", "Const"),
                                badge: <TabCount n={keysInConst?.length ?? 0} />,
                                problem: keysInConst === null || Boolean(constError),
                            },
                            {
                                id: "prompts",
                                label: "Prompts",
                                badge: <TabCount n={prompts.length} />,
                                problem: promptsProblem !== null,
                            },
                            { id: "definition", label: "Definition" },
                        ]}
                        end={
                            <div className="flex items-center gap-1">
                                {savedAt !== null ? (
                                    <span
                                        role="status"
                                        className="animate-in fade-in mr-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground duration-200"
                                    >
                                        <CircleCheck
                                            className="h-3.5 w-3.5 text-primary"
                                            aria-hidden
                                        />
                                        Saved
                                    </span>
                                ) : null}
                                {agentTab === "definition" && aiUndo.length > 0 ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() =>
                                            dirtyDefinition
                                                ? setConfirmAiUndo(true)
                                                : void undoAiEdit()
                                        }
                                    >
                                        <Undo2 className="h-3.5 w-3.5" aria-hidden />
                                        Undo AI edit
                                        <span className="text-muted-foreground">
                                            ({aiUndo.length})
                                        </span>
                                    </Button>
                                ) : null}
                                {toolsInTabRow && agentTab === "definition" ? (
                                    <div ref={setEditorToolsEl} />
                                ) : null}
                                {agentTab === "prompts" ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        aria-label="Add prompt"
                                        onClick={() => promptsHandle.current?.add()}
                                    >
                                        <Plus className="h-3.5 w-3.5" aria-hidden />
                                        <span className="hidden sm:inline">Add prompt</span>
                                    </Button>
                                ) : null}
                                <span
                                    aria-hidden
                                    className="mx-1.5 hidden h-5 w-px bg-border sm:block"
                                />
                                <HoverTip tip="Go to the validation run">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            runRef.current?.scrollIntoView({
                                                block: "start",
                                                behavior: "smooth",
                                            })
                                        }
                                        aria-label="Validation status — go to the validation run"
                                        className="hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
                                    >
                                        <ValidationBadge status={status} />
                                    </button>
                                </HoverTip>
                            </div>
                        }
                    />
                    <div
                        id="agent-panel-const"
                        role="tabpanel"
                        aria-labelledby="agent-tab-const"
                        hidden={agentTab !== "const"}
                        className="min-h-72 bg-surface"
                    >
                        <p className="px-4 pt-3 text-xs text-muted-foreground">
                            {uiText("const.help")}
                        </p>
                        {constError ? (
                            <div className="px-4 pt-3">
                                <ConstError
                                    error={constError}
                                    consequence={uiText("const.replaceOnSave")}
                                />
                            </div>
                        ) : null}
                        <DraftConst value={agentConst} onChange={setAgentConst} />
                    </div>
                    <div
                        id="agent-panel-prompts"
                        role="tabpanel"
                        aria-labelledby="agent-tab-prompts"
                        hidden={agentTab !== "prompts"}
                        className="min-h-72"
                    >
                        <p className="border-b px-4 py-3 text-xs text-muted-foreground">
                            {uiText("prompt.intro")}
                        </p>
                        <DraftPrompts ref={promptsHandle} value={prompts} onChange={setPrompts} />
                    </div>
                    <div
                        id="agent-panel-definition"
                        role="tabpanel"
                        aria-labelledby="agent-tab-definition"
                        hidden={agentTab !== "definition"}
                        className="min-h-72 bg-surface pt-2 pb-2"
                    >
                        {toolsInTabRow ? null : (
                            <div
                                ref={setEditorToolsEl}
                                className="-mt-2 mb-2 flex justify-end border-b px-2 py-1"
                            />
                        )}
                        <MonacoJsonc
                            ref={editorHandle}
                            value={definitionText}
                            onChange={(v: string) => setDefinitionText(v ?? "")}
                            readOnly={aiBusy}
                            framed={false}
                            toolbarTarget={editorToolsEl}
                        />
                    </div>

                    <div className="sticky bottom-0 z-10 border-t bg-card/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                        <DraftAiPanel
                            draftid={pageState.draftid}
                            onBeforeSend={saveBeforeAi}
                            onBusyChange={setAiBusy}
                            onReplace={onAiReplace}
                            blockedReason={
                                run.isValidating ? uiText("draft.tabs.waitForValidation") : null
                            }
                            profiles={
                                <DraftUsedProfiles
                                    value={usedProfiles}
                                    onChange={setUsedProfiles}
                                    disabled={aiBusy}
                                />
                            }
                        />
                    </div>

                    <DraftRunPanel
                        ref={runRef}
                        run={run}
                        status={status}
                        validationQuery={validationQuery}
                        onValidationQueryChange={setValidationQuery}
                        runDisabled={disableValidate}
                        runTip={validateTip}
                        readyToPublish={readyNoticeShown}
                        onPublish={() => void onPublish()}
                        agentName={pageState.draftName ?? null}
                        onOpenErrorPath={revealErrorPath}
                        onOpenTracePath={revealTracePath}
                        onOpenAllowlist={() => UI.openModule("AllowlistConfig")}
                    />
                </div>
            </div>

            <MergeDraftDialog
                open={mergeOpen}
                onOpenChange={setMergeOpen}
                draftid={pageState.draftid}
                agentName={draftAgentName}
                onMerged={onMerged}
            />

            <UndoAiEditDialog
                open={confirmAiUndo}
                onOpenChange={setConfirmAiUndo}
                onUndo={() => void undoAiEdit()}
            />
            <MetaChangedDialog
                fields={metaChanged}
                onClose={() => setMetaChanged(null)}
                onReplace={() => void publishNow(true)}
            />
            <AskPublishDialog
                open={confirmAskPublish}
                onOpenChange={setConfirmAskPublish}
                onPublish={() => void publishNow()}
            />
            <UnsavedChangesDialog
                open={pendingNav !== null}
                onStay={stayHere}
                onDiscard={discardAndLeave}
                onSave={() => void saveAndLeave()}
            />

            <PublishedDialog
                open={postPublishPrompt.open}
                agentName={pageState.draftName || pageState.draftid}
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
