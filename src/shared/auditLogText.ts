import type { AuditLogModel } from "@/orval/search2o.schemas";

const ACRONYMS: Record<string, string> = {
    api: "API",
    db: "Database",
    llm: "LLM",
    mcp: "MCP",
    ui: "UI",
};

export function labelForType(t: string): string {
    const words = t
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .split(" ");
    const spelled = words.map((w) => ACRONYMS[w] ?? w);
    const [first, ...rest] = spelled;
    if (!first) return t;
    const head = ACRONYMS[words[0]] ? first : first.charAt(0).toUpperCase() + first.slice(1);
    return [head, ...rest].join(" ").replace(/\bsign ins?\b/gi, (m) => m.replace(" ", "-"));
}

const PART_NOUNS: Record<string, { one: string; whole: string; wholeIsPlural?: boolean }> = {
    llm: { one: "LLM profile", whole: "LLM profiles", wholeIsPlural: true },
    prompt: { one: "Prompt profile", whole: "Prompt profiles", wholeIsPlural: true },
    api: { one: "API profile", whole: "API profiles", wholeIsPlural: true },
    db: { one: "Database profile", whole: "Database profiles", wholeIsPlural: true },
    mcp: { one: "MCP server", whole: "MCP servers", wholeIsPlural: true },
    apiConnectionPools: { one: "Connection pool", whole: "Connection pools", wholeIsPlural: true },
    servers: { one: "Agent server", whole: "Agent servers", wholeIsPlural: true },
    secrets: { one: "Secrets", whole: "Secrets", wholeIsPlural: true },
    operators: { one: "Compile rules", whole: "Compile rules", wholeIsPlural: true },
    search: { one: "Search settings", whole: "Search settings", wholeIsPlural: true },
    builtinAuth: { one: "Authentication", whole: "Authentication" },
    encryption: { one: "Encryption", whole: "Encryption" },
    validation: { one: "Agent runtime", whole: "Agent runtime" },
    allowlist: { one: "Allowlist", whole: "Allowlist" },
    sysvar: { one: "System variables", whole: "System variables", wholeIsPlural: true },
    hooks: { one: "Hooks", whole: "Hooks", wholeIsPlural: true },
};

const REASONS: Record<string, string> = {
    contention: "another change was saved at the same time",
    serviceDown: "the service was unavailable",
};

const MAX_LISTED = 6;

type Data = AuditLogModel["data"];

function scalar(value: unknown): string | null {
    if (typeof value === "string") return value.trim() || null;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return null;
}

function list(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(scalar).filter((v): v is string => v !== null);
    const one = scalar(value);
    return one ? [one] : [];
}

function join(values: string[]): string {
    if (values.length <= MAX_LISTED) return values.join(", ");
    return `${values.slice(0, MAX_LISTED).join(", ")} and ${values.length - MAX_LISTED} more`;
}

function quoted(name: string): string {
    return `“${name}”`;
}

function partPhrase(data: Data, fallbackType: string): { subject: string; plural: boolean } {
    const part = scalar(data.part) ?? fallbackType;
    const nouns = PART_NOUNS[part];
    const name = scalar(data.name);

    if (!nouns) {
        const spelled = labelForType(part);
        return { subject: name ? `${spelled} ${quoted(name)}` : spelled, plural: false };
    }
    if (name) return { subject: `${nouns.one} ${quoted(name)}`, plural: false };
    return { subject: nouns.whole, plural: nouns.wholeIsPlural === true };
}

function agentPhrase(data: Data): string {
    const agent = scalar(data.agent);
    return agent ? quoted(agent) : "An agent";
}

function actionVerb(action: string | null, plural: boolean): string {
    const be = plural ? "were" : "was";
    if (action === "created") return `${be} created`;
    if (action === "deleted") return `${be} deleted`;
    return `${be} updated`;
}

function limitsIn(value: unknown): string | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    const parts: string[] = [];
    const time = scalar(v.maxTime);
    const cost = scalar(v.maxCost);
    if (time) parts.push(`${time}s`);
    if (cost) parts.push(`$${cost}`);
    return parts.length ? parts.join(", ") : null;
}

function addressIn(data: Data): string | null {
    const email = scalar(data.email);
    if (email && email.includes("@")) return email;
    const name = scalar(data.name);
    return name && name.includes("@") ? name : null;
}

export type AuditEntryText = {
    headline: string;
    detail: string | null;
    showUser: boolean;
};

const RETIRED_PROMPT_UPDATED = "promptUpdated";

const PUBLISHED_FIELDS: Record<string, string> = {
    agentDefinition: "definition",
    agentTitle: "title",
    maxTime: "max time",
    maxCost: "max cost",
    const: "const",
};

function publishedFieldLabel(field: string): string {
    const prompt = /^agentPrompts\.(.+)$/.exec(field);
    if (prompt) return `prompt ${quoted(prompt[1])}`;
    return PUBLISHED_FIELDS[field] ?? labelForType(field).toLowerCase();
}

