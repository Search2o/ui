import { useSyncExternalStore } from "react";

let suspendedAccountId: string | null = null;
const listeners = new Set<() => void>();

export function reportAccountSuspended(accountId: string): void {
    suspendedAccountId = accountId;
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

const snapshot = () => suspendedAccountId;

export function useSuspendedAccount(): string | null {
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function resetAccountSuspended(): void {
    suspendedAccountId = null;
    for (const listener of listeners) listener();
}
