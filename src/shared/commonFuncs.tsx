export const fmtLocalShort = (value: string | number | Date): string => {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export function localDatetime(epochMs: number): string {
    return fmtLocalShort(epochMs);
}

export function isAbortError(e: unknown): boolean {
    if (!e || typeof e !== "object") return false;
    const anyErr = e as { name?: string };
    return anyErr.name === "AbortError";
}

function loadApiBaseUrl(): string {
    if (typeof document === "undefined") return "";
    const el = document.querySelector('meta[name="search2o-ui-config"]') as HTMLMetaElement | null;
    const raw = el?.content?.trim();
    if (!raw) return "";
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
        const apiBase = (parsed as Record<string, unknown>).apiBase;
        return typeof apiBase === "string" ? apiBase.trim() : "";
    } catch {
        return "";
    }
}

const API_BASE_URL = loadApiBaseUrl();

export function getApiBaseUrl(): string {
    return API_BASE_URL;
}
