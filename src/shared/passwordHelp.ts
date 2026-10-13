import { useEffect, useState } from "react";
import * as API from "@/orval/search2o";

let cached: string | null = null;
let inflight: Promise<string | null> | null = null;

export function invalidatePasswordHelp(): void {
    cached = null;
    inflight = null;
}

async function fetchPasswordHelp(): Promise<string | null> {
    if (cached !== null) return cached;

    inflight ??= (async () => {
        try {
            const resp = await API.getPasswordHelp();
            if (!resp.success) return null;
            const text = (resp.passwordHelp ?? "").trim();
            cached = text || null;
            return cached;
        } catch {
            return null;
        } finally {
            inflight = null;
        }
    })();

    return inflight;
}

export function usePasswordHelp(): string | null {
    const [help, setHelp] = useState<string | null>(cached);

    useEffect(() => {
        let cancelled = false;
        void fetchPasswordHelp().then((text) => {
            if (!cancelled) setHelp(text);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return help;
}
