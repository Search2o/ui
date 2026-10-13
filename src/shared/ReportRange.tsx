export type ReportRange = { start: Date; end: Date; preset: RangePreset };

export type RangePreset =
    | "last1h"
    | "last6h"
    | "last24h"
    | "today"
    | "yesterday"
    | "last7d"
    | "last30d"
    | "thisMonth"
    | "prevMonth"
    | "last3"
    | "custom";

const now = () => new Date();

const startOfLocalDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const addMonths = (d: Date, m: number) => {
    const x = new Date(d);
    x.setMonth(x.getMonth() + m);
    return x;
};

const addDays = (d: Date, days: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

export const threeMonthsAgoMidnight = () => startOfLocalDay(addMonths(now(), -3));

export function presetRange(preset: Exclude<RangePreset, "custom">): ReportRange {
    return { ...windowFor(preset), preset };
}

function windowFor(preset: Exclude<RangePreset, "custom">): { start: Date; end: Date } {
    switch (preset) {
        case "last1h":
            return { start: hoursAgo(1), end: now() };
        case "last6h":
            return { start: hoursAgo(6), end: now() };
        case "last24h":
            return { start: hoursAgo(24), end: now() };
        case "today":
            return { start: startOfLocalDay(now()), end: now() };
        case "yesterday": {
            const todayStart = startOfLocalDay(now());
            return {
                start: startOfLocalDay(addDays(todayStart, -1)),
                end: new Date(todayStart.getTime() - 1),
            };
        }
        case "last7d":
            return { start: addDays(now(), -7), end: now() };
        case "last30d":
            return { start: addDays(now(), -30), end: now() };
        case "thisMonth":
            return {
                start: startOfLocalDay(new Date(now().getFullYear(), now().getMonth(), 1)),
                end: now(),
            };
        case "prevMonth":
            return {
                start: startOfLocalDay(new Date(now().getFullYear(), now().getMonth() - 1, 1)),
                end: startOfLocalDay(new Date(now().getFullYear(), now().getMonth(), 1)),
            };
        case "last3":
            return { start: threeMonthsAgoMidnight(), end: now() };
    }
}

export const defaultReportRange = (): ReportRange => presetRange("last3");

export const clampToBounds = (d: Date): Date => {
    const min = threeMonthsAgoMidnight();
    const max = now();
    if (d < min) return min;
    if (d > max) return max;
    return d;
};

export function rangeFromPayload(payload: {
    start?: number;
    end?: number;
    preset?: RangePreset;
}): ReportRange {
    if (payload.preset && payload.preset !== "custom") return presetRange(payload.preset);
    if (payload.start && payload.end && payload.end > payload.start) {
        return { start: new Date(payload.start), end: new Date(payload.end), preset: "custom" };
    }
    return defaultReportRange();
}
