import type { AskInputModel, AskInputsModel } from "@/orval/search2o.schemas";
import { defaultFor } from "@/shared/askDefaults";

export type AskBlocks = { [key: string]: AskInputsModel | { [key: string]: unknown } };

export type AskAnswers = Record<string, string | string[]>;

export type AskBlockAnswers = { [key: string]: AskAnswers | AskBlockAnswers };

export const SINGLE_ASK_KEY = "ask_";

export function isAskBlock(value: unknown): value is AskInputsModel {
    return (
        typeof value === "object" &&
        value !== null &&
        Array.isArray((value as { inputs?: unknown }).inputs)
    );
}

export type FlatAskBlock = {
    path: string[];
    block: AskInputsModel;
};

export function flattenAskBlocks(
    tree: AskBlocks | null | undefined,
    path: string[] = [],
): FlatAskBlock[] {
    if (!tree || typeof tree !== "object") return [];
    const out: FlatAskBlock[] = [];
    for (const [key, value] of Object.entries(tree)) {
        const here = [...path, key];
        if (isAskBlock(value)) out.push({ path: here, block: value });
        else if (value && typeof value === "object") {
            out.push(...flattenAskBlocks(value as AskBlocks, here));
        }
    }
    return out;
}

export function hasAskBlocks(tree: unknown): tree is AskBlocks {
    return flattenAskBlocks(tree as AskBlocks | null).length > 0;
}

export function blockKey(path: string[]): string {
    return path.join("/");
}

export function blockDefaults(block: AskInputsModel): AskAnswers {
    return Object.fromEntries(
        (block.inputs ?? []).map((i: AskInputModel) => [i.name, defaultFor(i)]),
    );
}

export function initialAnswers(blocks: FlatAskBlock[]): Record<string, AskAnswers> {
    return Object.fromEntries(blocks.map((b) => [blockKey(b.path), blockDefaults(b.block)]));
}

export function nestAnswers(
    blocks: FlatAskBlock[],
    values: Record<string, AskAnswers>,
): AskBlockAnswers {
    const root: AskBlockAnswers = {};
    for (const b of blocks) {
        let node = root;
        for (const key of b.path.slice(0, -1)) {
            const next = node[key];
            if (next && typeof next === "object" && !isLeafAnswers(next))
                node = next as AskBlockAnswers;
            else {
                const made: AskBlockAnswers = {};
                node[key] = made;
                node = made;
            }
        }
        node[b.path[b.path.length - 1]] = values[blockKey(b.path)] ?? {};
    }
    return root;
}

function isLeafAnswers(v: AskAnswers | AskBlockAnswers): v is AskAnswers {
    return Object.values(v).some((x) => typeof x === "string" || Array.isArray(x));
}
