import { useSyncExternalStore } from "react";
import { UI_TEXT_DEFAULTS, type UiTextKey } from "@/shared/uiTextDefaults";

let published: Record<string, string> = {};
const listeners = new Set<() => void>();

let version = 0;
const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};
const snapshot = () => version;

function interpolate(value: string): string {
    return value.replace(/\{([a-zA-Z0-9.]+)\}/g, (whole, key: string) => {
        const target = published[key] ?? UI_TEXT_DEFAULTS[key as UiTextKey];
        return typeof target === "string" ? target : whole;
    });
}

export function uiText(key: UiTextKey): string {
    return interpolate(published[key] ?? UI_TEXT_DEFAULTS[key]);
}

export function useUiText(): (key: UiTextKey) => string {
    useSyncExternalStore(subscribe, snapshot, snapshot);
    return uiText;
}

export function uiTextOptional(key: string): string | undefined {
    const value = published[key] ?? (UI_TEXT_DEFAULTS as Record<string, string>)[key];
    return value === undefined ? undefined : interpolate(value);
}

export function publishedPageHelp(pageKey: string): string | undefined {
    const value = published[`pageHelp.${pageKey}`];
    return value === undefined ? undefined : interpolate(value);
}

function warnOnUnknownKeys(text: Record<string, string>, version: string): void {
    const unknown = Object.keys(text).filter(
        (k) => !(k in UI_TEXT_DEFAULTS) && !k.startsWith("pageHelp."),
    );
    if (unknown.length) {
        console.error(
            `Published UI text ${version} carries ${unknown.length} key(s) this build does ` +
                `not use, so they have no effect: ${unknown.join(", ")}. They have probably ` +
                `been renamed here, or published ahead of the UI.`,
        );
    }
}

export function applyPublishedText(text: Record<string, string>, publishedVersion: string): void {
    if (!text || typeof text !== "object") return;

    published = text;
    warnOnUnknownKeys(published, publishedVersion);
    version += 1;
    for (const fn of listeners) fn();
}

export function resetUiText(): void {
    published = {};
    version += 1;
    for (const fn of listeners) fn();
}
