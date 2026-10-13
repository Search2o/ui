import { useCallback, useState } from "react";

export function useSavedBaseline<T>(current: T | null | undefined) {
    const [saved, setSaved] = useState<string | null>(null);
    const dirty = current != null && saved !== null && JSON.stringify(current) !== saved;
    const markSaved = useCallback((value: T) => setSaved(JSON.stringify(value)), []);
    return { dirty, markSaved };
}
