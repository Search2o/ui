import type { UserRole } from "@/orval/search2o.schemas";
import * as UI from "@/shared/uistate";

export type RailItem = {
    label: string;
    key: UI.ModuleKey;
    aliases?: UI.ModuleKey[];
    adminOnly?: boolean;
    ownerOnly?: boolean;
};

export type RailGroup = { label: string; items: RailItem[] };

export const DEV_GROUPS: RailGroup[] = [
    {
        label: "Agents",
        items: [
            { label: "Drafts", key: "Drafts", aliases: ["DraftEdit"] },
            { label: "Published", key: "Agents", aliases: ["AgentView", "AgentRun"] },
        ],
    },
    {
        label: "Profiles",
        items: [
            { label: "LLM", key: "LlmProfile", aliases: ["LlmProfileDetail"] },
            { label: "Prompt", key: "PromptConfig", aliases: ["PromptConfigDetail"] },
            { label: "API", key: "ApiConfig", aliases: ["ApiConfigDetail"] },
            { label: "Database", key: "DbConfig", aliases: ["DbConfigDetail"] },
            { label: "MCP", key: "MCPConfig", aliases: ["MCPConfigDetail"] },
        ],
    },
    {
        label: "Guardrails",
        items: [
            { label: "Compile rules", key: "OperatorsConfig" },
            { label: "Allowlist", key: "AllowlistConfig" },
            { label: "System variables", key: "SysVarConfig" },
            { label: "Runtime", key: "ValidationConfig" },
        ],
    },
    {
        label: "Operations",
        items: [
            { label: "Agent servers", key: "AgentServerConfig", adminOnly: true },
            { label: "Connection pools", key: "ApiConnectionPools", adminOnly: true },
            { label: "Secrets & encryption", key: "SecretsEncryption", adminOnly: true },
            { label: "Hooks", key: "HooksConfig", adminOnly: true },
        ],
    },
    {
        label: "Reports",
        items: [
            { label: "Performance", key: "AgentPerformanceReport", aliases: ["AgentDetailReport"] },
            { label: "Cost", key: "AgentCostReport", aliases: ["AgentCostDetailReport"] },
            { label: "Errors", key: "AgentErrorReport", aliases: ["AgentErrorDetailReport"] },
            {
                label: "Usage",
                key: "UserUsageReport",
                aliases: ["UserDetailReport"],
                adminOnly: true,
            },
        ],
    },
];

export const ADMIN_GROUP: RailGroup = {
    label: "Admin",
    items: [
        { label: "Users", key: "Users", aliases: ["UserView"] },
        { label: "Authentication", key: "AuthenticationConfig" },
        { label: "Service accounts", key: "ServiceAccounts" },
        { label: "License", key: "License" },
    ],
};

export const BILLING_GROUP: RailGroup = {
    label: "Billing",
    items: [
        { label: "Account", key: "Account", ownerOnly: true },
        { label: "Invoices", key: "Billing", ownerOnly: true },
    ],
};

export function canSeeAdminActions(role: UserRole | null | undefined): boolean {
    return role === "admin" || role === "owner";
}
export function canSeeDevActions(role: UserRole | null | undefined): boolean {
    return role === "developer" || canSeeAdminActions(role);
}

export function railGroupsFor(role: UserRole | null | undefined): RailGroup[] {
    return [
        ...(canSeeDevActions(role) ? DEV_GROUPS : []),
        ...(canSeeAdminActions(role) ? [ADMIN_GROUP, BILLING_GROUP] : []),
    ]
        .map((group) => ({
            ...group,
            items: group.items.filter(
                (item) =>
                    (canSeeAdminActions(role) || !item.adminOnly) &&
                    (role === "owner" || !item.ownerOnly),
            ),
        }))
        .filter((group) => group.items.length > 0);
}
