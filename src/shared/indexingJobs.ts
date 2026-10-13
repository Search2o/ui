import { useSyncExternalStore } from "react";

export type IndexKind = "index" | "remove";

export type IndexingJob = {
    agentName: string;
    kind: IndexKind;
    startedAt: number;
};

export type IndexingOutcome = {
    agentName: string;
    kind: IndexKind;
    ok: boolean;
    rejected?: boolean;
    message: string;
    tookMs: number;
};

let running: IndexingJob[] = [];
let finished: IndexingOutcome[] = [];
const listeners = new Set<() => void>();

function announce(): void {
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function startIndexing(
    job: Omit<IndexingJob, "startedAt">,
    run: () => Promise<Omit<IndexingOutcome, "agentName" | "kind" | "tookMs">>,
): void {
    if (running.some((j) => j.agentName === job.agentName)) return;

    const startedAt = Date.now();
    running = [...running, { ...job, startedAt }];
    announce();

    void (async () => {
        let result: Omit<IndexingOutcome, "agentName" | "kind" | "tookMs">;
        try {
            result = await run();
        } catch {
            result = { ok: false, message: "Indexing failed." };
        }
        running = running.filter((j) => j.startedAt !== startedAt);
        finished = [...finished, { ...job, ...result, tookMs: Date.now() - startedAt }];
        announce();
    })();
}

export function useIndexingJobs(): IndexingJob[] {
    return useSyncExternalStore(
        subscribe,
        () => running,
        () => running,
    );
}

export function useIndexingJob(agentName: string | null | undefined): IndexingJob | null {
    const jobs = useIndexingJobs();
    return jobs.find((j) => j.agentName === agentName) ?? null;
}

export function useNextOutcome(): IndexingOutcome | null {
    const all = useSyncExternalStore(
        subscribe,
        () => finished,
        () => finished,
    );
    return all[0] ?? null;
}

export function dismissOutcome(): void {
    finished = finished.slice(1);
    announce();
}

export function resetIndexingJobs(): void {
    running = [];
    finished = [];
    announce();
}
