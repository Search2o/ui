export function expiryDays(
    text: string,
    maxAgeDays: number | null,
): { ok: true; days: number | undefined } | { ok: false; reason: string } {
    const trimmed = text.trim();
    if (!trimmed) return { ok: true, days: undefined };
    const days = Number(trimmed);
    const range = maxAgeDays ? `1 to ${maxAgeDays}` : "1 or more";
    if (!Number.isInteger(days) || days < 1 || (maxAgeDays !== null && days > maxAgeDays)) {
        return { ok: false, reason: `Choose ${range} days.` };
    }
    return { ok: true, days };
}
