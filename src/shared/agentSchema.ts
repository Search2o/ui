import type { JsonValue } from "@/orval/search2o.schemas";
import { fetchDocsWebOnce } from "@/shared/docsWeb";

export type CommandGroup = {
    title: string;
    commands: string[];
};

export type AgentSchema = {
    jsonSchema: Record<string, JsonValue>;
    commandGroups: CommandGroup[];
    starterFields: Record<string, string[]>;
};

function warnOnMissingTables(schema: AgentSchema, version: string): void {
    const missing = (["commandGroups", "starterFields"] as const).filter((k) => !(k in schema));
    if (missing.length) {
        console.error(
            `Agent schema ${version} has no ${missing.join(" or ")}. ` +
                `Editor skeletons and command grouping will fall back to defaults; ` +
                `the published schema has probably renamed them. Keys present: ` +
                `${Object.keys(schema).join(", ")}.`,
        );
    }
}

export function getCachedAgentSchema(): AgentSchema | null {
    return lastLoaded;
}

let lastLoaded: AgentSchema | null = null;

export async function fetchAgentSchemaOnce(): Promise<AgentSchema | null> {
    const loaded = await fetchDocsWebOnce<AgentSchema>("agentschema");
    if (loaded) warnOnMissingTables(loaded.document, loaded.version);
    lastLoaded = loaded?.document ?? null;
    return lastLoaded;
}
