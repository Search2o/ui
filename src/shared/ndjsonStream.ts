import type { ErrorResponseModel } from "@/orval/search2o.schemas";
import { failureMessage } from "@/shared/usageLimit";

export async function readErrorMessage(res: Response): Promise<string> {
    try {
        const text = await res.text();
        if (!text) return "";
        try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            const envelope = (parsed.error ?? null) as ErrorResponseModel | null;
            const candidate = envelope?.message ?? parsed.detail ?? parsed.message;
            if (typeof candidate !== "string" || !candidate.trim()) return "";
            const message = candidate.trim();
            return envelope ? failureMessage({ ...envelope, message }, message) : message;
        } catch {}
    } catch {}
    return "";
}

export type NdjsonFrame = { type: string } & Record<string, unknown>;

export async function readNdjsonFrames(
    body: ReadableStream<Uint8Array>,
    handlers: {
        onFrame: (frame: NdjsonFrame) => boolean | void;
        onBadLine?: (error: unknown) => void;
    },
): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, nl).trim();
                buffer = buffer.slice(nl + 1);
                if (!line) continue;

                let frame: NdjsonFrame;
                try {
                    frame = JSON.parse(line) as NdjsonFrame;
                } catch (e) {
                    handlers.onBadLine?.(e);
                    continue;
                }
                if (handlers.onFrame(frame) === true) {
                    try {
                        await reader.cancel();
                    } catch {}
                    return;
                }
            }
        }

        const tail = buffer.trim();
        if (tail) {
            try {
                handlers.onFrame(JSON.parse(tail) as NdjsonFrame);
            } catch {}
        }
    } finally {
        try {
            reader.releaseLock();
        } catch {}
    }
}
