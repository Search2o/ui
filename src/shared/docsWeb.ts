import * as API from "@/orval/search2o";
import type { DocsWebType } from "@/orval/search2o.schemas";
import { applyPublishedText } from "@/shared/uiText";

type Entry<T> = {
    fetched: boolean;
    inflight: Promise<Loaded<T> | null> | null;
    cached: Loaded<T> | null;
};

export type Loaded<T> = { document: T; version: string };

const entries: Partial<Record<DocsWebType, Entry<unknown>>> = {};

export async function fetchDocsWebOnce<T>(dtype: DocsWebType): Promise<Loaded<T> | null> {
    const entry = (entries[dtype] ??= { fetched: false, inflight: null, cached: null }) as Entry<T>;
    if (entry.fetched) return entry.cached;
    if (entry.inflight) return entry.inflight;

    entry.inflight = (async () => {
        try {
            const resp = await API.getDocsWeb({ dtype });
            entry.cached =
                resp.success && resp.document
                    ? { document: resp.document as T, version: resp.version }
                    : null;
        } catch {
            entry.cached = null;
        } finally {
            entry.fetched = true;
            entry.inflight = null;
        }
        return entry.cached;
    })();

    return entry.inflight;
}

export function resetDocsWeb(): void {
    for (const key of Object.keys(entries) as DocsWebType[]) delete entries[key];
}

export async function fetchUiTextOnce(): Promise<void> {
    const loaded = await fetchDocsWebOnce<{ text?: Record<string, string> }>("uitext");
    if (loaded?.document?.text) applyPublishedText(loaded.document.text, loaded.version);
}
