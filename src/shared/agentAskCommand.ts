const ASK_COMMAND = /^ask(\.\d+)?$/;

export function definitionHasAskCommand(definition: unknown): boolean {
    if (typeof definition === "string") {
        try {
            return definitionHasAskCommand(JSON.parse(definition) as unknown);
        } catch {
            return false;
        }
    }
    return walk(definition, false);
}

function walk(node: unknown, insideCommands: boolean): boolean {
    if (Array.isArray(node)) return node.some((item) => walk(item, false));
    if (node === null || typeof node !== "object") return false;

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (insideCommands && ASK_COMMAND.test(key)) return true;
        if (walk(value, key === "commands")) return true;
    }
    return false;
}
