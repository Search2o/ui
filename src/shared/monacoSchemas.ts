import {
    getCachedAgentSchema,
    type AgentSchema,
    type CommandGroup as SchemaCommandGroup,
} from "@/shared/agentSchema";
import type * as monacoT from "monaco-editor";
import { installFriendlyJsonMessages } from "@/shared/monacoMessages";
import {
    findNodeAtOffset,
    getLocation,
    getNodeValue,
    type Location,
    type Node,
    parseTree,
    type Segment,
} from "jsonc-parser";

export type Suggestion = {
    name: string;
    insertText: string;
    documentation: string;
};

const FILE_MATCHES = [
    "inmemory://drafts/agent.jsonc",
    "inmemory://drafts/*.jsonc",
    "inmemory://drafts/*.agent.jsonc",
];

const SCHEMA_URI = "inmemory://model/agent.schema.json";

let inlineProviderDisposable: monacoT.IDisposable | null = null;
let reindentCommandDisposable: monacoT.IDisposable | null = null;

const REINDENT_LINE_COMMAND = "s2o.reindentCompletedLine";

export function ensureMonacoSchemas(monaco: typeof monacoT): void {
    const agentSchema = getCachedAgentSchema();

    monaco.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        comments: "ignore",
        trailingCommas: "ignore",
        schemaValidation: "error",
        schemas: agentSchema
            ? [
                  {
                      uri: SCHEMA_URI,
                      fileMatch: FILE_MATCHES,
                      schema: agentSchema.jsonSchema,
                  },
              ]
            : [],
    });
    installAgentSchemaUX(monaco);
    installFriendlyJsonMessages(monaco);
    monaco.json.jsonDefaults.setModeConfiguration({
        completionItems: false,
        hovers: false,
        documentSymbols: true,
        colors: true,
        foldingRanges: true,
        diagnostics: true,
        selectionRanges: true,
        tokens: true,
        documentFormattingEdits: true,
    });
}

function lineCommentStart(line: string): number {
    let inString = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inString) {
            if (ch === "\\") i++;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === "/" && line[i + 1] === "/") return i;
    }
    return -1;
}

function lastSignificantBefore(text: string, offset: number): number {
    let i = Math.min(offset, text.length) - 1;
    while (i >= 0) {
        const ch = text[i];
        if (/\s/.test(ch)) {
            i--;
            continue;
        }
        const lineStart = text.lastIndexOf("\n", i) + 1;
        const commentAt = lineCommentStart(text.slice(lineStart, i + 1));
        if (commentAt >= 0) {
            i = lineStart + commentAt - 1;
            continue;
        }
        return i;
    }
    return -1;
}

function needsCommaBefore(text: string, offset: number): number | null {
    const i = lastSignificantBefore(text, offset);
    if (i < 0) return null;
    const ch = text[i];
    return ch === "," || ch === "{" || ch === "[" || ch === ":" ? null : i + 1;
}

function patchMissingComma(text: string, insertBefore: number): string | null {
    const at = needsCommaBefore(text, insertBefore);
    if (at === null) return null;
    return `${text.slice(0, at)},${text.slice(at)}`;
}

export function commaRepairEdit(
    model: monacoT.editor.ITextModel,
    position: monacoT.IPosition,
): monacoT.editor.ISingleEditOperation | null {
    const at = needsCommaBefore(model.getValue(), model.getOffsetAt(position));
    if (at === null) return null;
    const where = model.getPositionAt(at);
    return {
        range: {
            startLineNumber: where.lineNumber,
            startColumn: where.column,
            endLineNumber: where.lineNumber,
            endColumn: where.column,
        },
        text: ",",
    };
}

export const SuggestMode = {
    NewTask: "NewTask",
    Func: "Func",
    FuncArg: "FuncArg",
    CommandBlock: "CommandBlock",
    Command: "Command",
    ObjectInList: "ObjectInList",
    ObjectExpected: "ObjectExpected",
    FunctionCall: "FunctionCall",
    FunctionCallArg: "FunctionCallArg",
    Unknown: "Unknown",
} as const;
export type SuggestMode = (typeof SuggestMode)[keyof typeof SuggestMode];

