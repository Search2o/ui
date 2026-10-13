const KEY = "ui.welcome.seen";

function readSeen(): string[] {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string") : [];
    } catch {
        return [];
    }
}

export function shouldShowWelcome(email: string | null | undefined): boolean {
    if (!email) return false;
    return !readSeen().includes(email);
}

export function markWelcomeSeen(email: string | null | undefined): void {
    if (!email) return;
    try {
        const seen = readSeen();
        if (seen.includes(email)) return;
        localStorage.setItem(KEY, JSON.stringify([...seen, email].slice(-20)));
    } catch {}
}

export function resetWelcomeSeen(): void {
    try {
        localStorage.removeItem(KEY);
    } catch {}
}
