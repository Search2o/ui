import { useCallback, useEffect, useRef, useState } from "react";
import { usePersistentState } from "./pagedList";
import { defaultReportRange, type ReportRange } from "./ReportRange";
import { errorText } from "./apiError";

const reportCache = new Map<string, unknown>();

export function useReportRange(key: string, initial?: ReportRange) {
    return usePersistentState<ReportRange>(`${key}.range`, initial ?? defaultReportRange);
}

export const useReportViewState = usePersistentState;

export type CachedReport<T> = {
    data: T | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
};

export function useCachedReport<T>(cacheKey: string, load: () => Promise<T>): CachedReport<T> {
    const [data, setData] = useState<T | null>(() => (reportCache.get(cacheKey) as T) ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadRef = useRef(load);
    loadRef.current = load;

    const run = useCallback(async (key: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await loadRef.current();
            reportCache.set(key, result);
            setData(result);
        } catch (e) {
            setError(errorText(e, "Failed to load the report."));
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const cached = reportCache.get(cacheKey) as T | undefined;
        if (cached !== undefined) {
            setData(cached);
            setError(null);
            return;
        }
        void run(cacheKey);
    }, [cacheKey, run]);

    const refresh = useCallback(() => {
        reportCache.delete(cacheKey);
        void run(cacheKey);
    }, [cacheKey, run]);

    return { data, loading, error, refresh };
}
