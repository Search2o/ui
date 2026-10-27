import { useEffect, useRef, useState } from "react";
import { CircleCheck, Loader2, Search, TableOfContents } from "lucide-react";
import * as API from "@/orval/search2o";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Composer } from "@/shared/Composer";
import { errorText } from "@/shared/apiError";
import { INDEXING_TIMEOUT_MS, startIndexing } from "@/shared/indexingJobs";
import { MAX_LENGTHS } from "@/shared/schemaRules";
import { uiText } from "@/shared/uiText";

export function PublishedDialog({
    open,
    agentName,
    isIndexed,
    onIndex,
    onLater,
}: {
    open: boolean;
    agentName: string;
    isIndexed: boolean;
    onIndex: () => void;
    onLater: () => void;
}) {
    const decided = useRef(false);
    const [desc, setDesc] = useState("");
    const [indexing, setIndexing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!open) return;
        decided.current = false;
        setDesc("");
        setIndexing(false);
        setError(null);
    }, [open]);
    const decide = (outcome: () => void) => {
        if (decided.current) return;
        decided.current = true;
        outcome();
    };

    const descTrimmed = desc.trim();

    const addToIndex = () => {
        if (indexing || descTrimmed.length === 0) return;
        setIndexing(true);
        setError(null);
        const description = desc;
        const settle = (refused: string | null) => {
            setIndexing(false);
            if (refused) setError(refused);
            else decide(onLater);
        };
        startIndexing({ agentName, kind: "index" }, async () => {
            try {
                const resp = await API.publishDescriptor(
                    { agentName, descriptorVersion: 0, descriptor: { description } },
                    { signal: AbortSignal.timeout(INDEXING_TIMEOUT_MS) },
                );
                if (resp.validationError) {
                    settle(resp.validationError);
                    return {
                        ok: false,
                        rejected: true,
                        quiet: true,
                        message: resp.validationError,
                    };
                }
                settle(null);
                if (!resp.success) {
                    return {
                        ok: false,
                        message: resp.error?.message || "The agent could not be indexed.",
                    };
                }
                return { ok: true, message: uiText("agent.indexedOk") };
            } catch (e) {
                settle(null);
                return { ok: false, message: errorText(e, "Indexing failed.") };
            }
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next && !indexing) decide(onLater);
            }}
        >
            <DialogContent
                showCloseButton={!indexing}
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => {
                    if (indexing) e.preventDefault();
                }}
            >
                <DialogHeader>
                    <DialogTitle className="pr-10">Agent published</DialogTitle>
                    <DialogDescription asChild>
                        <div className="space-y-3 text-left">
                            <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
                                <CircleCheck
                                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                                    aria-hidden
                                />
                                <div className="min-w-0">
                                    <div className="text-[11px] font-semibold tracking-wide text-primary uppercase">
                                        Done
                                    </div>
                                    <p className="text-sm text-foreground">
                                        {uiText("draft.publishedDone")}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 rounded-lg border px-3 py-2.5">
                                <div className="flex items-start gap-2.5">
                                    <Search
                                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                                        aria-hidden
                                    />
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                                            Next: search index
                                        </div>
                                        <p className="text-sm text-foreground">
                                            {isIndexed
                                                ? uiText("draft.indexChoiceIndexed")
                                                : uiText("draft.indexChoiceNotIndexed")}
                                        </p>
                                    </div>
                                </div>
                                {isIndexed ? null : (
                                    <>
                                        <Composer
                                            id="published-description"
                                            aria-label="Description"
                                            maxLength={MAX_LENGTHS.AGENT_DESCRIPTION.max}
                                            value={desc}
                                            onChange={(e) => {
                                                setDesc(e.target.value);
                                                setError(null);
                                            }}
                                            placeholder={uiText("agent.descriptionPrompt")}
                                            className="min-h-24"
                                            disabled={indexing}
                                            action={
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={addToIndex}
                                                    disabled={indexing || descTrimmed.length === 0}
                                                >
                                                    {indexing ? (
                                                        <Loader2
                                                            className="h-4 w-4 animate-spin"
                                                            aria-hidden
                                                        />
                                                    ) : (
                                                        <TableOfContents
                                                            className="h-4 w-4"
                                                            aria-hidden
                                                        />
                                                    )}
                                                    {indexing ? "Indexing…" : "Add to index"}
                                                </Button>
                                            }
                                        />
                                        {indexing ? (
                                            <p className="text-sm text-muted-foreground">
                                                {uiText("draft.indexingHere")}
                                            </p>
                                        ) : null}
                                        {error ? (
                                            <div
                                                role="alert"
                                                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm"
                                            >
                                                <div className="font-medium text-destructive">
                                                    The description was rejected by validation
                                                </div>
                                                <div className="mt-1 whitespace-pre-wrap">
                                                    {error}
                                                </div>
                                                <div className="mt-1 text-muted-foreground">
                                                    {uiText("agent.descriptionRejected")}
                                                </div>
                                            </div>
                                        ) : null}
                                    </>
                                )}
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => decide(onLater)}
                        disabled={indexing}
                    >
                        Not now
                    </Button>
                    {isIndexed ? (
                        <Button type="button" onClick={() => decide(onIndex)}>
                            Change description
                        </Button>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
