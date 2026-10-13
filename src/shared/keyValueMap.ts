import type { ValueModel } from "@/orval/search2o.schemas";

export type KeyValueRow = {
    id: string;
    key: string;
    value: string;
    override: boolean;
};

export function makeKeyValueRow(): KeyValueRow {
    return {
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        key: "",
        value: "",
        override: false,
    };
}

export function rowsFromValueMap(
    map: Record<string, ValueModel> | undefined | null,
): KeyValueRow[] {
    return Object.entries(map ?? {}).map(([key, entry]) => ({
        ...makeKeyValueRow(),
        key,
        value: typeof entry === "string" ? entry : (entry?.value ?? ""),
        override: typeof entry === "string" ? false : Boolean(entry?.override),
    }));
}

export function rowsToValueMap(rows: KeyValueRow[]): Record<string, ValueModel> {
    const out: Record<string, ValueModel> = {};
    for (const row of rows) {
        const key = row.key.trim();
        if (!key) continue;
        out[key] = { value: row.value, override: row.override };
    }
    return out;
}

export function rowsFromTextMap(map: Record<string, string> | undefined | null): KeyValueRow[] {
    return Object.entries(map ?? {}).map(([key, value]) => ({
        ...makeKeyValueRow(),
        key,
        value: typeof value === "string" ? value : JSON.stringify(value ?? ""),
    }));
}

export function rowsToTextMap(rows: KeyValueRow[]): Record<string, string> | undefined {
    const out: Record<string, string> = {};
    for (const row of rows) {
        const key = row.key.trim();
        if (!key) continue;
        out[key] = row.value ?? "";
    }
    return Object.keys(out).length ? out : undefined;
}

export function rowsSnapshot(rows: KeyValueRow[]): [string, string, boolean][] {
    return rows.map((row) => [row.key, row.value, row.override]);
}
