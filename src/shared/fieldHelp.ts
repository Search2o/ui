import { useEffect, useState } from "react";

type SchemaProperty = { description?: string; title?: string; [key: string]: unknown };
type SchemaModel = { properties?: Record<string, SchemaProperty> };
type OpenApiSchema = { components?: { schemas?: Record<string, SchemaModel> } };

let cached: Map<string, string> | null = null;
let inflight: Promise<Map<string, string>> | null = null;

export function modelKey(model: string): string {
    return model.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const titles = new Map<string, string>();

let knownModels = new Set<string>();

function build(doc: OpenApiSchema): Map<string, string> {
    const map = new Map<string, string>();
    const schemas = doc.components?.schemas ?? {};
    knownModels = new Set(Object.keys(schemas).map(modelKey));
    for (const [modelName, model] of Object.entries(schemas)) {
        for (const [propName, prop] of Object.entries(model.properties ?? {})) {
            const title = prop?.title;
            if (typeof title === "string" && title.trim()) {
                const key = `${modelKey(modelName)}.${propName}`;
                if (!titles.has(key)) titles.set(key, title.trim());
            }
            const description = prop?.description;
            if (typeof description === "string" && description.trim()) {
                const key = `${modelKey(modelName)}.${propName}`;
                if (!map.has(key)) map.set(key, description.trim());
            }
        }
    }
    return map;
}

async function loadFieldHelp(): Promise<Map<string, string>> {
    if (cached) return cached;
    if (!inflight) {
        inflight = import("@/schema/openapi.json")
            .then((mod) => {
                cached = build((mod.default ?? mod) as OpenApiSchema);
                return cached;
            })
            .catch(() => {
                cached = new Map();
                return cached;
            });
    }
    return inflight;
}

export function useFieldHelp(...models: string[]): (field: string) => string | undefined {
    const [map, setMap] = useState<Map<string, string> | null>(cached);

    useEffect(() => {
        if (map) return;
        let alive = true;
        void loadFieldHelp().then((m) => {
            if (alive) setMap(m);
        });
        return () => {
            alive = false;
        };
    }, [map]);

    const key = models.join("|");
    return (field: string) => {
        if (!map) return undefined;
        const names = key.split("|");
        for (const model of names) {
            const hit = map.get(`${modelKey(model)}.${field}`);
            if (hit) return hit;
        }
        warnUnresolved(names, field);
        return undefined;
    };
}

const warned = new Set<string>();

function warnUnresolved(models: string[], field: string) {
    if (!import.meta.env.DEV) return;
    const id = `${models.join(",")}.${field}`;
    if (warned.has(id)) return;
    warned.add(id);
    const unknown = models.filter((m) => !knownModels.has(modelKey(m)));
    console.warn(
        unknown.length
            ? `[fieldHelp] No such model in the API schema: ${unknown.join(", ")} (field "${field}").`
            : `[fieldHelp] "${field}" is not a documented property of ${models.join(" / ")}.`,
    );
}

export function useFieldTitle(...models: string[]): (field: string, fallback?: string) => string {
    useFieldHelp(...models);
    return (field: string, fallback = "") => {
        for (const model of models) {
            const hit = titles.get(`${modelKey(model)}.${field}`);
            if (hit) return hit;
        }
        return fallback;
    };
}