function commandBase(seg: Segment | undefined): string | null {
    return typeof seg === "string" ? seg.split(".")[0] : null;
}

export const CARET_MARK = "\u0000";

const COMMAND_LIST_DEF = "CommandListModel";

type SchemaNode = Record<string, unknown>;

const asObj = (v: unknown): SchemaNode | null =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as SchemaNode) : null;

function schemaDefs(schema: AgentSchema): SchemaNode | null {
    return asObj(asObj(schema.jsonSchema)?.["$defs"]);
}

function refNameOf(node: unknown): string | null {
    const obj = asObj(node);
    if (!obj) return null;
    if (typeof obj["$ref"] === "string") return (obj["$ref"] as string).split("/").pop() ?? null;
    if (Array.isArray(obj["anyOf"])) {
        for (const arm of obj["anyOf"]) {
            const a = asObj(arm);
            if (a && a["type"] !== "null") return refNameOf(a);
        }
    }
    return null;
}

function effectiveNode(node: unknown): SchemaNode | null {
    const obj = asObj(node);
    if (!obj) return null;
    if (obj["type"] != null || obj["$ref"] != null || obj["enum"] != null) return obj;
    if (Array.isArray(obj["anyOf"])) {
        for (const arm of obj["anyOf"]) {
            const a = asObj(arm);
            if (a && a["type"] !== "null") return a;
        }
    }
    return obj;
}

function fieldDefault(node: unknown, defs?: SchemaNode): string {
    const obj = asObj(node);
    if (obj && "default" in obj && obj["default"] != null) return JSON.stringify(obj["default"]);

    const eff = effectiveNode(node);
    const ref = refNameOf(node);
    if (ref === "PythonExpr" || ref?.startsWith("ExprString")) return '"{  }"';
    if (ref === COMMAND_LIST_DEF || ref === "DynamicDict") return "{}";
    if (ref === "DynamicValue" || ref === "DynamicJson" || ref === "JsonValue") return "{  }";
    if (ref) return "{}";

    if (Array.isArray(eff?.["enum"]) && eff["enum"].length > 0)
        return JSON.stringify(eff["enum"][0]);
    switch (eff?.["type"]) {
        case "string":
            return '""';
        case "integer":
        case "number":
            return "0";
        case "boolean":
            return "false";
        case "array": {
            const itemDef = refNameOf(asObj(node)?.["items"]);
            const holdsObjects = !!(defs && itemDef && asObj(defs[itemDef])?.["properties"]);
            return holdsObjects ? `[\n{\n${CARET_MARK}\n}\n]` : "[]";
        }
        default:
            return "{}";
    }
}

function fieldLine(name: string, node: unknown, defs?: SchemaNode): string {
    return `"${name}": ${fieldDefault(node, defs)},`;
}

function defFieldSuggestions(
    defs: SchemaNode,
    defName: string | null,
    expected = false,
): Suggestion[] {
    if (expected && !((defName ?? "") in defs)) {
        console.error(
            `Agent schema has no ${defName}. The fields it names will not be offered; ` +
                `the published schema has probably renamed it.`,
        );
    }
    const props = asObj(asObj(defs[defName ?? ""])?.["properties"]);
    if (!props) return [];
    return Object.entries(props).map(([name, node]) => ({
        name,
        insertText: fieldLine(name, node),
        documentation: String(asObj(node)?.["description"] ?? ""),
    }));
}

type DerivedSchema = {
    commandNames: string[];
    commandListKeys: string[];
    commandListDefs: Record<string, string[]>;
    commandListSlot: Record<string, string>;
    commands: Suggestion[];
    commandKeys: Record<string, Suggestion[]>;
    taskKeys: Suggestion[];
    taskArgs: Suggestion[];
    objectListSlot: Record<string, Suggestion[]>;
    openObjectMapCommands: Set<string>;
    newTaskInsert: string;
    groups: SchemaCommandGroup[];
};