export function describeAuditEntry(n: AuditLogModel): AuditEntryText {
    const data: Data = n.data ?? {};
    const type = (n.entryType ?? null) as
        AuditLogModel["entryType"] | typeof RETIRED_PROMPT_UPDATED;

    const details: string[] = [];
    const part = (scalar(data.part) ?? type ?? "").toLowerCase();
    const fields = list(data.fields)
        .filter((f) => !part.endsWith(f.toLowerCase()))
        .map((f) => (type === "agentPublished" ? publishedFieldLabel(f) : f));
    const added = list(data.added);
    const removed = list(data.removed);
    const reason = scalar(data.reason);

    if (type === "agentServer") {
        const message = scalar(data.message);
        const version = scalar(data.version);
        const configName = scalar(data.event) === "started" ? scalar(data.configName) : null;
        if (message) details.push(message);
        if (version) details.push(`Version ${version}`);
        if (configName) details.push(`Configuration ${quoted(configName)}`);
    }
    if (fields.length) details.push(`Changed: ${join(fields)}`);
    if (added.length) details.push(`Added: ${join(added)}`);
    if (removed.length) details.push(`Removed: ${join(removed)}`);
    if (reason) details.push(`Reason: ${REASONS[reason] ?? labelForType(reason).toLowerCase()}`);

    const detail = details.length ? details.join(" · ") : null;

    const headline = ((): string => {
        switch (type) {
            case "agentIndexed":
                return `${agentPhrase(data)} was indexed`;
            case "indexingSubmitted":
                return `${agentPhrase(data)} was submitted for indexing`;
            case "indexingFailed":
                return `Indexing ${agentPhrase(data)} failed`;
            case "descriptorDeleted":
                return `${agentPhrase(data)} was removed from the search index`;
            case "unknownPasswordReset": {
                const address = addressIn(data);
                return address
                    ? `A password reset was requested for ${address}, which is not a user`
                    : "A password reset was requested for an email address that is not a user";
            }
            case "failedSignIns": {
                const address = addressIn(data) ?? (n.userEmail?.trim() || null);
                return address
                    ? `Repeated failed sign-ins to ${address}`
                    : "Repeated failed sign-ins to an account";
            }
            case "agentServer": {
                const node = scalar(data.node);
                const who = node ? `Agent server ${quoted(node)}` : "An agent server";
                const event = scalar(data.event) ?? "";
                switch (event) {
                    case "started":
                        return `${who} started`;
                    case "runtimeUpdated":
                        return `${who} picked up the current runtime`;
                    case "stopped":
                    case "shutdown":
                        return `${who} stopped`;
                    case "":
                        return `${who} reported an event`;
                    default:
                        return `${who} has errors`;
                }
            }
            case "budgetUpdated": {
                const from = limitsIn(data.old);
                const to = limitsIn(data.new);
                if (from && to)
                    return `${agentPhrase(data)} run limits changed from ${from} to ${to}`;
                if (to) return `${agentPhrase(data)} run limits set to ${to}`;
                return `${agentPhrase(data)} run limits changed`;
            }
            case RETIRED_PROMPT_UPDATED: {
                const name = scalar(data.name);
                const agent = scalar(data.agent);
                const prompt = name ? `Prompt ${quoted(name)}` : "A prompt";
                const action = scalar(data.action);
                if (!agent) return `${prompt} ${actionVerb(action, false)}`;
                if (action === "created") return `${prompt} was added to ${quoted(agent)}`;
                if (action === "deleted") return `${prompt} was deleted from ${quoted(agent)}`;
                return `${prompt} of ${quoted(agent)} was updated`;
            }
            case "agentPublished":
                return scalar(data.action) === "created"
                    ? `${agentPhrase(data)} was published for the first time`
                    : `${agentPhrase(data)} was published`;
            case "promptsUpdated": {
                const agent = scalar(data.agent);
                return agent ? `Prompts of ${quoted(agent)} were updated` : "Prompts were updated";
            }
            case "tagUpdated":
            case "titleUpdated": {
                const what = type === "tagUpdated" ? "tag" : "title";
                const from = scalar(data.old);
                const to = scalar(data.new);
                if (from && to) {
                    return `${agentPhrase(data)} ${what} changed from ${quoted(from)} to ${quoted(to)}`;
                }
                if (to) return `${agentPhrase(data)} ${what} set to ${quoted(to)}`;
                return `${agentPhrase(data)} ${what} changed`;
            }
            default:
                break;
        }

        if (type) {
            const { subject, plural } = partPhrase(data, type);
            return `${subject} ${actionVerb(scalar(data.action), plural)}`;
        }

        const pairs = Object.entries(data)
            .map(([k, v]) => {
                const text = scalar(v) ?? (list(v).length ? join(list(v)) : null);
                return text ? `${k}: ${text}` : null;
            })
            .filter((p): p is string => p !== null);

        return pairs.length ? pairs.join(", ") : "Something changed";
    })();

    return {
        headline,
        detail,
        showUser:
            type !== "unknownPasswordReset" && type !== "failedSignIns" && type !== "agentServer",
    };
}
