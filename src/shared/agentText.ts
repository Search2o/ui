import { applyEdits, format } from "jsonc-parser";

export function agentDisplayText(value: unknown): string {
    if (typeof value !== "string") {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }
    try {
        const edits = format(value, undefined, { tabSize: 2, insertSpaces: true, eol: "\n" });
        return applyEdits(value, edits);
    } catch {
        return value;
    }
}
