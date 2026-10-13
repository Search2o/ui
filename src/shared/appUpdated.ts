import { hasUnsavedWork } from "@/shared/sessionExpiry";

const MODULE_LOAD_FAILURE =
    /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css|loading chunk \S+ failed/i;

export function isModuleLoadError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return MODULE_LOAD_FAILURE.test(message);
}

const RELOAD_MARK = "ui.updateReloadAt";
const RELOAD_COOLDOWN_MS = 60_000;

export function tryReloadForNewVersion(): boolean {
    if (hasUnsavedWork()) return false;

    try {
        const last = Number(sessionStorage.getItem(RELOAD_MARK) ?? 0);
        if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) return false;
        sessionStorage.setItem(RELOAD_MARK, String(Date.now()));
    } catch {
        return false;
    }

    window.location.reload();
    return true;
}
