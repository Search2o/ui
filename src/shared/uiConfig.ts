import { useSyncExternalStore } from "react";
import {
    DEFAULT_SEARCH_OPTIONS,
    readSearchOptions,
    type SearchOptions,
} from "@/shared/searchOptions";

export type UiConfig = {
    apiTimeoutSeconds: number;
    toastDurationSeconds: number;
    search: SearchOptions;
};

export const DEFAULT_UI_CONFIG: UiConfig = {
    apiTimeoutSeconds: 90,
    toastDurationSeconds: 10,
    search: DEFAULT_SEARCH_OPTIONS,
};

function positiveNumber(value: unknown, fallback: number, key: string): number {
    if (value === undefined) return fallback;
    const n = typeof value === "string" ? Number(value.trim()) : value;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
    console.warn(
        `Search2o: UI setting ${key}=${JSON.stringify(value)} is not valid and was ignored.`,
    );
    return fallback;
}

export function readUiConfig(raw: unknown): UiConfig {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_UI_CONFIG };
    const obj = raw as Record<string, unknown>;
    return {
        apiTimeoutSeconds: positiveNumber(
            obj.apiTimeoutSeconds,
            DEFAULT_UI_CONFIG.apiTimeoutSeconds,
            "apiTimeoutSeconds",
        ),
        toastDurationSeconds: positiveNumber(
            obj.toastDurationSeconds,
            DEFAULT_UI_CONFIG.toastDurationSeconds,
            "toastDurationSeconds",
        ),
        search: readSearchOptions(obj.search),
    };
}

let current: UiConfig = DEFAULT_UI_CONFIG;
const listeners = new Set<() => void>();

export function getUiConfig(): UiConfig {
    return current;
}

export function applyUiConfig(raw: unknown): void {
    current = readUiConfig(raw);
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useUiConfig(): UiConfig {
    return useSyncExternalStore(subscribe, getUiConfig);
}
