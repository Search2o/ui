import { useEffect, useRef } from "react";

type DirtyCheck = () => boolean;

const dirtyChecks = new Set<DirtyCheck>();
const expiryListeners = new Set<() => void>();

export function registerDirtyCheck(check: DirtyCheck): () => void {
    dirtyChecks.add(check);
    return () => {
        dirtyChecks.delete(check);
    };
}

export function hasUnsavedWork(): boolean {
    for (const check of dirtyChecks) {
        try {
            if (check()) return true;
        } catch {}
    }
    return false;
}

export function onSessionExpired(listener: () => void): () => void {
    expiryListeners.add(listener);
    return () => {
        expiryListeners.delete(listener);
    };
}

const TOAST_SUPPRESSION_MS = 1500;

let suppressToastsUntil = 0;

export function toastsSuppressed(): boolean {
    return Date.now() < suppressToastsUntil;
}

export function suppressToastsBriefly(): void {
    suppressToastsUntil = Date.now() + TOAST_SUPPRESSION_MS;
}

export function reportSessionExpired(): boolean {
    if (hasUnsavedWork()) return false;
    expiryListeners.forEach((fn) => fn());
    return true;
}

export function useUnsavedWork(isDirty: () => boolean): void {
    const ref = useRef(isDirty);
    ref.current = isDirty;
    useEffect(() => registerDirtyCheck(() => ref.current()), []);
}