let derivedCache: { schema: AgentSchema; d: DerivedSchema } | null = null;

function derivedSchema(): DerivedSchema | null {
    const schema = getCachedAgentSchema();
    if (!schema) return null;
    if (derivedCache?.schema === schema) return derivedCache.d;

    const defs = schemaDefs(schema);
    const commandProps = asObj(asObj(defs?.[COMMAND_LIST_DEF])?.["properties"]);
    if (!defs || !commandProps) return null;

    const starterFields = schema.starterFields ?? {};
    const commandNames = Object.keys(commandProps);

    const universe = new Map<string, string>();
    for (const [name, node] of Object.entries(commandProps)) {
        universe.set(name, refNameOf(node) ?? "");
    }
    const isCommandListDef = (def: SchemaNode): boolean => {
        if (def["type"] !== "object") return false;
        const props = asObj(def["properties"]);
        if (!props || Object.keys(props).length === 0) return false;
        return Object.entries(props).every(
            ([name, node]) => universe.get(name) === (refNameOf(node) ?? ""),
        );
    };

    const commandListDefs: Record<string, string[]> = {};
    for (const [defName, def] of Object.entries(defs)) {
        const obj = asObj(def);
        if (obj && isCommandListDef(obj)) {
            commandListDefs[defName] = Object.keys(asObj(obj["properties"]) ?? {});
        }
    }

    const commandListKeys = new Set<string>();
    for (const def of Object.values(defs)) {
        for (const [name, node] of Object.entries(asObj(asObj(def)?.["properties"]) ?? {})) {
            if (commandListDefs[refNameOf(node) ?? ""]) commandListKeys.add(name);
        }
    }

    const objectListSlot: Record<string, Suggestion[]> = {};
    const commandListSlot: Record<string, string> = {};
    const openObjectMapCommands = new Set<string>();
    for (const [cmdName, nodeRaw] of Object.entries(commandProps)) {
        const cmdDef = asObj(defs[refNameOf(nodeRaw) ?? ""]);

        const additional = asObj(cmdDef?.["additionalProperties"]);
        if (
            cmdDef?.["type"] === "object" &&
            Object.keys(asObj(cmdDef["properties"]) ?? {}).length === 0 &&
            additional?.["type"] === "object"
        ) {
            openObjectMapCommands.add(cmdName);
        }

        for (const [key, node] of Object.entries(asObj(cmdDef?.["properties"]) ?? {})) {
            const target = refNameOf(node) ?? "";
            if (commandListDefs[target]) commandListSlot[`${cmdName}.${key}`] = target;

            const item = asObj(node)?.["items"];
            const itemDef = refNameOf(item);
            if (
                asObj(node)?.["type"] === "array" &&
                itemDef &&
                asObj(defs[itemDef])?.["properties"]
            ) {
                objectListSlot[`${cmdName}.${key}`] = defFieldSuggestions(defs, itemDef);
            }
        }
    }

    const commandSkeleton = (name: string, defName: string): string => {
        const props = asObj(asObj(defs[defName])?.["properties"]) ?? {};
        const starters =
            starterFields[name] ??
            (Array.isArray(asObj(defs[defName])?.["required"])
                ? (asObj(defs[defName])?.["required"] as string[])
                : []);
        const lines = starters.filter((f) => f in props).map((f) => fieldLine(f, props[f], defs));
        return `"${name}": {\n${lines.join("\n")}\n},`;
    };

    const commands: Suggestion[] = [];
    const commandKeys: Record<string, Suggestion[]> = {};
    for (const [name, nodeRaw] of Object.entries(commandProps)) {
        const node = asObj(nodeRaw) ?? {};
        const ref = refNameOf(node);
        const target = asObj(defs[ref ?? ""]);
        const isObjectCommand = target?.["type"] === "object" && asObj(target["properties"]);

        const insertText = isObjectCommand
            ? commandSkeleton(name, ref as string)
            : `"${name}": ${fieldDefault(node)},`;

        commands.push({
            name,
            insertText,
            documentation: String(node["description"] ?? ""),
        });
        commandKeys[name] = isObjectCommand ? defFieldSuggestions(defs, ref) : [];
    }

    const newTaskFields = (starterFields["function"] ?? ["commands"])
        .map((f) => fieldLine(f, asObj(asObj(defs["FunctionModel"])?.["properties"])?.[f]))
        .join("\n");

    const d: DerivedSchema = {
        commandNames,
        objectListSlot,
        openObjectMapCommands,
        commandListKeys: [...commandListKeys],
        commandListDefs,
        commandListSlot,
        commands,
        commandKeys,
        taskKeys: defFieldSuggestions(defs, "FunctionModel", true),
        taskArgs: defFieldSuggestions(defs, "FunctionArgModel", true),
        newTaskInsert: `{\n${newTaskFields}\n},`,
        groups: schema.commandGroups ?? [],
    };
    derivedCache = { schema, d };
    return d;
}

