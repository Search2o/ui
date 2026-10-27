import { usePersistentState } from "@/shared/pagedList";
import { ariaSort } from "@/shared/reportFormat";
import type { SortDir } from "@/shared/SortHeaderButton";

export function useColumnSort<K extends string>(
    cacheKey: string,
    initialKey: K,
    initialDir: SortDir = "asc",
) {
    const [key, setKey] = usePersistentState<K>(`${cacheKey}.sortKey`, initialKey);
    const [dir, setDir] = usePersistentState<SortDir>(`${cacheKey}.sortDir`, initialDir);
    const toggle = (next: K) => {
        if (next === key) {
            setDir(dir === "asc" ? "desc" : "asc");
            return;
        }
        setKey(next);
        setDir("asc");
    };
    return {
        key,
        dir,
        toggle,
        ariaSort: (column: K) => ariaSort(key === column, dir),
        sign: dir === "asc" ? 1 : -1,
    };
}

export function compareText(a: string | null | undefined, b: string | null | undefined): number {
    return (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });
}

export function textMatches(needle: string, ...texts: (string | null | undefined)[]): boolean {
    const n = needle.trim().toLowerCase();
    if (!n) return true;
    return texts.some((t) => (t ?? "").toLowerCase().includes(n));
}
