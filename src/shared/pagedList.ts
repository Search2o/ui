import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react";
import { errorText } from "./apiError";

export const PAGE_LIMIT = 1000;
export const PAGE_SIZE = 10;

export type PageResult<T> = {
    success: boolean;
    items: T[];
    nextCursor: string | null;
    errorMessage?: string;
};

type Snapshot<T> = { items: T[]; cursor: string | null; loaded: boolean };

const snapshots = new Map<string, Snapshot<unknown>>();
const viewStates = new Map<string, unknown>();
const resetListeners = new Map<string, Set<() => void>>();

export function resetPagedList(cacheKey: string): void {
    snapshots.delete(cacheKey);
    resetListeners.get(cacheKey)?.forEach((cb) => cb());
}

export function onPagedListReset(cacheKey: string, cb: () => void): () => void {
    let set = resetListeners.get(cacheKey);
    if (!set) {
        set = new Set();
        resetListeners.set(cacheKey, set);
    }
    set.add(cb);
    return () => {
        set.delete(cb);
    };
}

export function usePagedList<T>(
    cacheKey: string,
    fetchPage: (cursor: string | null) => Promise<PageResult<T>>,
    opts?: { enabled?: boolean },
) {
    const enabled = opts?.enabled ?? true;
    const restored = snapshots.get(cacheKey) as Snapshot<T> | undefined;
    const [items, setItems] = useState<T[]>(() => restored?.items ?? []);
    const [cursor, setCursor] = useState<string | null>(() => restored?.cursor ?? null);
    const [loaded, setLoaded] = useState<boolean>(() => restored?.loaded ?? false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRef = useRef(fetchPage);
    fetchRef.current = fetchPage;

    useEffect(() => {
        snapshots.set(cacheKey, { items, cursor, loaded });
    }, [cacheKey, items, cursor, loaded]);

    const fetchFrom = useCallback(async (c: string | null): Promise<PageResult<T> | null> => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchRef.current(c);
            if (!res.success) {
                setError(res.errorMessage ?? "Failed to load.");
                return null;
            }
            return res;
        } catch (e) {
            setError(errorText(e, "Failed to load."));
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!enabled || loaded) return;
        let cancelled = false;
        void (async () => {
            const res = await fetchFrom(null);
            if (cancelled || !res) return;
            setItems(res.items);
            setCursor(res.nextCursor);
            setLoaded(true);
        })();
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    const loadMore = useCallback(async () => {
        if (cursor == null) return;
        const res = await fetchFrom(cursor);
        if (!res) return;
        setItems((prev) => [...prev, ...res.items]);
        setCursor(res.nextCursor);
    }, [cursor, fetchFrom]);

    const reload = useCallback(async () => {
        const res = await fetchFrom(null);
        if (!res) return;
        setItems(res.items);
        setCursor(res.nextCursor);
        setLoaded(true);
    }, [fetchFrom]);

    const mutate = useCallback((updater: (items: T[]) => T[]) => {
        setItems((prev) => updater(prev));
    }, []);

    const reloadRef = useRef(reload);
    reloadRef.current = reload;
    useEffect(() => {
        if (!enabled) return;
        return onPagedListReset(cacheKey, () => {
            void reloadRef.current();
        });
    }, [cacheKey, enabled]);

    return {
        items,
        loading,
        error,
        hasMore: cursor != null,
        loadMore,
        reload,
        mutate,
    };
}

export function useClientPaging<T>(
    cacheKey: string,
    filtered: T[],
    opts?: { hasMore?: boolean; loadMore?: () => Promise<void>; pageSize?: number },
) {
    const pageSize = opts?.pageSize ?? PAGE_SIZE;
    const hasMore = opts?.hasMore ?? false;
    const loadMore = opts?.loadMore;

    const [page, setPage] = usePersistentState<number>(`${cacheKey}.page`, 0);

    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const clamped = Math.min(Math.max(0, page), pageCount - 1);

    const rows = useMemo(
        () => filtered.slice(clamped * pageSize, clamped * pageSize + pageSize),
        [filtered, clamped, pageSize],
    );

    const next = useCallback(async () => {
        if (clamped < pageCount - 1) {
            setPage(clamped + 1);
            return;
        }
        if (hasMore && loadMore) {
            await loadMore();
            setPage(clamped + 1);
        }
    }, [clamped, pageCount, hasMore, loadMore, setPage]);

    return {
        page: clamped,
        pageCount,
        rows,
        total: filtered.length,
        hasMore,
        first: useCallback(() => setPage(0), [setPage]),
        prev: useCallback(() => setPage(Math.max(0, clamped - 1)), [clamped, setPage]),
        next,
        last: useCallback(() => setPage(pageCount - 1), [pageCount, setPage]),
        setPage,
    };
}

export function usePersistentState<S>(
    key: string,
    initial: S | (() => S),
): [S, Dispatch<SetStateAction<S>>] {
    const [state, setState] = useState<S>(() => {
        if (viewStates.has(key)) return viewStates.get(key) as S;
        return typeof initial === "function" ? (initial as () => S)() : initial;
    });
    useEffect(() => {
        viewStates.set(key, state);
    }, [key, state]);
    return [state, setState];
}
