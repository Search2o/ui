const PARAM = "c";

export function connectIdFrom(search: string): string | null {
    const value = new URLSearchParams(search).get(PARAM)?.trim();
    return value ? value : null;
}

export function clearConnectId(): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PARAM)) return;
    url.searchParams.delete(PARAM);
    const search = url.searchParams.toString();
    window.history.replaceState(
        null,
        "",
        `${url.pathname}${search ? `?${search}` : ""}${url.hash}`,
    );
}

export function connectRequestIsLive(clientName: string | null | undefined): boolean {
    return !!clientName?.trim();
}