function isOpenObjectMap(seg: Segment | undefined, d: DerivedSchema): boolean {
    const base = commandBase(seg);
    return !!base && d.openObjectMapCommands.has(base);
}

function modeForPath(path: Segment[], d: DerivedSchema | null): SuggestMode {
    const len = path.length;
    if (len === 0) return SuggestMode.Unknown;

    if (path[0] === "functions") {
        if (len === 2) return SuggestMode.NewTask;
        if (len === 3) return SuggestMode.Func;
        if (len === 5 && path[2] === "args") return SuggestMode.FuncArg;
    }

    if (len >= 4 && typeof path[len - 2] === "number") {
        const owner = commandBase(path[len - 4]);
        const field = path[len - 3];
        if (owner && typeof field === "string" && d?.objectListSlot[`${owner}.${field}`]) {
            return SuggestMode.ObjectInList;
        }
    }

    if (d && len >= 4 && isOpenObjectMap(path[len - 2], d)) {
        return SuggestMode.FunctionCall;
    }
    if (d && len >= 5 && isOpenObjectMap(path[len - 3], d)) {
        return SuggestMode.FunctionCallArg;
    }

    if (len >= 4) {
        const base = commandBase(path[len - 2]);
        if (base && d?.commandNames.includes(base)) {
            return SuggestMode.Command;
        }
    }
    if (len > 3) {
        const seg = path[len - 2];
        if (typeof seg === "string" && d?.commandListKeys.includes(seg)) {
            return SuggestMode.CommandBlock;
        }
    }
    return SuggestMode.Unknown;
}

export function commandInsertName(name: string, siblingKeys: Set<string>): string {
    if (!siblingKeys.has(name)) return name;
    let n = 1;
    while (siblingKeys.has(`${name}.${n}`)) n++;
    return `${name}.${n}`;
}

function withRepeatSuffix(ins: Suggestion[], siblingKeys: Set<string>): Suggestion[] {
    return ins.map((s) => {
        const adjusted = commandInsertName(s.name, siblingKeys);
        if (adjusted === s.name) return s;
        return {
            ...s,
            name: adjusted,
            insertText: s.insertText.replace(`"${s.name}"`, `"${adjusted}"`),
        };
    });
}

export type CommandGroup = { title: string; items: Suggestion[] };

function commandListDefAt(path: Segment[], d: DerivedSchema): string {
    const key = path[path.length - 2];
    const owner = commandBase(path[path.length - 3]);
    if (typeof key === "string" && owner) {
        const found = d.commandListSlot[`${owner}.${key}`];
        if (found) return found;
    }
    return COMMAND_LIST_DEF;
}

function allowedCommandsAt(path: Segment[], d: DerivedSchema): Suggestion[] {
    const allowed = d.commandListDefs[commandListDefAt(path, d)];
    if (!allowed) return d.commands;
    const names = new Set(allowed);
    return d.commands.filter((s) => names.has(s.name));
}

