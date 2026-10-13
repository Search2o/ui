import * as API from "@/orval/search2o";
import { errorText } from "@/shared/apiError";
import { exemptFromSessionExpiry } from "@/shared/orvalFetcher";

const RETURN_PARAMS = [
    "code",
    "state",
    "error",
    "error_description",
    "error_uri",
    "iss",
    "session_state",
];

export type SsoReturn =
    { kind: "code"; code: string; state: string } | { kind: "error"; message: string };

export function ssoReturnFrom(search: string): SsoReturn | null {
    const params = new URLSearchParams(search);
    const error = params.get("error")?.trim();
    if (error) {
        const detail = params.get("error_description")?.trim();
        return { kind: "error", message: `Single sign-on did not complete: ${detail || error}` };
    }
    const code = params.get("code")?.trim();
    const state = params.get("state")?.trim();
    return code && state ? { kind: "code", code, state } : null;
}

export function clearSsoReturn(): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    let changed = false;
    for (const name of RETURN_PARAMS) {
        if (url.searchParams.has(name)) {
            url.searchParams.delete(name);
            changed = true;
        }
    }
    if (!changed) return;
    const search = url.searchParams.toString();
    window.history.replaceState(
        null,
        "",
        `${url.pathname}${search ? `?${search}` : ""}${url.hash}`,
    );
}

let captured: SsoReturn | null = null;

export function captureSsoReturn(): void {
    if (typeof window === "undefined") return;
    captured = ssoReturnFrom(window.location.search);
    if (captured) clearSsoReturn();
}

export function hadSsoReturn(): boolean {
    return captured !== null;
}

const NO_AUTO_KEY = "s2o.sso.noAuto";
let noAutoInMemory = false;

export function suppressAutoSso(): void {
    noAutoInMemory = true;
    try {
        sessionStorage.setItem(NO_AUTO_KEY, "1");
    } catch {}
}

export function allowAutoSso(): void {
    noAutoInMemory = false;
    try {
        sessionStorage.removeItem(NO_AUTO_KEY);
    } catch {}
}

export function autoSsoSuppressed(): boolean {
    if (noAutoInMemory) return true;
    try {
        return sessionStorage.getItem(NO_AUTO_KEY) === "1";
    } catch {
        return false;
    }
}

const CONNECT_KEY = "s2o.sso.connectId";

export function stashConnectId(connectId: string): void {
    try {
        sessionStorage.setItem(CONNECT_KEY, connectId);
    } catch {}
}

export function takeStashedConnectId(): string | null {
    try {
        const id = sessionStorage.getItem(CONNECT_KEY);
        sessionStorage.removeItem(CONNECT_KEY);
        return id?.trim() || null;
    } catch {
        return null;
    }
}

let exempted = false;
function exemptSignInCalls(): void {
    if (exempted) return;
    exempted = true;
    exemptFromSessionExpiry(API.getSsoStartUrl());
    exemptFromSessionExpiry(API.getSsoFinishUrl());
}

let navigate = (url: string) => window.location.assign(url);

export function setSsoNavigatorForTests(fn: (url: string) => void): void {
    navigate = fn;
}

let outcome: string | null = null;
let finishing: Promise<void> | null = null;

export function finishPendingSso(): Promise<void> {
    if (finishing) return finishing;
    finishing = (async () => {
        const pending = captured;
        if (!pending) return;
        if (pending.kind === "error") {
            outcome = pending.message;
            suppressAutoSso();
            return;
        }
        exemptSignInCalls();
        try {
            const resp = await API.ssoFinish({ code: pending.code, state: pending.state });
            if (resp.success) {
                outcome = null;
                allowAutoSso();
                return;
            }
            outcome = resp.error?.message || "Single sign-on failed.";
        } catch (e) {
            outcome = errorText(e, "Single sign-on failed.");
        }
        suppressAutoSso();
    })();
    return finishing;
}

export function ssoOutcomeMessage(): string | null {
    return outcome;
}

export async function startSso(
    options: { connectId?: string | null } = {},
): Promise<string | null> {
    exemptSignInCalls();
    outcome = null;
    try {
        const resp = await API.ssoStart();
        const url = resp.success ? resp.url?.trim() : "";
        if (!url) {
            suppressAutoSso();
            return resp.error?.message || "Single sign-on could not be started.";
        }
        if (options.connectId) stashConnectId(options.connectId);
        navigate(url);
        return null;
    } catch (e) {
        suppressAutoSso();
        return errorText(e, "Single sign-on could not be started.");
    }
}

export function resetSsoForTests(): void {
    captured = null;
    outcome = null;
    finishing = null;
    exempted = false;
    noAutoInMemory = false;
    navigate = (url: string) => window.location.assign(url);
    try {
        sessionStorage.removeItem(NO_AUTO_KEY);
        sessionStorage.removeItem(CONNECT_KEY);
    } catch {}
}
