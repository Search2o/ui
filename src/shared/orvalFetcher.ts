import { getApiBaseUrl, isAbortError } from "@/shared/commonFuncs";
import { getUiConfig } from "@/shared/uiConfig";
import { reportSessionExpired } from "@/shared/sessionExpiry";
import { withResetTime } from "@/shared/usageLimit";

export type OrvalFetcherOptions = RequestInit;

export function joinBaseAndPath(base: string, pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${b}${p}`;
}

export const unreachable = (): string => "Could not reach the agent server.";

function explainFetchError(err: unknown): string {
    if (!isAbortError(err)) console.error("Fetch failed:", err);
    return unreachable();
}

function parseJsonOrError<T>(
    text: string,
    fallback: string,
): T | { success: false; error: { message: string } } {
    try {
        return JSON.parse(text) as T;
    } catch {
        return { success: false, error: { message: fallback } };
    }
}

const JSON_OK_STATUSES = new Set([200, 201, 202, 203, 204, 206, 207, 208, 226]);
const JSON_ERROR_STATUSES = new Set([400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504]);

const NO_SESSION_EXPIRY = new Set<string>();

export function exemptFromSessionExpiry(url: string): void {
    NO_SESSION_EXPIRY.add(url);
}

export async function orvalFetcher<T>(url: string, options: OrvalFetcherOptions = {}): Promise<T> {
    const { signal: callerSignal, ...restOptions } = options;
    const base = getApiBaseUrl();
    const timeoutSeconds = getUiConfig().apiTimeoutSeconds;
    const finalUrl = joinBaseAndPath(base, url);

    const controller = new AbortController();
    let timeoutId: number | undefined;

    if (!callerSignal && Number(timeoutSeconds) > 0) {
        timeoutId = window.setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    }

    if (callerSignal) {
        if (callerSignal.aborted) {
            controller.abort(callerSignal.reason);
        } else {
            callerSignal.addEventListener("abort", () => controller.abort(callerSignal.reason));
        }
    }

    try {
        const res = await fetch(finalUrl, {
            ...restOptions,
            credentials: "include",
            signal: controller.signal,
        });

        const text = await res.text();

        if (JSON_OK_STATUSES.has(res.status)) {
            if (!text) return { success: true } as unknown as T;
            return parseJsonOrError<T>(text, unreachable()) as T;
        }

        if (JSON_ERROR_STATUSES.has(res.status)) {
            const body = parseJsonOrError<T>(text, unreachable());
            withResetTime(body);
            if (res.status === 401 && !NO_SESSION_EXPIRY.has(url)) reportSessionExpired();
            return body as T;
        }

        console.error(`Unexpected HTTP ${res.status} from ${finalUrl}`);
        return { success: false, error: { message: unreachable() } } as unknown as T;
    } catch (err: unknown) {
        const explanation = explainFetchError(err);
        return { success: false, error: { message: `${explanation}` } } as unknown as T;
    } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
}
