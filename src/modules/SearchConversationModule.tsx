import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import * as API from "@/orval/search2o";
import type {
    ContentPartApi,
    ConversationElementModel,
    ExecAgentResponseModel,
    ExecuteAgentModel,
} from "@/orval/search2o.schemas";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2 } from "lucide-react";
import { useJsonStream, type StreamJsonMessage } from "@/shared/useJsonStream";
import { AskInputsForm, type AskBlockAnswers, type AskBlocks } from "@/shared/AskInputsForm";
import { hasAskBlocks } from "@/shared/askBlocks";
import { decideFollowup, followupNeedsSearch, useAgentMatches } from "@/shared/agentSearch";
import { getUiConfig } from "@/shared/uiConfig";
import { AgentSuggestions, NoAgentMatch } from "@/shared/AgentSuggestions";
import { SafeContent } from "@/shared/SafeContent";
import { showsEmptyAnswerNotice } from "@/shared/agentOutput";
import * as UI from "@/shared/uistate";
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
import { BackButton } from "@/shared/BackButton";
import { DeleteConversationDialog } from "@/shared/DeleteConversationDialog";
import { resetPagedList } from "@/shared/pagedList";
import { signalTabAttention } from "@/shared/tabAttention";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

function formatFullLocal(epochMs: number): string {
    const d = new Date(epochMs);
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

type PayloadType = {
    query?: string;
    convid?: string;
    agentName?: string;
};

type ConversationTurn = ConversationElementModel & {
    _final?: ExecAgentResponseModel | null;
};

type LiveTurn = {
    query: string;
    agentName: string;
    agentTitle: string;
    startedAt: number;
    parts: ContentPartApi[];
    progressText: string;
    final?: ExecAgentResponseModel | null;
};

type PendingAsk = {
    askInput: AskBlocks;
    agentName: string;
};

function renderPart(part: ContentPartApi, idx: number) {
    return <SafeContent key={idx} part={part} />;
}

function FinalSummary({ final }: { final: ExecAgentResponseModel }) {
    if (!final) return null;

    const hasError = !final.success && !!final.error?.message;
    if (!hasError) return null;

    return (
        <div className="rounded-lg border bg-background/50 p-3 space-y-2">
            <div className="text-sm text-rose-700 dark:text-rose-300">{final.error?.message}</div>
        </div>
    );
}

function QueryBubble({ query, at }: { query: string; at: number }) {
    return (
        <div className="flex justify-end">
            <div className="w-full max-w-[72ch] rounded-2xl border bg-accent/40 px-4 py-3 text-foreground shadow-sm">
                <div className="safe-prose prose prose-sm max-w-none break-words whitespace-pre-wrap">
                    {query}
                </div>
                <div className="mt-1 text-right text-xs text-muted-foreground">
                    {formatFullLocal(at)}
                </div>
            </div>
        </div>
    );
}

function ResponseBubble({
    agentName,
    agentTitle,
    at,
    parts,
    final,
    progressText,
    running = false,
    onStop,
    resultCode,
}: {
    agentName: string;
    agentTitle?: string;
    at: number;
    parts: ContentPartApi[];
    final?: ExecAgentResponseModel | null;
    progressText?: string;
    running?: boolean;
    onStop?: () => void;
    resultCode?: string;
}) {
    const progressDisplay = !final ? (progressText ?? "") : "";

    const emptyAnswer = showsEmptyAnswerNotice({
        running,
        partCount: parts.length,
        progressText: progressDisplay,
        finalSuccess: final?.success,
        resultCode: resultCode || final?.resultCode,
    });

    return (
        <div className="flex justify-start">
            <div className="w-full max-w-[72ch] py-1 text-foreground">
                <div className="space-y-3">
                    <div className="max-w-none text-foreground">
                        {emptyAnswer ? (
                            <p className="text-muted-foreground italic">{uiText("run.noOutput")}</p>
                        ) : (
                            parts.map((p, idx) => renderPart(p, idx))
                        )}
                    </div>

                    {progressDisplay && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center">
                                <Loader2 className="size-4 animate-spin" />
                            </span>
                            <span className="whitespace-pre-wrap break-words leading-5">
                                {progressDisplay}
                            </span>
                        </div>
                    )}

                    {!!final && <FinalSummary final={final} />}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {running && (
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 py-1 pl-3 pr-1 text-xs text-muted-foreground shadow-sm">
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-primary/25 animate-ping" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary/70" />
                            </span>
                            <span className="font-medium text-foreground/80">
                                Running: {agentTitle ?? agentName}
                            </span>
                            {onStop ? (
                                <button
                                    type="button"
                                    onClick={onStop}
                                    className="rounded-full px-2 py-0.5 font-medium text-destructive transition-colors hover:bg-destructive/10"
                                >
                                    Stop
                                </button>
                            ) : null}
                        </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                        {agentName} · {formatFullLocal(at)}
                    </div>
                </div>
            </div>
        </div>
    );
}

let matchedAgentName: string | null = null;
let matchedAgentTitle: string | null = null;

export default function SearchConversationModule() {
    const payload = UI.useModulePayload<PayloadType>() ?? {};
    const initialQuery = payload.query;
    const initialConvid = payload.convid ?? null;
    const initialAgentName = payload.agentName ?? null;

    const [convid, setConvid] = useState<string | null>(initialConvid);
    const [conversation, setConversation] = useState<ConversationTurn[]>([]);

    const liveRef = useRef<LiveTurn | null>(null);

    const [loadingAgentExec, setLoadingAgentExec] = useState(false);

    const [searchBox1, setSearchBox1] = useState("");
    const [live, setLive] = useState<LiveTurn | null>(null);
    useEffect(() => {
        liveRef.current = live;
    }, [live]);

    const { start, cancel } = useJsonStream<ExecAgentResponseModel>();

    const lastConversationSizeRef = useRef(0);

    const [pendingAsk, setPendingAsk] = useState<PendingAsk | null>(null);

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const deleteThisConversation = async () => {
        setConfirmDelete(false);
        if (!convid) return;
        setDeleting(true);
        try {
            const resp = await API.deleteConversation({ convid });
            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to delete the conversation");
                return;
            }
            resetPagedList("searchHistory");
            UI.openModule("SearchHistory");
        } catch (e) {
            toast.error(errorText(e, "Failed to delete the conversation"));
        } finally {
            setDeleting(false);
        }
    };

    const matches = useAgentMatches();
    const [followupNoMatch, setFollowupNoMatch] = useState(false);
    const [matching, setMatching] = useState(false);

    const canSubmit = !loadingAgentExec && !matching;

    useEffect(() => {
        const scrollEl = document.scrollingElement ?? document.documentElement;
        if (!scrollEl) return;

        const isNewConversation = lastConversationSizeRef.current === 0 && conversation.length > 0;

        const behavior: ScrollBehavior = isNewConversation ? "smooth" : "auto";

        requestAnimationFrame(() => {
            scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior });
            lastConversationSizeRef.current = conversation.length;
        });
    }, [conversation.length]);

    useEffect(() => {
        const scrollEl = document.scrollingElement ?? document.documentElement;
        if (!scrollEl) return;

        requestAnimationFrame(() => {
            scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "auto" });
        });
    }, [live?.progressText, live?.parts.length]);

    useEffect(() => {
        if (!initialConvid) return;
        (async () => {
            try {
                const resp = await API.getConversation({ convid: initialConvid });

                if (!resp.success) {
                    toast.error(resp.error?.message ?? "Failed to load conversation");
                    UI.goBack("SearchHistory");
                    return;
                }
                setConvid(resp.convid ?? initialConvid);
                setConversation(resp.conversation ?? []);
                const lastTurn = (resp.conversation ?? []).at(-1);
                matchedAgentName = lastTurn?.response?.agentName ?? initialAgentName ?? null;
                matchedAgentTitle = matchedAgentName;
                setSearchBox1("");
            } catch {
                toast.error("Failed to load conversation");
                UI.goBack("SearchHistory");
            }
        })();
    }, [initialConvid]);

    const handleStreamMessage = (m: StreamJsonMessage<ExecAgentResponseModel>) => {
        if (m.type === "progress") {
            const nextValue = (m.value ?? "").trim();
            if (!nextValue) return;

            setLive((prev) =>
                prev
                    ? {
                          ...prev,
                          progressText: prev.progressText
                              ? `${prev.progressText}\n${nextValue}`
                              : nextValue,
                      }
                    : prev,
            );
            return;
        }

        if (m.type === "data") {
            setLive((prev) => (prev ? { ...prev, parts: [...prev.parts, m.value] } : prev));
            return;
        }

        if (m.type === "agent") {
            const resp: ExecAgentResponseModel = m.value;

            const askInput =
                resp.resultCode === "ask" && hasAskBlocks(resp.askInput) ? resp.askInput : null;
            const asking = !!askInput;

            signalTabAttention(
                asking ? "Input needed" : resp.success ? "Result ready" : "Run failed",
            );
            if (resp.convid) setConvid(resp.convid ?? null);
            matchedAgentName = resp.agentName ?? liveRef.current?.agentName ?? null;
            matchedAgentTitle = liveRef.current?.agentTitle ?? matchedAgentName ?? null;

            if (asking) {
                setLoadingAgentExec(false);
                setLive((prev) => {
                    if (!prev) return null;

                    const agentName = resp.agentName ?? prev.agentName;
                    const turn: ConversationTurn = {
                        query: prev.query,
                        respondedAt: Date.now(),
                        resultCode: resp.resultCode || "ask",
                        response: { agentName, parts: prev.parts },
                        _final: resp,
                    };

                    setConversation((cprev) => [...cprev, turn]);
                    return null;
                });

                setPendingAsk({
                    askInput,
                    agentName: resp.agentName ?? matchedAgentName ?? "",
                });
                setSearchBox1("");
                return;
            }

            setPendingAsk(null);

            if (!resp.success) {
                setLoadingAgentExec(false);
                if (resp.resultCode === "unknownConversation") setConvid(null);
                toast.error(resp.error?.message ?? "Request failed");
                setLive((prev) => (prev ? { ...prev, progressText: "", final: resp } : prev));
                return;
            }

            setLoadingAgentExec(false);
            setLive((prev) => {
                if (!prev) return null;

                const respondedAt = Date.now();
                const agentName = resp.agentName ?? prev.agentName;

                const turn: ConversationTurn = {
                    query: prev.query,
                    respondedAt,
                    resultCode: resp.resultCode || "success",
                    response: {
                        agentName,
                        parts: prev.parts,
                    },
                    _final: resp,
                };

                setConversation((cprev) => [...cprev, turn]);

                return null;
            });

            setSearchBox1("");
        }
    };

    useEffect(() => {
        if (!initialQuery || initialConvid || conversation.length > 0) return;

        if (!payload.agentName) {
            toast.error("Missing agent name for this query");
            return;
        }

        matchedAgentName = payload.agentName;
        matchedAgentTitle = payload.agentName;
        void handleSubmitAgentExec(payload.agentName, initialQuery);
    }, [initialQuery, initialConvid, conversation.length, payload.agentName]);

    const submitFollowup = async () => {
        const q = searchBox1.trim();
        if (!q || !canSubmit || pendingAsk) return;

        const chosen = matches.selectedAgent;
        if (chosen) {
            void handleSubmitAgentExec(chosen.agentName);
            return;
        }

        const options = getUiConfig().search;
        const previous = matchedAgentName
            ? { agentName: matchedAgentName, agentTitle: matchedAgentTitle ?? matchedAgentName }
            : null;

        setFollowupNoMatch(false);
        if (!followupNeedsSearch(options.followupBehavior)) {
            const outcome = decideFollowup([], options.followupBehavior, previous);
            if (outcome.kind === "run") void handleSubmitAgentExec(outcome.agentName);
            else setFollowupNoMatch(true);
            return;
        }

        setMatching(true);
        try {
            const resp = await API.search({ query: q, tag: options.tag });
            if (!resp.success) {
                toast.error(resp.error?.message || "Could not search for a matching agent.");
                return;
            }
            const outcome = decideFollowup(
                resp.searchResults ?? [],
                options.followupBehavior,
                previous,
            );
            if (outcome.kind === "run") void handleSubmitAgentExec(outcome.agentName);
            else if (outcome.kind === "show") matches.show(outcome.results);
            else setFollowupNoMatch(true);
        } catch (e) {
            toast.error(errorText(e, "Could not search for a matching agent."));
        } finally {
            setMatching(false);
        }
    };

    const onTextareaEnter = (submit: () => void) => (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    };

    const handleSubmitAgentExec = async (
        agentNameOverride: string | null = null,
        queryOverride?: string,
        answers?: AskBlockAnswers,
    ) => {
        const sb = searchBox1.trim();
        const fallbackQuery =
            conversation.length > 0 ? conversation[conversation.length - 1].query : "";
        const q = (queryOverride ?? "").trim() || (sb === "" ? fallbackQuery : sb);
        const agentName = agentNameOverride ?? matchedAgentName;

        if (!q || !agentName) return;

        const agentTitle = matchedAgentTitle ?? agentName;

        matchedAgentName = agentName;
        matchedAgentTitle = agentTitle;

        resetPagedList("searchHistory");

        setLoadingAgentExec(true);
        setLive({
            query: q,
            agentName,
            agentTitle,
            startedAt: Date.now(),
            parts: [],
            progressText: "",
            final: null,
        });

        try {
            start({
                url: API.getExecAgentUrl(),
                body: {
                    ...(convid ? { convid } : {}),
                    inputs: answers ?? { query: q },
                    agentName,
                    stream: true,
                } satisfies ExecuteAgentModel,
                onMessage: (msg) => handleStreamMessage(msg),
                onError: () => {
                    signalTabAttention("Search failed");
                    setLive(null);
                },
                onClose: ({ cancelled }) => {
                    setLoadingAgentExec(false);
                    if (!cancelled) return;
                    setLive(null);
                    toast.info(uiText("search.runCancelled"));
                },
            });
        } catch {
            setLoadingAgentExec(false);
            toast.error("The agent run failed.");
            setLive(null);
        }
    };

    const [confirmCancel, setConfirmCancel] = useState(false);

    const requestCancel = () => {
        if ((live?.parts.length ?? 0) > 0) {
            setConfirmCancel(true);
            return;
        }
        cancel();
    };

    const followupPlaceholder = pendingAsk
        ? "Answer the question above to continue"
        : "Ask a follow-up question";

    const renderedConversation = useMemo(() => {
        let lastShownQuery: string | null = null;

        const items = conversation.map((turn, i) => {
            const parts = turn.response?.parts ?? [];
            const trimmed = (turn.query ?? "").trim();
            const showQueryBubble =
                trimmed.length > 0 && (lastShownQuery === null || trimmed !== lastShownQuery);
            if (showQueryBubble) lastShownQuery = trimmed;

            return { turn, i, parts, showQueryBubble };
        });

        return { items, lastShownQuery };
    }, [conversation]);

    return (
        <div className="w-full h-full flex flex-col">
            <DeleteConversationDialog
                open={confirmDelete}
                title=""
                onOpenChange={setConfirmDelete}
                onConfirm={() => void deleteThisConversation()}
            />

            <Card className="w-full h-full flex flex-col">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle>Conversation</CardTitle>
                    <div className="flex items-center gap-2">
                        {convid ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setConfirmDelete(true)}
                                disabled={deleting}
                            >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                {deleting ? "Deleting…" : "Delete"}
                            </Button>
                        ) : null}
                        <BackButton fallback="SearchHistory" label="Back" />
                    </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col min-h-0 gap-3">
                    {(conversation.length > 0 || !!live) && (
                        <ScrollArea className="flex-1 rounded-2xl border bg-background/40 p-4 text-foreground shadow-sm">
                            <div className="space-y-6">
                                {renderedConversation.items.map((rt) => {
                                    const turn = rt.turn;
                                    const i = rt.i;

                                    return (
                                        <div key={i} className="space-y-2">
                                            {rt.showQueryBubble && (
                                                <QueryBubble
                                                    query={turn.query}
                                                    at={turn.respondedAt}
                                                />
                                            )}

                                            <ResponseBubble
                                                agentName={turn.response.agentName ?? ""}
                                                agentTitle={turn.response.agentName}
                                                at={turn.respondedAt}
                                                parts={rt.parts}
                                                final={turn._final ?? null}
                                                resultCode={turn.resultCode}
                                            />
                                        </div>
                                    );
                                })}

                                {live && (
                                    <div className="space-y-2">
                                        {(() => {
                                            const lastQ = (
                                                renderedConversation.lastShownQuery ?? ""
                                            ).trim();
                                            const liveQ = (live.query ?? "").trim();
                                            const showLiveQuery = !lastQ || liveQ !== lastQ;
                                            return showLiveQuery ? (
                                                <QueryBubble
                                                    query={live.query}
                                                    at={live.startedAt}
                                                />
                                            ) : null;
                                        })()}
                                        <ResponseBubble
                                            agentName={live.agentName}
                                            agentTitle={live.agentTitle}
                                            at={Date.now()}
                                            parts={live.parts}
                                            final={live.final ?? null}
                                            progressText={live.progressText}
                                            running={!live.final}
                                            onStop={loadingAgentExec ? requestCancel : undefined}
                                        />
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    {pendingAsk ? (
                        <div className="pt-2">
                            <AskInputsForm
                                askInput={pendingAsk.askInput}
                                agentName={pendingAsk.agentName}
                                disabled={loadingAgentExec}
                                onSubmit={(answers) => {
                                    const ask = pendingAsk;
                                    matchedAgentName = ask.agentName;
                                    matchedAgentTitle = ask.agentName;
                                    void handleSubmitAgentExec(ask.agentName, undefined, answers);
                                }}
                            />
                        </div>
                    ) : null}

                    <div className="space-y-2 pt-2 border-t">
                        <div>
                            <Textarea
                                rows={3}
                                className="resize-none"
                                placeholder={followupPlaceholder}
                                value={searchBox1}
                                onChange={(e) => {
                                    setSearchBox1(e.target.value);
                                    setFollowupNoMatch(false);
                                    matches.clear();
                                }}
                                onKeyDown={(e) => {
                                    if (matches.handleKeyDown(e)) return;
                                    onTextareaEnter(() => void submitFollowup())(e);
                                }}
                                role="combobox"
                                aria-expanded={matches.results.length > 0}
                                aria-controls="followup-agent-suggestions"
                                aria-activedescendant={
                                    matches.results.length > 0
                                        ? `followup-agent-suggestion-${matches.selected}`
                                        : undefined
                                }
                                disabled={!canSubmit || !!pendingAsk}
                            />
                        </div>

                        <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel this run?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        The agent stops and everything it has produced is discarded
                                        — this run will not appear in your history.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Keep running</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => {
                                            setConfirmCancel(false);
                                            cancel();
                                        }}
                                    >
                                        Cancel run
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        {!pendingAsk && (
                            <div id="followup-agent-suggestions">
                                <AgentSuggestions
                                    results={matches.results}
                                    selected={matches.selected}
                                    onSelect={matches.setSelected}
                                    onRun={(agent) => void handleSubmitAgentExec(agent.agentName)}
                                    idPrefix="followup-agent-suggestion"
                                />
                            </div>
                        )}

                        {!pendingAsk && followupNoMatch ? <NoAgentMatch /> : null}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
