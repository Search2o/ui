import type { AskInputModel } from "@/orval/search2o.schemas";

export function defaultForMany(def: string | null | undefined, options: string[]): string[] {
    if (!def) return [];
    const allowed = new Set(options);
    const picked = def
        .split(",")
        .map((s) => s.trim())
        .filter((s) => allowed.has(s));
    if (picked.length > 0) return picked;
    return allowed.has(def) ? [def] : [];
}

export function defaultFor(input: AskInputModel): string | string[] {
    const options = input.options ?? [];
    const def = input.default ?? null;
    if (input.type === "chooseMany") return defaultForMany(def, options);
    if (input.type === "chooseOne") return def ?? options[0] ?? "";
    return def ?? "";
}
