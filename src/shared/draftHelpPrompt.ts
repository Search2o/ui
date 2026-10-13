import type { ProfileInfoModel, ProfilesResponseModelProfiles } from "@/orval/search2o.schemas";
import { MAX_LENGTHS } from "@/shared/schemaRules";

export const DRAFT_HELP_MIN = 8;
export const DRAFT_HELP_MAX = MAX_LENGTHS.DRAFT_HELP_PROMPT.max;

const GROUP_ORDER: [string, string][] = [
    ["llm", "LLM"],
    ["prompt", "Prompt"],
    ["api", "API"],
    ["db", "Database"],
    ["mcp", "MCP"],
];

export type ProfileGroup = { type: string; label: string; profiles: ProfileInfoModel[] };

export function profileTypeLabel(type: string): string {
    return new Map(GROUP_ORDER).get(type) ?? type;
}

export function profileGroups(
    profiles: ProfilesResponseModelProfiles | null | undefined,
): ProfileGroup[] {
    if (!profiles) return [];
    const lists = new Map<string, ProfileInfoModel[]>();
    for (const [k, v] of Object.entries(profiles)) {
        if (Array.isArray(v)) lists.set(k, v as ProfileInfoModel[]);
    }
    const known = new Map(GROUP_ORDER);
    const keys = [
        ...GROUP_ORDER.map(([k]) => k).filter((k) => lists.has(k)),
        ...[...lists.keys()].filter((k) => !known.has(k)),
    ];
    return keys
        .map((type) => ({ type, label: known.get(type) ?? type, profiles: lists.get(type) ?? [] }))
        .filter((g) => g.profiles.length > 0);
}

export const AI_UNDO_DEPTH = 10;

export function pushAiUndo(stack: readonly string[], previous: string): string[] {
    return [...stack, previous].slice(-AI_UNDO_DEPTH);
}

export function popAiUndo(stack: readonly string[]): { previous: string | null; stack: string[] } {
    if (stack.length === 0) return { previous: null, stack: [] };
    return { previous: stack[stack.length - 1], stack: stack.slice(0, -1) };
}

export type UsedProfiles = Record<string, string[]>;

export function normalizeUsedProfiles(value: unknown): UsedProfiles {
    const out: UsedProfiles = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;
    for (const [type, names] of Object.entries(value as Record<string, unknown>)) {
        if (!Array.isArray(names)) continue;
        const clean = [
            ...new Set(
                names
                    .filter((n): n is string => typeof n === "string")
                    .map((n) => n.trim())
                    .filter(Boolean),
            ),
        ];
        if (clean.length) out[type] = clean;
    }
    return out;
}

export function sameUsedProfiles(a: UsedProfiles, b: UsedProfiles): boolean {
    const key = (p: UsedProfiles) =>
        Object.keys(p)
            .filter((type) => p[type].length > 0)
            .sort()
            .map((type) => `${type}:${[...p[type]].sort().join(",")}`)
            .join("|");
    return key(a) === key(b);
}

export function toggleUsedProfile(
    current: UsedProfiles,
    type: string,
    name: string,
    on: boolean,
): UsedProfiles {
    const names = current[type] ?? [];
    const nextNames = on
        ? names.includes(name)
            ? names
            : [...names, name]
        : names.filter((n) => n !== name);
    const next = { ...current };
    if (nextNames.length > 0) next[type] = nextNames;
    else delete next[type];
    return next;
}
