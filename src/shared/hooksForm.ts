import { AgentConfigPart, type HooksModel } from "@/orval/search2o.schemas";
import { IMPORT_PATH, matchesRule } from "@/shared/schemaRules";

export const HOOK_KEYS = [
    "onStart",
    "onEnd",
    "onAgentStart",
    "onAgentEnd",
    "onAgentError",
    "onAgentPublish",
    "onAgentDelete",
    "save",
    "restore",
    "deleteConversation",
    "vault",
    "encryptionKey",
    "beforeLlmCall",
    "afterLlmCall",
    "beforeApiCall",
] as const;
export type HookKey = (typeof HOOK_KEYS)[number];

export const HOOK_GROUPS: { title: string; keys: readonly HookKey[] }[] = [
    { title: "Agent server", keys: ["onStart", "onEnd"] },
    { title: "Agent runs", keys: ["onAgentStart", "onAgentEnd", "onAgentError"] },
    { title: "Publishing", keys: ["onAgentPublish", "onAgentDelete"] },
    { title: "Conversation state", keys: ["save", "restore", "deleteConversation"] },
    { title: "Secrets and encryption", keys: ["vault", "encryptionKey"] },
    { title: "Model and API calls", keys: ["beforeLlmCall", "afterLlmCall", "beforeApiCall"] },
];

export const VALIDATOR_PARTS: AgentConfigPart[] = Object.values(AgentConfigPart);

export type HooksForm = {
    hooks: Record<HookKey, string>;
    llmAdapters: string;
    validators: Record<AgentConfigPart, string>;
};

export function examplePath(key: string): string {
    return `mycompany.hooks.${key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`;
}

export function hooksToForm(model: HooksModel | null | undefined): HooksForm {
    const m = model ?? {};
    const hooks = Object.fromEntries(HOOK_KEYS.map((k) => [k, m[k] ?? ""])) as Record<
        HookKey,
        string
    >;
    const validators = Object.fromEntries(
        VALIDATOR_PARTS.map((p) => [p, m.agentConfigValidators?.[p] ?? ""]),
    ) as Record<AgentConfigPart, string>;
    return {
        hooks,
        llmAdapters: (m.llmAdapters ?? []).join("\n"),
        validators,
    };
}

export function adapterLines(text: string): string[] {
    return text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
}

export function invalidPaths(form: HooksForm): {
    hooks: HookKey[];
    adapters: string[];
    validators: AgentConfigPart[];
} {
    const bad = (v: string) => v.trim() !== "" && !matchesRule(IMPORT_PATH, v);
    return {
        hooks: HOOK_KEYS.filter((k) => bad(form.hooks[k])),
        adapters: adapterLines(form.llmAdapters).filter(bad),
        validators: VALIDATOR_PARTS.filter((p) => bad(form.validators[p])),
    };
}

export function hasInvalidPaths(form: HooksForm): boolean {
    const i = invalidPaths(form);
    return i.hooks.length > 0 || i.adapters.length > 0 || i.validators.length > 0;
}

export function formToHooks(form: HooksForm): HooksModel {
    const hooks = Object.fromEntries(
        HOOK_KEYS.map((k) => [k, form.hooks[k].trim() || null]),
    ) as Record<HookKey, string | null>;
    const agentConfigValidators = Object.fromEntries(
        VALIDATOR_PARTS.flatMap((p) => {
            const v = form.validators[p].trim();
            return v ? [[p, v]] : [];
        }),
    ) as HooksModel["agentConfigValidators"];
    return {
        type: "hooks",
        ...hooks,
        llmAdapters: adapterLines(form.llmAdapters),
        agentConfigValidators,
    };
}
