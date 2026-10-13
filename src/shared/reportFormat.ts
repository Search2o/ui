export const CHART_COLOR_PRIMARY = { light: "#2a78d6", dark: "#3987e5" };
export const CHART_COLOR_DANGER = { light: "#d03b3b", dark: "#e66767" };

export function fmtDuration(ms?: number): string {
    if (ms == null) return "—";
    if (ms < 1000) return `${Math.round(ms)} ms`;
    const s = ms / 1000;
    return Number.isInteger(s) ? `${s} s` : `${s.toFixed(s < 10 ? 2 : 1)} s`;
}

export function fmtCost(v?: number): string {
    if (v == null || !Number.isFinite(v)) return "—";
    if (v === 0) return "$0";
    const digits = v >= 100 ? 0 : v >= 1 ? 2 : 4;
    return `$${v.toFixed(digits)}`;
}

export function fmtRate(v?: number): string {
    if (v == null || !Number.isFinite(v)) return "—";
    const pct = v * 100;
    return `${pct.toFixed(pct > 0 && pct < 10 ? 1 : 0)}%`;
}

export function fmtCount(v?: number): string {
    if (v == null || !Number.isFinite(v)) return "—";
    return v.toLocaleString();
}

export function ariaSort(
    active: boolean,
    dir: "asc" | "desc",
): "ascending" | "descending" | "none" {
    if (!active) return "none";
    return dir === "asc" ? "ascending" : "descending";
}

export function fmtEpoch(epochMs?: number): string {
    if (!epochMs) return "—";
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(epochMs));
}
