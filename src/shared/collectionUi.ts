export function openNameSet<T extends { uiId: string; name: string }>(
    items: T[],
    openById: Record<string, boolean>,
): Set<string> {
    return new Set(
        items.filter((it) => openById[it.uiId] && it.name.trim()).map((it) => it.name.trim()),
    );
}

export function reopenByName<T extends { uiId: string; name: string }>(
    items: T[],
    openNames?: Set<string>,
): Record<string, boolean> {
    if (!openNames || openNames.size === 0) return {};
    const open: Record<string, boolean> = {};
    for (const it of items) {
        if (openNames.has(it.name.trim())) open[it.uiId] = true;
    }
    return open;
}

export function makeUiId(seed?: string): string {
    const randomPart = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    const safeSeed = (seed || "").trim();
    return safeSeed ? `${safeSeed}-${randomPart}` : randomPart;
}
