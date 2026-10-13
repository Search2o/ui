import { useEffect, useState } from "react";
import { modelKey } from "@/shared/fieldHelp";
import { uiText } from "@/shared/uiText";

type Node = Record<string, unknown>;
type Doc = { components?: { schemas?: Record<string, Node> } };

export type DynamicFields = {
    field: (name: string) => boolean;
    entryValue: (name: string) => boolean;
};

type Index = { fields: Set<string>; entryValues: Set<string> };

const asObject = (v: unknown): Node | null =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Node) : null;

function isDynamicDef(def: Node): boolean {
    const pattern = typeof def.pattern === "string" ? def.pattern : null;
    if (pattern) {
        try {
            return new RegExp(pattern).test("{ x }");
        } catch {
            return false;
        }
    }
    const text = `${def.title ?? ""} ${def.description ?? ""}`.toLowerCase();
    return text.includes("python expression");
}

function refName(node: unknown): string | null {
    const obj = asObject(node);
    if (!obj) return null;
    if (typeof obj.$ref === "string") return obj.$ref.split("/").pop() ?? null;
    for (const key of ["anyOf", "oneOf", "allOf"]) {
        const branches = obj[key];
        if (Array.isArray(branches)) {
            for (const branch of branches) {
                const name = refName(branch);
                if (name) return name;
            }
        }
    }
    return null;
}

function build(doc: Doc): Index {
    const schemas = doc.components?.schemas ?? {};
    const dynamic = new Set(
        Object.entries(schemas)
            .filter(([, def]) => isDynamicDef(def))
            .map(([name]) => name),
    );
    const isDynamic = (node: unknown) => {
        const name = refName(node);
        return Boolean(name && dynamic.has(name));
    };

    const index: Index = { fields: new Set(), entryValues: new Set() };
    for (const [modelName, model] of Object.entries(schemas)) {
        const props = asObject(model.properties);
        if (!props) continue;
        for (const [propName, prop] of Object.entries(props)) {
            const key = `${modelKey(modelName)}.${propName}`;
            if (isDynamic(prop)) index.fields.add(key);

            const entry = asObject(prop)?.additionalProperties;
            if (!entry) continue;
            if (isDynamic(entry)) {
                index.entryValues.add(key);
                continue;
            }
            const entryModel = asObject(schemas[refName(entry) ?? ""]);
            const entryValue = asObject(entryModel?.properties)?.value;
            if (entryValue && isDynamic(entryValue)) index.entryValues.add(key);
        }
    }
    return index;
}

export function dynamicIndexForTest(doc: unknown): Index {
    return build(doc as Doc);
}

let cached: Index | null = null;
let inflight: Promise<Index> | null = null;

async function loadIndex(): Promise<Index> {
    if (cached) return cached;
    if (!inflight) {
        inflight = import("@/schema/openapi.json")
            .then((mod) => {
                cached = build((mod.default ?? mod) as Doc);
                return cached;
            })
            .catch(() => {
                cached = { fields: new Set(), entryValues: new Set() };
                return cached;
            });
    }
    return inflight;
}

export function useDynamicFields(model: string): DynamicFields {
    const [index, setIndex] = useState<Index | null>(cached);

    useEffect(() => {
        if (index) return;
        let alive = true;
        void loadIndex().then((i) => {
            if (alive) setIndex(i);
        });
        return () => {
            alive = false;
        };
    }, [index]);

    const prefix = `${modelKey(model)}.`;
    return {
        field: (name) => Boolean(index?.fields.has(prefix + name)),
        entryValue: (name) => Boolean(index?.entryValues.has(prefix + name)),
    };
}

export function dynamicFieldTitle(): string {
    return uiText("help.dynamicExpression");
}
