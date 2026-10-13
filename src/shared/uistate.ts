import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { MODULE_IMPORTS, preloadModule, type ModuleKey } from "@/shared/moduleRegistry";

export type { ModuleKey } from "@/shared/moduleRegistry";

export type ModulePayload = Record<string, unknown>;

type UIState = { active: ModuleKey; payload?: ModulePayload };

const state: UIState = { active: "SearchHistory" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}
const getSnap = () => state;

export type NavigationGuard = (next: ModuleKey, payload?: ModulePayload) => boolean;

let navigationGuard: NavigationGuard | null = null;

export function setNavigationGuard(guard: NavigationGuard): void {
    navigationGuard = guard;
}

export function clearNavigationGuard(guard: NavigationGuard): void {
    if (navigationGuard === guard) navigationGuard = null;
}

const PRELOAD_GRACE_MS = 200;

function prefersReducedMotion(): boolean {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export type ReturnTo = { module: ModuleKey; payload?: ModulePayload };

const RETURN_KEY = "__returnTo";

export function updatePayload(patch: ModulePayload) {
    state.payload = { ...(state.payload ?? {}), ...patch };
    emit();
}

export function openSubModule(next: ModuleKey, payload?: ModulePayload) {
    const returnTo: ReturnTo = { module: state.active, payload: state.payload };
    openModule(next, { ...(payload ?? {}), [RETURN_KEY]: returnTo });
}

export function goBack(fallback: ModuleKey) {
    const returnTo = state.payload?.[RETURN_KEY] as ReturnTo | undefined;
    if (returnTo?.module) {
        openModule(returnTo.module, returnTo.payload);
        return;
    }
    openModule(fallback);
}

export function openModule(next: ModuleKey, payload?: ModulePayload) {
    if (navigationGuard && !navigationGuard(next, payload)) return;

    const apply = () => {
        state.active = next;
        state.payload = payload;
        emit();
    };

    const canAnimate =
        typeof document !== "undefined" &&
        typeof document.startViewTransition === "function" &&
        !prefersReducedMotion();

    if (!canAnimate) {
        preloadModule(next);
        apply();
        return;
    }

    const ready = Promise.race([
        MODULE_IMPORTS[next]().catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, PRELOAD_GRACE_MS)),
    ]);

    void ready.then(() => {
        const transition = document.startViewTransition(() => {
            flushSync(apply);
        });
        transition.ready.catch(() => {});
        transition.finished.catch(() => {});
    });
}

export function useActiveModule(): ModuleKey {
    return useSyncExternalStore(
        subscribe,
        () => getSnap().active,
        () => getSnap().active,
    );
}

export function useModulePayload<T = unknown>(): T | undefined {
    return useSyncExternalStore(
        subscribe,
        () => getSnap().payload as T | undefined,
        () => getSnap().payload as T | undefined,
    );
}

export type AgentPayloadType = {
    agentName: string;
    agentTitle?: string;
    lastUpdatedByName?: string;
    lastUpdatedByEmail?: string;
    agentVersion?: number;
    highlightPath?: string;
};
