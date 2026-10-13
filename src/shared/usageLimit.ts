import type { ErrorResponseModel } from "@/orval/search2o.schemas";
import { fmtLocalShort } from "@/shared/commonFuncs";

const SECONDS_CEILING = 1e11;

export function usageLimitResetAt(error: ErrorResponseModel | null | undefined): number | null {
    const data = error?.data;
    const raw = data?.["resetAt"];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
        if (data && Object.keys(data).length > 0) {
            console.error("Usage limit detail carried no usable resetAt:", data);
        }
        return null;
    }
    return raw < SECONDS_CEILING ? raw * 1000 : raw;
}

export function formatResetAt(epochMs: number, now: number = Date.now()): string {
    const at = new Date(epochMs);
    if (isNaN(at.getTime())) return "";
    const today = new Date(now);
    const sameDay =
        at.getFullYear() === today.getFullYear() &&
        at.getMonth() === today.getMonth() &&
        at.getDate() === today.getDate();

    return sameDay
        ? at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
        : fmtLocalShort(at);
}

export function failureMessage(
    error: ErrorResponseModel | null | undefined,
    fallback: string,
    now: number = Date.now(),
): string {
    const message = error?.message?.trim() || fallback;
    const resetAt = usageLimitResetAt(error);
    if (resetAt === null) return message;

    const when = formatResetAt(resetAt, now);
    if (!when) return message;
    const joined = /[.!?]$/.test(message) ? message : `${message}.`;
    return `${joined} You can try again after ${when}.`;
}

export function withResetTime(body: unknown): void {
    if (!body || typeof body !== "object") return;
    const error = (body as { error?: ErrorResponseModel | null }).error;
    if (!error || typeof error.message !== "string") return;
    if (usageLimitResetAt(error) === null) return;
    error.message = failureMessage(error, error.message);
}
