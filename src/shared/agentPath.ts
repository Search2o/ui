import { findNodeAtLocation, parseTree, type Node } from "jsonc-parser";

function splitTracePath(tracePath: string): string[] {
    const parts: string[] = [];
    let current = "";
    let quoted = false;

    for (const ch of tracePath) {
        if (ch === "'") {
            quoted = !quoted;
        } else if (ch === "." && !quoted) {
            if (current) parts.push(current);
            current = "";
        } else {
            current += ch;
        }
    }
    if (current) parts.push(current);
    return parts;
}

function rootOf(definition: string): Node | null {
    try {
        return parseTree(definition) ?? null;
    } catch {
        return null;
    }
}

export function tracePathToJsonPath(tracePath: string, definition: string): string[] | null {
    const root = rootOf(definition);
    if (!root) return null;

    const parts = splitTracePath(tracePath);
    if (parts.length === 0) return null;

    const resolved: string[] = ["functions"];
    if (!findNodeAtLocation(root, resolved)) return null;

    let i = 0;
    while (i < parts.length) {
        let matched = false;
        for (let take = parts.length - i; take >= 1; take--) {
            const candidate = parts.slice(i, i + take).join(".");
            if (findNodeAtLocation(root, [...resolved, candidate])) {
                resolved.push(candidate);
                i += take;
                matched = true;
                break;
            }
        }
        if (!matched) return null;
    }

    return resolved;
}

export type PathRange = { offset: number; length: number };

export function findPathRange(tracePath: string, definition: string): PathRange | null {
    const jsonPath = tracePathToJsonPath(tracePath, definition);
    if (!jsonPath) return null;
    try {
        const root = parseTree(definition);
        const node = root ? findNodeAtLocation(root, jsonPath) : undefined;
        return node ? { offset: node.offset, length: node.length } : null;
    } catch {
        return null;
    }
}