export function groupedCommandSuggestions(prefix: string, path: Segment[]): CommandGroup[] {
    const d = derivedSchema();
    if (!d) return [];

    const byName = new Map<string, Suggestion>();
    for (const s of allowedCommandsAt(path, d)) byName.set(s.name, s);

    const groups: CommandGroup[] = [];
    const grouped = new Set<string>();
    for (const g of d.groups) {
        const items: Suggestion[] = [];
        for (const name of g.commands) {
            const s = byName.get(name);
            if (!s) continue;
            grouped.add(name);
            if (s.name.startsWith(prefix)) items.push(s);
        }
        if (items.length) groups.push({ title: g.title, items });
    }
    const other = [...byName.values()].filter(
        (s) => !grouped.has(s.name) && s.name.startsWith(prefix),
    );
    if (other.length) groups.push({ title: "Other", items: other });
    return groups;
}

export type KeyContext = {
    mode: SuggestMode;
    prefix: string;
    quoteColumn: number;
    quoted: boolean;
    path: Segment[];
    siblingKeys: Set<string>;
    text: string;
};

function objectListAt(path: Segment[], d: DerivedSchema): Suggestion[] | null {
    const len = path.length;
    if (len < 3 || typeof path[len - 1] !== "number") return null;
    const owner = commandBase(path[len - 3]);
    const field = path[len - 2];
    if (!owner || typeof field !== "string") return null;
    return d.objectListSlot[`${owner}.${field}`] ?? null;
}

function enclosingIsArray(text: string, offset: number): boolean {
    const root = parseTree(text);
    if (!root) return false;
    let node = findNodeAtOffset(root, offset, true);
    while (node && node.type !== "object" && node.type !== "array") node = node.parent;
    return node?.type === "array";
}

export function fieldSuggestionsFor(ctx: KeyContext): Suggestion[] {
    const pool = keySuggestions(ctx).filter((s) => !ctx.siblingKeys.has(s.name));
    if (ctx.mode !== SuggestMode.Command) return pool;
    const command = ctx.path[ctx.path.length - 2];
    const required = typeof command === "string" ? requiredCommandFields(command) : [];
    return [...pool].sort(
        (a, b) => (required.includes(b.name) ? 1 : 0) - (required.includes(a.name) ? 1 : 0),
    );
}

function bareContextAt(
    text: string,
    offset: number,
    position: monacoT.Position,
    derived: DerivedSchema,
): KeyContext | null {
    if (enclosingIsArray(text, offset)) return null;

    const loc: Location = getLocation(text, offset);
    const path: Segment[] =
        loc.path[loc.path.length - 1] === "" ? [...loc.path] : [...loc.path, ""];
    const mode = modeForPath(path, derived);
    if (mode === SuggestMode.Unknown) return null;

    const siblings = getEnclosingObjectDict(parseTree(text), offset);
    return {
        mode,
        prefix: "",
        quoteColumn: position.column,
        quoted: false,
        path,
        siblingKeys: new Set(Object.keys(siblings ?? {})),
        text,
    };
}

