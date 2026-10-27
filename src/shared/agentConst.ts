import { MAX_LENGTHS } from "@/shared/schemaRules";

export function constText(raw: string | null | undefined): string {
    const text = (raw ?? "").trim();
    if (!text) return "";
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}

export function constValue(raw: string | null | undefined): Record<string, unknown> | null {
    const text = (raw ?? "").trim();
    if (!text) return null;
    try {
        const parsed: unknown = JSON.parse(text);
        return isObject(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function constPayload(text: string): { value: string } | { error: string } {
    const trimmed = text.trim();
    if (!trimmed) return { value: "" };
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch (e) {
        return { error: `Const is not valid JSON: ${e instanceof Error ? e.message : e}` };
    }
    if (!isObject(parsed)) {
        return { error: 'Const must be a JSON object, such as {"region": "eu"}.' };
    }
    const value = JSON.stringify(parsed);
    const max = MAX_LENGTHS.AGENT_CONST.max;
    if ([...value].length > max) {
        return { error: `Const is longer than ${max.toLocaleString("en-US")} characters.` };
    }
    return { value };
}

export function sameConst(a: string, b: string): boolean {
    const canonical = (text: string) => {
        const result = constPayload(text);
        return "value" in result ? result.value : text.trim();
    };
    return canonical(a) === canonical(b);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function constKeys(text: string): string[] | null {
    if (!text.trim()) return [];
    const result = constPayload(text);
    if ("error" in result) return null;
    return Object.keys(JSON.parse(result.value) as Record<string, unknown>);
}
