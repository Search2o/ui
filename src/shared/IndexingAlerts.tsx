import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
    dismissOutcome,
    useIndexingJobs,
    useNextOutcome,
    type IndexingJob,
} from "@/shared/indexingJobs";
import { resetPagedList } from "@/shared/pagedList";
import { uiText } from "@/shared/uiText";

const SLOW_AFTER_MS = 45_000;

function clock(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function verb(kind: IndexingJob["kind"]): string {
    return kind === "index" ? "Indexing" : "Removing from the index";
}

function RunningStrip({ jobs }: { jobs: IndexingJob[] }) {
    const [, tick] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => tick((n) => n + 1), 1000);
        return () => window.clearInterval(id);
    }, []);

    return createPortal(
        <div
            className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
            data-testid="indexing-running"
        >
            {jobs.map((job) => (
                <div
                    key={`${job.agentName}-${job.startedAt}`}
                    className="pointer-events-auto flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg"
                    role="status"
                >
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium">
                            {verb(job.kind)} <span className="font-mono">{job.agentName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {Date.now() - job.startedAt >= SLOW_AFTER_MS
                                ? uiText("indexing.stillWorking")
                                : uiText("indexing.wait")}
                        </p>
                    </div>
                    <span className="ml-1 font-mono text-sm tabular-nums text-muted-foreground">
                        {clock(Date.now() - job.startedAt)}
                    </span>
                </div>
            ))}
        </div>,
        document.body,
    );
}

export function IndexingAlerts() {
    const jobs = useIndexingJobs();
    const outcome = useNextOutcome();

    useEffect(() => {
        if (outcome) resetPagedList("agents");
    }, [outcome]);

    const title = !outcome
        ? ""
        : outcome.ok
          ? outcome.kind === "index"
              ? `Indexing finished — ${outcome.agentName}`
              : `Removed from the index — ${outcome.agentName}`
          : outcome.rejected
            ? `The description needs changing — ${outcome.agentName}`
            : `${verb(outcome.kind)} failed — ${outcome.agentName}`;

    return (
        <>
            {jobs.length > 0 ? <RunningStrip jobs={jobs} /> : null}

            <AlertDialog
                open={outcome !== null}
                onOpenChange={(open) => {
                    if (!open) dismissOutcome();
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{title}</AlertDialogTitle>
                        <AlertDialogDescription>{outcome?.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <span className="mr-auto self-center font-mono text-xs tabular-nums text-muted-foreground">
                            {outcome ? clock(outcome.tookMs) : ""}
                        </span>
                        <AlertDialogAction asChild>
                            <Button variant="outline">OK</Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
