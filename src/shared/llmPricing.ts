import type { ModelDetails } from "@/orval/search2o.schemas";

export const PRICE_FIELDS = [
    { key: "inputText", label: "Input text" },
    { key: "outputText", label: "Output text" },
    { key: "inputImage", label: "Input image" },
    { key: "outputImage", label: "Output image" },
] as const;

export type PriceField = (typeof PRICE_FIELDS)[number]["key"];

export type PriceText = Record<PriceField, string>;

export function priceToText(value?: number | null): string {
    return value == null || value === 0 ? "" : String(value);
}

export function pricingToText(pricing?: ModelDetails | null): PriceText {
    return {
        inputText: priceToText(pricing?.inputText),
        outputText: priceToText(pricing?.outputText),
        inputImage: priceToText(pricing?.inputImage),
        outputImage: priceToText(pricing?.outputImage),
    };
}

export function textToPricing(
    text: PriceText,
): { ok: true; value: ModelDetails | undefined } | { ok: false; error: string } {
    const details: ModelDetails = {};
    for (const field of PRICE_FIELDS) {
        const raw = (text[field.key] ?? "").trim();
        if (!raw) continue;
        const price = Number(raw);
        if (!Number.isFinite(price) || price < 0) {
            return { ok: false, error: `${field.label} price must be a number of 0 or more.` };
        }
        details[field.key] = price;
    }
    return { ok: true, value: Object.keys(details).length ? details : undefined };
}
