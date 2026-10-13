export type NameRule = {
    pattern: string;
    maxLength: number;
    source: [string, string] | [string, string, "key"];
};

export const AGENT_NAME: NameRule = {
    pattern: "^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]$",
    maxLength: 32,
    source: ["AgentNameModel", "agentName"],
};

export const AGENT_TAG: NameRule = {
    pattern: "^[a-z0-9]+(?:_[a-z0-9]+)*$",
    maxLength: 16,
    source: ["UpdateTagModel", "agentTag"],
};

export const MCP_SERVER_NAME: NameRule = {
    pattern: "^[A-Za-z][A-Za-z0-9]{1,15}$",
    maxLength: 16,
    source: ["McpServerModel", "name"],
};

export const POOL_NAME: NameRule = {
    pattern: "^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]$",
    maxLength: 50,
    source: ["ApiConnectionPoolsModel", "pools", "key"],
};

export const PROFILE_NAME: NameRule = {
    pattern: "^[A-Za-z][A-Za-z0-9_]*[A-Za-z0-9]$",
    maxLength: 50,
    source: ["LlmModel", "name"],
};

export const SERVICE_ACCOUNT_NAME: NameRule = {
    pattern: "^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$",
    maxLength: 64,
    source: ["CreateServiceAccountModel", "name"],
};

export const IMPORT_PATH: NameRule = {
    pattern: "^[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)+$",
    maxLength: 200,
    source: ["HooksModel", "onStart"],
};

export const ALL_RULES: Record<string, NameRule> = {
    AGENT_NAME,
    AGENT_TAG,
    MCP_SERVER_NAME,
    POOL_NAME,
    PROFILE_NAME,
    SERVICE_ACCOUNT_NAME,
    IMPORT_PATH,
};

export function matchesRule(rule: NameRule, value: string): boolean {
    const trimmed = value.trim();
    return trimmed.length <= rule.maxLength && new RegExp(rule.pattern).test(trimmed);
}

export const MAX_LENGTHS: Record<string, { max: number; source: [string, string] }> = {
    ACCOUNT_NAME: { max: 32, source: ["UpdateAccountModel", "accountName"] },
    PROFILE_NAME: { max: 50, source: ["LlmModel", "name"] },
    AGENT_TITLE: { max: 80, source: ["UpdateTitleModel", "agentTitle"] },
    AGENT_DESCRIPTION: { max: 5000, source: ["DescriptorModel", "description"] },
    CONVERSATION_TITLE: { max: 200, source: ["SetConversationTitleModel", "title"] },
    PROFILE_DOC: { max: 500, source: ["LlmModel", "doc"] },
    AGENT_TAG: { max: 16, source: ["UpdateTagModel", "agentTag"] },
    MCP_SERVER_NAME: { max: 16, source: ["McpServerModel", "name"] },
    DRAFT_HELP_PROMPT: { max: 10000, source: ["DraftHelpModel", "userPrompt"] },
    OIDC_ISSUER: { max: 500, source: ["OidcAuthModel", "issuer"] },
    OIDC_CLIENT_ID: { max: 200, source: ["OidcAuthModel", "clientId"] },
    OIDC_CLIENT_SECRET: { max: 2000, source: ["OidcAuthModel", "clientSecret"] },
    OIDC_RETURN_URL: { max: 500, source: ["OidcAuthModel", "returnUrl"] },
    OIDC_EMAIL_CLAIM: { max: 100, source: ["OidcAuthModel", "emailClaim"] },
    OIDC_NAME_CLAIM: { max: 100, source: ["OidcAuthModel", "nameClaim"] },
};
