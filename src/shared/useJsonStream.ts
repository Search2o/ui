import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiError, errorText } from "@/shared/apiError";
import { getApiBaseUrl, isAbortError } from "@/shared/commonFuncs";
import { joinBaseAndPath, unreachable } from "@/shared/orvalFetcher";
import { readErrorMessage, readNdjsonFrames } from "@/shared/ndjsonStream";
import type { ContentPartApi, TraceObject, TraceType } from "@/orval/search2o.schemas";
import { reportSessionExpired } from "@/shared/sessionExpiry";
import { uiText } from "@/shared/uiText";

export type StreamJsonMessage<TFinal = unknown> =
    | { type: "progress"; value: string }
    | { type: "trace"; traceType?: TraceType; value: TraceObject }
    | { type: "data"; value: ContentPartApi }
    | { type: "agent" | "draft"; value: TFinal };

type RawStreamFrame<TFinal> = StreamJsonMessage<TFinal> | { type: "noop" } | { type: "end" };

function isTerminal(type: StreamJsonMessage["type"]): boolean {
    return type === "agent" || type === "draft";
}

type StreamJsonHandlers<TFinal = unknown> = {
    onMessage?: (m: StreamJsonMessage<TFinal>) => void;
    onClose?: () => void;
    onError?: (err: unknown) => void;
};

type StreamJsonRequest<TFinal = unknown> = {
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
} & StreamJsonHandlers<TFinal>;

async function postJsonStream<TFinal = unknown>(req: StreamJsonRequest<TFinal>): Promise<void> {
    const { url, body, headers = {}, signal, onMessage, onClose, onError } = req;

    const finalUrl = joinBaseAndPath(getApiBaseUrl(), url);

    let res: Response;
    try {
        res = await fetch(finalUrl, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json", ...headers },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal,
        });
    } catch (err) {
        onError?.(err);
        return;
    }

    if (!res.ok) {
        if (res.status === 401) reportSessionExpired();
        const message = await readErrorMessage(res);
        const generic = `The server returned an error (${res.status} ${res.statusText}).`;
        onError?.(message ? new ApiError(message) : new Error(generic));
        return;
    }

    if (!res.body) {
        onError?.(
            new Error(`The server returned an empty response (${res.status} ${res.statusText}).`),
        );
        return;
    }

    try {
        await readNdjsonFrames(res.body, {
            onFrame: (raw) => {
                const frame = raw as RawStreamFrame<TFinal>;
                if (frame.type === "noop" || frame.type === "end") return false;
                onMessage?.(frame);
                return isTerminal(frame.type);
            },
            onBadLine: (e) => onError?.(new Error("Bad JSON line in the stream", { cause: e })),
        });
    } catch (err) {
        if (!isAbortError(err)) onError?.(err);
    } finally {
        onClose?.();
    }
}

export type UseJsonStreamState<TFinal = unknown> = {
    isStreaming: boolean;
    error: string | null;
    last?: StreamJsonMessage<TFinal>;
    final?: TFinal;
};

export function useJsonStream<TFinal = unknown>() {
    const [state, setState] = useState<UseJsonStreamState<TFinal>>({
        isStreaming: false,
        error: null,
    });

    const abortRef = useRef<AbortController | null>(null);
    const cancelledRef = useRef(false);

    const start = useCallback(
        (args: {
            url: string;
            body?: unknown;
            headers?: Record<string, string>;
            onMessage?: (m: StreamJsonMessage<TFinal>) => void;
            onError?: (err: unknown) => void;
            onClose?: (info: { cancelled: boolean }) => void;
        }) => {
            abortRef.current?.abort();
            abortRef.current = new AbortController();
            cancelledRef.current = false;

            setState({ isStreaming: true, error: null, last: undefined, final: undefined });

            let closed = false;
            const closeOnce = () => {
                if (closed) return;
                closed = true;
                setState((s) => ({ ...s, isStreaming: false }));
                args.onClose?.({ cancelled: cancelledRef.current });
            };

            void postJsonStream<TFinal>({
                url: args.url,
                body: args.body,
                headers: args.headers,
                signal: abortRef.current.signal,
                onMessage: (m) => {
                    args.onMessage?.(m);
                    setState((s) => ({
                        ...s,
                        last: m,
                        final: isTerminal(m.type) ? (m.value as TFinal) : s.final,
                    }));
                },
                onError: (e) => {
                    if (isAbortError(e) && cancelledRef.current) {
                        closeOnce();
                        return;
                    }

                    const thrown = e as { error?: { message?: unknown } };
                    const message = isAbortError(e)
                        ? uiText("run.connectionLost")
                        : typeof thrown?.error?.message === "string"
                          ? thrown.error.message
                          : errorText(e, unreachable());

                    toast.error(message);
                    setState((s) => ({ ...s, error: message }));
                    args.onError?.(e);
                    closeOnce();
                },
                onClose: closeOnce,
            });
        },
        [],
    );

    const cancel = useCallback(() => {
        if (!abortRef.current) return;
        cancelledRef.current = true;
        abortRef.current.abort();
        setState((s) => ({ ...s, isStreaming: false }));
    }, []);

    return useMemo(() => ({ ...state, start, cancel }), [state, start, cancel]);
}