export function keyContextAt(
    model: monacoT.editor.ITextModel,
    position: monacoT.Position,
): KeyContext | null {
    const derived = derivedSchema();
    if (!derived) return null;

    const lineContent = model.getLineContent(position.lineNumber);
    const lineBefore = lineContent.slice(0, position.column - 1);
    const text = model.getValue();
    const offset = model.getOffsetAt(position);

    const closed = lineBefore.match(/"([\w.-]*)"$/);
    const partial = closed ? null : lineBefore.match(/"([\w.-]*)$/);
    const m = closed ?? partial;
    if (m) {
        const prefix = m[1];
        const quoteColumn = position.column - prefix.length - (closed ? 2 : 1);
        const quoteOffset = offset - prefix.length - (closed ? 2 : 1);

        let parseText = text;
        let parseOffset = offset;
        let loc: Location = getLocation(text, offset);
        if (!loc.isAtPropertyKey) {
            const repaired = patchMissingComma(text, quoteOffset);
            const repairedLoc = repaired ? getLocation(repaired, offset + 1) : null;
            if (repaired && repairedLoc?.isAtPropertyKey) {
                parseText = repaired;
                parseOffset = offset + 1;
                loc = repairedLoc;
            }
        }
        const last = loc.path[loc.path.length - 1];
        if (!loc.isAtPropertyKey || last !== prefix) {
            if (typeof last === "number" && objectListAt(loc.path, derived)) {
                return {
                    mode: SuggestMode.ObjectExpected,
                    prefix,
                    quoteColumn,
                    quoted: true,
                    path: loc.path,
                    siblingKeys: new Set<string>(),
                    text,
                };
            }
            return null;
        }

        const mode = modeForPath(loc.path, derived);

        const { textPatched, offsetPatched } = patchTextWithKeyStub(parseText, parseOffset);
        const siblings = getEnclosingObjectDict(parseTree(textPatched), offsetPatched);
        return {
            mode,
            prefix,
            quoteColumn,
            quoted: true,
            path: loc.path,
            siblingKeys: new Set(Object.keys(siblings ?? {})),
            text,
        };
    }

    const lineAfter = lineContent.slice(position.column - 1);
    if (lineBefore.trim() === "" && lineAfter.trim() === "") {
        const fromRaw = bareContextAt(text, offset, position, derived);
        if (fromRaw) return fromRaw;
        const repaired = patchMissingComma(text, offset);
        return repaired ? bareContextAt(repaired, offset + 1, position, derived) : null;
    }

    return null;
}

const INDENT_UNIT = 2;

export function keySuggestions(ctx: KeyContext): Suggestion[] {
    if (ctx.mode === SuggestMode.FunctionCall) return functionCallSuggestions(ctx.text);
    if (ctx.mode === SuggestMode.FunctionCallArg) {
        const owner = ctx.path[ctx.path.length - 2];
        return functionArgSuggestions(ctx.text, typeof owner === "string" ? owner : null);
    }
    const d = derivedSchema();
    return d ? suggestionsForMode(ctx.mode, ctx.path, d) : [];
}

export function contextIndent(ctx: KeyContext): string {
    return " ".repeat(ctx.path.length * INDENT_UNIT);
}

function netDepth(line: string): number {
    let depth = 0;
    let inString = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inString) {
            if (ch === "\\") i++;
            else if (ch === '"') inString = false;
        } else if (ch === '"') {
            inString = true;
        } else if (ch === "{" || ch === "[") {
            depth++;
        } else if (ch === "}" || ch === "]") {
            depth--;
        }
    }
    return depth;
}

export function reindentSnippet(insertText: string, baseIndent: string, tabSize = 2): string {
    const lines = insertText.split("\n");
    if (lines.length === 1) return insertText;

    let depth = Math.max(0, netDepth(lines[0]));
    const out = [lines[0].trimEnd()];
    for (let i = 1; i < lines.length; i++) {
        const t = lines[i].trim();
        const closes = t.startsWith("}") || t.startsWith("]");
        if (closes) depth = Math.max(0, depth - 1);
        out.push(baseIndent + " ".repeat(depth * tabSize) + t);
        depth = Math.max(0, depth + netDepth(t) + (closes ? 1 : 0));
    }
    return out.join("\n");
}

function requiredCommandFields(commandName: string): string[] {
    const schema = getCachedAgentSchema();
    const defs = schema ? schemaDefs(schema) : null;
    const base = commandBase(commandName);
    const prop = asObj(asObj(defs?.[COMMAND_LIST_DEF])?.["properties"])?.[base ?? ""];
    const def = asObj(defs?.[refNameOf(prop) ?? ""]);
    const required = def?.["required"];
    return Array.isArray(required)
        ? required.filter((x): x is string => typeof x === "string")
        : [];
}

function documentFunctions(text: string): { name: string; node: Node }[] {
    const root = parseTree(text);
    const functions = root?.children?.find(
        (p) => p.type === "property" && p.children?.[0]?.value === "functions",
    )?.children?.[1];
    if (functions?.type !== "object") return [];

    const out: { name: string; node: Node }[] = [];
    for (const prop of functions.children ?? []) {
        const [keyNode, valueNode] = prop.children ?? [];
        if (typeof keyNode?.value === "string" && valueNode?.type === "object") {
            out.push({ name: keyNode.value, node: valueNode });
        }
    }
    return out;
}

