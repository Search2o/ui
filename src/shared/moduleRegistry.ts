import React, { lazy } from "react";

export type ModuleKey =
    | "SearchHistory"
    | "SearchConversation"
    | "Drafts"
    | "DraftEdit"
    | "Agents"
    | "AgentView"
    | "AgentRun"
    | "Users"
    | "UserView"
    | "License"
    | "SecretsEncryption"
    | "ValidationConfig"
    | "AllowlistConfig"
    | "SysVarConfig"
    | "OperatorsConfig"
    | "LlmProfile"
    | "LlmProfileDetail"
    | "MCPConfig"
    | "MCPConfigDetail"
    | "ApiConfig"
    | "ApiConfigDetail"
    | "DbConfig"
    | "DbConfigDetail"
    | "AgentServerConfig"
    | "ApiConnectionPools"
    | "HooksConfig"
    | "PromptConfig"
    | "PromptConfigDetail"
    | "AuthenticationConfig"
    | "ServiceAccounts"
    | "AgentPerformanceReport"
    | "AgentCostReport"
    | "UserUsageReport"
    | "AgentDetailReport"
    | "AgentCostDetailReport"
    | "AgentErrorReport"
    | "AgentErrorDetailReport"
    | "UserDetailReport"
    | "AuditLog"
    | "Profile"
    | "Docs"
    | "Billing"
    | "Account";

export const MODULE_IMPORTS: Record<ModuleKey, () => Promise<{ default: React.ComponentType }>> = {
    SearchHistory: () => import("@/modules/SearchHistoryModule"),
    SearchConversation: () => import("@/modules/SearchConversationModule"),
    Drafts: () => import("@/modules/DraftsModule"),
    DraftEdit: () => import("@/modules/DraftEditModule"),
    Agents: () => import("@/modules/AgentsModule"),

    AgentView: () => import("@/modules/AgentViewModule"),
    AgentRun: () => import("@/modules/AgentRunModule"),

    Users: () => import("@/modules/UsersModule"),
    UserView: () => import("@/modules/UserViewModule"),
    License: () => import("@/modules/LicenseModule"),
    SecretsEncryption: () => import("@/modules/SecretsEncryptionModule"),
    ValidationConfig: () => import("@/modules/ValidationConfigModule"),
    AllowlistConfig: () => import("@/modules/AllowlistConfigModule"),
    SysVarConfig: () => import("@/modules/SysVarConfigModule"),
    OperatorsConfig: () => import("@/modules/OperatorsConfigModule"),
    LlmProfile: () => import("@/modules/LlmProfileModule"),
    LlmProfileDetail: () => import("@/modules/LlmProfileDetailModule"),
    MCPConfig: () => import("@/modules/McpConfigModule"),
    MCPConfigDetail: () => import("@/modules/MCPConfigDetailModule"),
    ApiConfig: () => import("@/modules/ApiConfigModule"),
    ApiConfigDetail: () => import("@/modules/ApiConfigDetailModule"),
    DbConfig: () => import("@/modules/DbConfigModule"),
    DbConfigDetail: () => import("@/modules/DbConfigDetailModule"),
    AgentServerConfig: () => import("@/modules/AgentServerConfigModule"),
    ApiConnectionPools: () => import("@/modules/ApiConnectionPoolsModule"),
    HooksConfig: () => import("@/modules/HooksConfigModule"),
    PromptConfig: () => import("@/modules/PromptConfigModule"),
    PromptConfigDetail: () => import("@/modules/PromptConfigDetailModule"),
    AuthenticationConfig: () => import("@/modules/AuthenticationConfigModule"),
    ServiceAccounts: () => import("@/modules/ServiceAccountsModule"),

    AgentPerformanceReport: () => import("@/modules/AgentPerformanceReportModule"),
    AgentCostReport: () => import("@/modules/AgentCostReportModule"),
    UserUsageReport: () => import("@/modules/UserUsageReportModule"),
    AgentDetailReport: () => import("@/modules/AgentDetailReportModule"),
    AgentCostDetailReport: () => import("@/modules/AgentCostDetailReportModule"),
    AgentErrorReport: () => import("@/modules/AgentErrorReportModule"),
    AgentErrorDetailReport: () => import("@/modules/AgentErrorDetailReportModule"),
    UserDetailReport: () => import("@/modules/UserDetailReportModule"),

    AuditLog: () => import("@/modules/AuditLogModule"),
    Profile: () => import("@/modules/ProfileModule"),
    Docs: () => import("@/modules/DocsModule"),
    Billing: () => import("@/modules/BillingModule"),
    Account: () => import("@/modules/AccountModule"),
};

export const LazyModules: Record<
    ModuleKey,
    React.LazyExoticComponent<React.ComponentType>
> = Object.fromEntries(
    (Object.keys(MODULE_IMPORTS) as ModuleKey[]).map((k) => [k, lazy(MODULE_IMPORTS[k])]),
) as Record<ModuleKey, React.LazyExoticComponent<React.ComponentType>>;

export function preloadModule(key: ModuleKey): void {
    void MODULE_IMPORTS[key]().catch(() => {});
}
