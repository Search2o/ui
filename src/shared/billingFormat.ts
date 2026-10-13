const UTC_DATE = { timeZone: "UTC" } as const;

const lastCoveredMs = (endMs: number) => endMs - 1;

export function periodMonth(startMs: number): string {
    const start = new Date(startMs);
    if (isNaN(start.getTime())) return "";
    return start.toLocaleDateString(undefined, { month: "long", year: "numeric", ...UTC_DATE });
}

export function periodRange(startMs: number, endMs: number): string {
    const start = new Date(startMs);
    const end = new Date(lastCoveredMs(endMs));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";

    const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
    const day = (d: Date, withYear: boolean) =>
        d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            ...(withYear ? { year: "numeric" } : {}),
            ...UTC_DATE,
        });

    return `${day(start, !sameYear)} – ${day(end, true)}`;
}