function childOf(node: Node | undefined, key: string): Node | undefined {
    if (node?.type !== "object") return undefined;
    for (const prop of node.children ?? []) {
        const [keyNode, valueNode] = prop.children ?? [];
        if (keyNode?.value === key) return valueNode;
    }
    return undefined;
}

function stringField(node: Node | undefined, key: string): string {
    const found = childOf(node, key);
    return typeof found?.value === "string" ? found.value : "";
}

function functionCallSuggestions(text: string): Suggestion[] {
    return documentFunctions(text).map(({ name, node }) => ({
        name,
        insertText: `"${name}": {\n\n},`,
        documentation: stringField(node, "description"),
    }));
}

function functionArgSuggestions(text: string, functionName: string | null): Suggestion[] {
    if (!functionName) return [];
    const declared = documentFunctions(text);
    const fn =
        declared.find((f) => f.name === functionName) ??
        declared.find((f) => f.name === commandBase(functionName));
    const args = childOf(fn?.node, "args");
    if (args?.type !== "object") return [];

    return (args.children ?? []).flatMap((prop) => {
        const [keyNode, valueNode] = prop.children ?? [];
        if (typeof keyNode?.value !== "string") return [];
        const type = stringField(valueNode, "type");
        const description = stringField(valueNode, "description");
        return [
            {
                name: keyNode.value,
                insertText: `"${keyNode.value}": "{  }",`,
                documentation: [type, description].filter(Boolean).join(" — "),
            },
        ];
    });
}

function suggestionsForMode(mode: SuggestMode, path: Segment[], d: DerivedSchema): Suggestion[] {
    switch (mode) {
        case SuggestMode.Func:
            return d.taskKeys;
        case SuggestMode.FuncArg:
            return d.taskArgs;
        case SuggestMode.CommandBlock:
            return allowedCommandsAt(path, d);
        case SuggestMode.Command: {
            const base = commandBase(path[path.length - 2]);
            return base ? (d.commandKeys[base] ?? []) : [];
        }
        case SuggestMode.ObjectInList: {
            const owner = commandBase(path[path.length - 4]);
            const field = path[path.length - 3];
            return owner && typeof field === "string"
                ? (d.objectListSlot[`${owner}.${field}`] ?? [])
                : [];
        }

        default:
            return [];
    }
}

function patchTextWithKeyStub(
    text: string,
    offset: number,
): { textPatched: string; offsetPatched: number } {
    const before = text.slice(0, offset);
    if (/"[\w.-]*$/.test(before)) {
        if (text[offset] === '"') {
            return {
                textPatched: text.slice(0, offset + 1) + ": {}," + text.slice(offset + 1),
                offsetPatched: offset,
            };
        }
        return { textPatched: before + '": {},' + text.slice(offset), offsetPatched: offset };
    }
    return { textPatched: text, offsetPatched: offset };
}

function getEnclosingObjectDict(
    root: Node | undefined,
    offsetPatched: number,
): Record<string, unknown> | null {
    if (!root) return null;

    let node = findNodeAtOffset(root, offsetPatched, false);
    if (!node) return null;

    if (
        node.type === "string" &&
        node.parent?.type === "property" &&
        node.parent.parent?.type === "object"
    ) {
        node = node.parent.parent;
    } else {
        while (node && node.type !== "object") node = node.parent as Node | undefined;
    }
    if (!node || node.type !== "object") return null;

    const out: Record<string, unknown> = {};
    for (const prop of node.children ?? []) {
        if (prop.type !== "property") continue;
        const keyNode = prop.children?.[0];
        const valNode = prop.children?.[1];
        if (keyNode?.type !== "string") continue;

        const key = String(keyNode.value ?? "");
        if (key === "") continue;
        if (keyNode.offset <= offsetPatched && offsetPatched <= keyNode.offset + keyNode.length) {
            continue;
        }

        out[key] = valNode ? getNodeValue(valNode) : undefined;
    }

    return out;
}

