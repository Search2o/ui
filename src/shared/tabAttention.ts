let baseTitle: string | null = null;

function clear(): void {
    if (baseTitle !== null) {
        document.title = baseTitle;
        baseTitle = null;
    }
    document.removeEventListener("visibilitychange", onVisibilityChange);
}

function onVisibilityChange(): void {
    if (!document.hidden) clear();
}

export function signalTabAttention(message: string): void {
    if (!document.hidden) return;
    if (baseTitle === null) baseTitle = document.title;
    document.title = `● ${message} — ${baseTitle}`;
    document.addEventListener("visibilitychange", onVisibilityChange);
}
