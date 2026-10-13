import { fmtLocalShort } from "@/shared/commonFuncs";
import { uiText } from "@/shared/uiText";

function instant(epochMs: number | undefined | null): string | null {
    if (typeof epochMs !== "number" || !Number.isFinite(epochMs) || epochMs <= 0) return null;
    return fmtLocalShort(epochMs) || null;
}

function sentence(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return "";
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function rotationRefusal(
    serverMessage: string | undefined | null,
    nextRotationAllowedAt: number | undefined | null,
    fallback: string,
): string {
    const parts: string[] = [sentence(serverMessage?.trim() || fallback)];

    const when = instant(nextRotationAllowedAt);
    if (when) {
        parts.push(`${uiText("encryption.rotate.nextAllowed")} ${when}.`);
    } else if (nextRotationAllowedAt !== undefined && nextRotationAllowedAt !== null) {
        console.error(
            "Encryption rotation was refused with an unusable nextRotationAllowedAt:",
            nextRotationAllowedAt,
        );
    }

    return parts.join(" ");
}

export function rotationSummary(
    rotatedAt: number | undefined | null,
    nextRotationAllowedAt: number | undefined | null,
): string | null {
    const done = instant(rotatedAt);
    const next = instant(nextRotationAllowedAt);
    if (!done && !next) return null;

    const parts: string[] = [];
    if (done) parts.push(`${uiText("encryption.rotate.rotatedAt")} ${done}.`);
    if (next) parts.push(`${uiText("encryption.rotate.nextAllowed")} ${next}.`);
    return parts.join(" ");
}