function installAgentSchemaUX(monaco: typeof monacoT) {
    inlineProviderDisposable?.dispose();
    inlineProviderDisposable = null;

    const provideInline = (
        model: monacoT.editor.ITextModel,
        position: monacoT.Position,
    ): monacoT.languages.InlineCompletions => {
        const none: monacoT.languages.InlineCompletions = { items: [] };
        const d = derivedSchema();
        if (!d) return none;

        const ctx = keyContextAt(model, position);
        if (!ctx || ctx.mode === SuggestMode.Unknown || ctx.mode === SuggestMode.ObjectExpected)
            return none;
        const { mode, prefix, quoteColumn, quoted, siblingKeys } = ctx;

        let pool: Suggestion[];
        if (mode === SuggestMode.NewTask) {
            if (prefix === "" || siblingKeys.has(prefix)) return none;
            pool = [
                {
                    name: prefix,
                    insertText: `"${prefix}": ${d.newTaskInsert}`,
                    documentation: "",
                },
            ];
        } else if (mode === SuggestMode.CommandBlock) {
            if (prefix === "") return none;
            pool = withRepeatSuffix(
                groupedCommandSuggestions(prefix, ctx.path).flatMap((g) => g.items),
                siblingKeys,
            );
        } else {
            pool = fieldSuggestionsFor(ctx);
        }

        const nextChar = quoted
            ? model.getValueInRange({
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column + 1,
              })
            : "";
        const range = new monaco.Range(
            position.lineNumber,
            quoteColumn,
            position.lineNumber,
            nextChar === '"' ? position.column + 1 : position.column,
        );

        const indent = contextIndent(ctx);
        const lineWs = model.getLineContent(position.lineNumber).match(/^\s*/)?.[0] ?? "";
        const wsOnlyBeforeKey = lineWs.length >= quoteColumn - 1;
        const reindent = wsOnlyBeforeKey && lineWs !== indent;
        const fixupCommand = {
            id: REINDENT_LINE_COMMAND,
            title: "Finish the completed line",
            arguments: [
                model.uri.toString(),
                position.lineNumber,
                reindent ? indent : null,
                quoted ? quoteColumn : position.column,
            ],
        };

        return {
            items: pool
                .filter((s) => s.name.startsWith(prefix))
                .map((s) => ({
                    insertText: reindentSnippet(s.insertText.replace(CARET_MARK, ""), indent),
                    range,
                    command: fixupCommand,
                })),
        };
    };

    inlineProviderDisposable = monaco.languages.registerInlineCompletionsProvider("json", {
        provideInlineCompletions: provideInline,
        disposeInlineCompletions: () => {},
    });

    reindentCommandDisposable?.dispose();
    reindentCommandDisposable = monaco.editor.registerCommand(
        REINDENT_LINE_COMMAND,
        (
            _accessor,
            uriString: string,
            lineNumber: number,
            indent: string | null,
            startColumn: number,
        ) => {
            const model = monaco.editor.getModel(monaco.Uri.parse(uriString));
            if (!model || lineNumber > model.getLineCount()) return;

            const edits: monacoT.editor.IIdentifiedSingleEditOperation[] = [];
            const ws = model.getLineContent(lineNumber).match(/^\s*/)?.[0] ?? "";
            if (indent !== null && ws !== indent) {
                edits.push({
                    range: new monaco.Range(lineNumber, 1, lineNumber, ws.length + 1),
                    text: indent,
                });
            }
            const comma = commaRepairEdit(model, { lineNumber, column: startColumn });
            if (comma) {
                edits.push({
                    range: new monaco.Range(
                        comma.range.startLineNumber,
                        comma.range.startColumn,
                        comma.range.endLineNumber,
                        comma.range.endColumn,
                    ),
                    text: comma.text ?? ",",
                });
            }
            if (edits.length) model.pushEditOperations([], edits, () => null);
        },
    );
}
