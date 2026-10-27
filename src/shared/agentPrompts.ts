import type { AgentPromptModel } from "@/orval/search2o.schemas";
import { PromptScope } from "@/orval/search2o.schemas";
import { matchesRule, PROMPT_NAME, PROMPT_TEXT, textFieldsError } from "@/shared/schemaRules";
import { uiText } from "@/shared/uiText";

export type PromptRow = {
    uiId: string;
    name: string;
    system: string;
    user: string;
    scope: PromptScope;
    doc: string;
};

export const PROMPT_SCOPES: PromptScope[] = Object.values(PromptScope);

export function promptScopeHint(scope: PromptScope): string {
    switch (scope) {
        case "conversation":
            return uiText("prompt.scope.conversation");
        case "agent":
            return uiText("prompt.scope.agent");
        case "local":
            return uiText("prompt.scope.local");
    }
}

export function promptScopeLabel(scope: PromptScope): string {
    return scope.charAt(0).toUpperCase() + scope.slice(1);
}

export const DEFAULT_PROMPT_SCOPE: PromptScope = PromptScope.conversation;

let nextId = 0;
function makeId(): string {
    nextId += 1;
    return `prompt-${nextId}`;
}

export function promptRow(name: string, prompt: AgentPromptModel): PromptRow {
    return {
        uiId: makeId(),
        name,
        system: prompt.system ?? "",
        user: prompt.user ?? "",
        scope: prompt.scope ?? DEFAULT_PROMPT_SCOPE,
        doc: prompt.doc ?? "",
    };
}

export function newPromptRow(existing: PromptRow[]): PromptRow {
    const taken = new Set(existing.map((r) => r.name.trim()));
    let name = "prompt";
    for (let n = 2; taken.has(name); n++) name = `prompt${n}`;
    return { ...promptRow(name, {}), name };
}

export function promptRows(prompts: Record<string, AgentPromptModel> | null | undefined) {
    return Object.entries(prompts ?? {}).map(([name, prompt]) => promptRow(name, prompt));
}

export function promptModel(row: PromptRow): AgentPromptModel {
    return {
        scope: row.scope,
        ...(row.system.trim() ? { system: row.system } : {}),
        ...(row.user.trim() ? { user: row.user } : {}),
        ...(row.doc.trim() ? { doc: row.doc } : {}),
    };
}

export function promptMap(rows: PromptRow[]): Record<string, AgentPromptModel> {
    return Object.fromEntries(rows.map((r) => [r.name.trim(), promptModel(r)]));
}

export function samePrompts(a: PromptRow[], b: PromptRow[]): boolean {
    const canonical = (rows: PromptRow[]) =>
        JSON.stringify(
            Object.entries(promptMap(rows))
                .sort(([x], [y]) => x.localeCompare(y))
                .map(([name, p]) => [name, p.scope, p.system ?? "", p.user ?? "", p.doc ?? ""]),
        );
    return a.length === b.length && canonical(a) === canonical(b);
}

export function promptRowError(row: PromptRow): string | null {
    const name = row.name.trim();
    if (!name) return uiText("prompt.nameRequired");
    if (!matchesRule(PROMPT_NAME, name)) return `“${name}”: ${uiText("validate.promptName")}`;
    if (!row.system.trim() && !row.user.trim()) {
        return `“${name}”: ${uiText("prompt.needsText")}`;
    }
    const text = textFieldsError(PROMPT_TEXT, [
        { label: "system prompt", value: row.system },
        { label: "user prompt", value: row.user },
    ]);
    if (text) return `“${name}”: ${text}`;
    return null;
}

export function promptRowsError(rows: PromptRow[]): string | null {
    const seen = new Set<string>();
    for (const row of rows) {
        const error = promptRowError(row);
        if (error) return error;
        const name = row.name.trim();
        if (seen.has(name)) return `“${name}”: ${uiText("prompt.duplicateName")}`;
        seen.add(name);
    }
    return null;
}

export type PromptField = "system" | "user";

export function promptErrorTarget(path: string): { name: string; field?: PromptField } | null {
    const m = /^prompts\.'?([^.']+)'?(?:\.(system|user))?$/.exec(path.trim());
    if (!m) return null;
    return { name: m[1], field: m[2] as PromptField | undefined };
}
