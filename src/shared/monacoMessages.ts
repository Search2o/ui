import type * as monacoT from "monaco-editor";
import { EXPR_CHARACTERS_RULE, EXPR_TEXT } from "@/shared/schemaRules";

const PATTERN_MESSAGE = /^String does not match the pattern of "(.*)"\.$/s;

type Subject = "value" | "name";

type PatternRule = { subject: Subject; rule: string };

const PATTERN_RULES: Record<string, PatternRule> = {
    "^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]$": {
        subject: "name",
        rule: "must start with a letter, end with a letter or a number, and contain only letters, numbers and underscores",
    },
    "^(?:|[a-z0-9]+(?:_[a-z0-9]+)*)$": {
        subject: "value",
        rule: "may contain only lowercase letters, numbers and underscores, and cannot start or end with an underscore. Leave it empty to match every tag",
    },
    "^\\{[\\x09\\x0A\\x0D\\x20-\\x7E]+\\}$": {
        subject: "value",
        rule: "must be an expression wrapped in braces, for example { sys.query }",
    },
    [EXPR_TEXT.pattern]: { subject: "value", rule: EXPR_CHARACTERS_RULE },
    "^(?:\\s*(?:[^{\\s][\\s\\S]*)?|[\\s\\S]*[^\\s}]\\s*)$": {
        subject: "value",
        rule: "must be plain text, not an expression in braces",
    },
    "^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9](?:\\.[A-Za-z0-9](?:[A-Za-z0-9_]*[A-Za-z0-9])?)?$": {
        subject: "name",
        rule: "must be a command, optionally followed by a suffix so the same command can be used twice in one block, such as api.2",
    },
    "^(?:(agent|conv)\\.)?([A-Za-z](?:[A-Za-z0-9_]*[A-Za-z0-9])?)((?:\\[(?:-?\\d{1,10}|'[\\x20-\\x26\\x28-\\x7E]{0,100}')\\])*)$":
        {
            subject: "name",
            rule: "must be a variable name — optionally prefixed with agent. or conv., and optionally indexed, such as items[0] or row['name']",
        },
};

const PATTERN_HINTS: [string, PatternRule][] = [
    [
        "str|int|float|bool|null|any",
        {
            subject: "value",
            rule: "must be a type such as str, int, list[str] or dict[str, any]",
        },
    ],
];

function ruleFor(pattern: string): PatternRule | null {
    const exact = PATTERN_RULES[pattern];
    if (exact) return exact;
    for (const [marker, rule] of PATTERN_HINTS) if (pattern.includes(marker)) return rule;
    return null;
}

export function friendlyJsonMessage(message: string): string | null {
    const match = PATTERN_MESSAGE.exec(message);
    if (!match) return null;
    const pattern = match[1];
    const known = ruleFor(pattern);
    if (!known) {
        warnUnknownPattern(pattern);
        return "This value is not in the expected format.";
    }
    return `This ${known.subject} ${known.rule}.`;
}

const warnedPatterns = new Set<string>();
function warnUnknownPattern(pattern: string): void {
    if (!import.meta.env.DEV || warnedPatterns.has(pattern)) return;
    warnedPatterns.add(pattern);
    console.warn(
        `[monacoMessages] No friendly rule for the schema pattern ${pattern} — the reader is being told only that the format is wrong.`,
    );
}

const JSON_OWNER = "json";

let installed: monacoT.IDisposable | null = null;

export function installFriendlyJsonMessages(monaco: typeof monacoT): void {
    if (installed) return;
    installed = monaco.editor.onDidChangeMarkers((uris) => {
        for (const uri of uris) {
            const model = monaco.editor.getModel(uri);
            if (!model) continue;
            const markers = monaco.editor.getModelMarkers({ resource: uri, owner: JSON_OWNER });
            let changed = false;
            const next = markers.map((marker) => {
                const friendly = friendlyJsonMessage(marker.message);
                if (!friendly) return marker;
                changed = true;
                return { ...marker, message: friendly };
            });
            if (changed) monaco.editor.setModelMarkers(model, JSON_OWNER, next);
        }
    });
}
