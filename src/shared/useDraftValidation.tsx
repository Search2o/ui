import {
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { toast } from "sonner";
import * as API from "@/orval/search2o";
import {
    TraceType,
    type DraftResponseModel,
    type ValidateDraftModel,
    type ValidateDraftResponseModel,
    type ValidationResult,
} from "@/orval/search2o.schemas";
import type { AskBlockAnswers, AskBlocks } from "@/shared/AskInputsForm";
import { hasAskBlocks } from "@/shared/askBlocks";
import { runStartedConversation } from "@/shared/draftConversation";
import type { TraceItem, TraceKind } from "@/shared/draftEdit";
import { errorText } from "@/shared/apiError";
import { unreachable } from "@/shared/orvalFetcher";
import { uiText } from "@/shared/uiText";
import { useJsonStream } from "@/shared/useJsonStream";

export function useDraftValidation({
    pageState,
    setPageState,
    validationQuery,
    saveChanges,
}: {
    pageState: DraftResponseModel | null;
    setPageState: Dispatch<SetStateAction<DraftResponseModel | null>>;
    validationQuery: string;
    saveChanges: () => Promise<{ success: boolean } | undefined>;
}) {
    const sawOutputRef = useRef(false);
    const [traceItems, setTraceItems] = useState<TraceItem[]>([]);
    const [validationErrors, setValidationErrors] = useState<ValidationResult[] | null>(null);
    const [runtimeError, setRuntimeError] = useState<string | null>(null);
    const [isValidating, setIsValidating] = useState(false);
    const [pendingAsk, setPendingAsk] = useState<AskBlocks | null>(null);
    const [askWithoutForm, setAskWithoutForm] = useState(false);
    const [inConversation, setInConversation] = useState(false);
    const [followupQuery, setFollowupQuery] = useState("");

    const queryRef = useRef<HTMLDivElement>(null);
    const queryBoxRef = useRef<HTMLTextAreaElement>(null);
    const errorBlockRef = useRef<HTMLDivElement>(null);
    const pinQueryRef = useRef(false);

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

    const markNotValidated = useCallback(
        () =>
            setPageState((prev) =>
                prev
                    ? { ...prev, draftCompilationValidated: false, draftExecutionValidated: false }
                    : prev,
            ),
        [setPageState],
    );

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
                    requestAnimationFrame(() => queryBoxRef.current?.focus());
                    toast.error("Type a validation query to run the agent with.");
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
                                markNotValidated();
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
                                markNotValidated();
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
        [
            pageState,
            validationQuery,
            followupQuery,
            saveChanges,
            start,
            inConversation,
            setPageState,
            markNotValidated,
        ],
    );

    const startOver = useCallback(() => {
        setInConversation(false);
        setFollowupQuery("");
    }, []);

    const clearOutput = useCallback(() => {
        setTraceItems([]);
        setRuntimeError(null);
        setValidationErrors(null);
    }, []);

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

    const hasOutput = traceItems.length > 0 || !!runtimeError || !!validationErrors?.length;

    return {
        traceItems,
        validationErrors,
        runtimeError,
        isValidating,
        pendingAsk,
        askWithoutForm,
        inConversation,
        followupQuery,
        setFollowupQuery,
        hasOutput,
        hasAnything: hasOutput || isValidating || askWithoutForm || Boolean(pendingAsk),
        failed: Boolean(runtimeError || validationErrors?.length),
        onValidate,
        cancel,
        startOver,
        clearOutput,
        queryRef,
        queryBoxRef,
        errorBlockRef,
    };
}

export type DraftValidation = ReturnType<typeof useDraftValidation>;
