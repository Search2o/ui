import { publishedPageHelp } from "@/shared/uiText";

export const PAGE_HELP: Record<string, string> = {
    "draft-agents":
        "Draft agents exist in your private workspace. They can be either new agents or changes to existing agents.",
    "published-agents":
        "These are all the agents available in the system. An agent is matched to a query only when it is included in the search index.",
    "agent-view":
        "Describe what this agent does in a few lines. This description is used by the search engine to match this agent against user queries.",
    "draft-edit":
        "Edit the draft definition using JSONC format (JSON with comments). Press F1 in the editor to see all the commands available. A “ character inside an agent definition shows suggestions for that location. Drafts must pass validation before they can be published.",
    "agent-run":
        "Run this published agent directly against a query you type, without going through search. Useful for checking how an agent answers when you already know which one should handle the question.",

    "llm-profiles":
        "Define the LLM profiles that agents can use. Agents should refer to the profile names defined here in the 'llm' command's llmProfile field. Create a new LLM profile to see the description of each field.",
    "api-profiles": "Configure API connections from agents to REST servers.",
    "db-profiles":
        "Database connections an agent can query. Agents name a profile in the 'db' command and cannot connect any other way: the connection string is set here and nowhere else.",
    "prompt-profiles":
        "Reusable system and user prompts that agents refer to by name, so the same wording does not have to be repeated in every agent that needs it.",
    "llm-profile-detail":
        "One LLM profile: the adapter and model it calls, the server and credentials used to reach it, and the limits that apply to calls made through it. Agents name this profile in the 'llm' command.",
    "api-profile-detail":
        "One API profile: the URL of a REST service and the credentials used to reach it. Agents name this profile in the 'api' command.",
    "db-profile-detail":
        "One database profile: its connection string and the pool settings used for connections to it. Agents name this profile in the 'db' command.",
    "prompt-profile-detail":
        "One prompt profile: the system prompt, usually set once per conversation, and the user prompts, which are merged into a single string before an LLM call.",
    "mcp-server-detail":
        "One MCP server: where it is and how to authenticate to it. The tools it exposes become available to agents that name this server.",
    "mcp-servers":
        "Configure external MCP servers that agents can use. Click the info icon next to each server to see the tools that server supports.",

    "compile-rules":
        "Each potentially unsafe Python operator can be allowed as is, rejected, or mapped to a function you define in the allowlist. This is applied when an agent is validated or published. Changes do not affect agents already published until those are updated.",
    "agent-runtime":
        "Agents can execute Python expressions and code. This section specifies the safety rules enforced during evaluation. By default, dunder attributes, private methods and import statements are disallowed.",
    "system-variables":
        "Which variables an agent can read from the 'sys' namespace, alongside the ones every agent already has. Each one is data about the person or the server that the agent would otherwise have no way to see, so it is exposed only when this account turns it on. Changes apply to runs that start after the update.",
    allowlist:
        "The allowlist controls which functions and objects are allowed in Python expressions evaluated inside agent definitions and in the exec command. They must exist in the Python environment the Search2o server runs in: the server checks each one at startup and whenever the allowlist changes, and reports failures under Agent servers.",

    search: "Configure the behaviour of search.",
    "secrets-encryption":
        "How values that must not appear in an agent definition are obtained and protected. Secrets covers where the server reads them from; Encryption covers the keys used to protect them. The two are saved separately.",
    secrets:
        "Secrets are sensitive values such as API keys, tokens and database credentials that should not appear in an agent definition. Use this page to tell the Search2o server how to load them from its environment; refer to one from an agent as {secret(“MY_API_KEY”)}. To read them from your own vault, choose the vault source and name the vault hook on the Hooks page.",
    hooks: "Python functions and classes this account's agent servers call at set points: when the server starts and stops, around each agent run, when an agent is published or deleted, to store conversation state, to read secrets from a vault, to supply encryption keys, and around each LLM and API call. They are named by import path and must be installed on every agent server. They are loaded at startup, so a change takes effect after a restart; a path that cannot be loaded stops the server running agents until it is fixed.",
    "api-connection-pools":
        "How many HTTP connections agents open to APIs, how many idle ones are kept for reuse, and how long calls may take. Agents that start running after an update use the new settings; those already running do not.",
    encryption:
        "How sensitive values are encrypted. By default Search2o manages a key for this account; override that to use end-to-end encryption with your own keys. The last key listed is the current one; keep every key that stored data still uses. With your own keys the key itself comes from the encryptionKey hook, named on the Hooks page. New agent executions use the updated settings.",
    "agent-server-configuration":
        "These settings determine the security and other aspects of the Search2o servers running in your organization. All of them require a server restart to take effect, except Account name and Allowed server IPs, which take effect immediately. Changing the account name also needs a page refresh.",

    "agent-performance-report":
        "Report of agent executions and any errors, from search and from the agents module.",
    "agent-error-report":
        "Report of agent failures and any errors, from search and from the agents module.",
    "agent-cost-report":
        "LLM usage from agent executions, both from search and from development. The cost estimate is based on the token pricing below.",
    "user-usage-report":
        "What each user ran over the selected period: how many executions, what they cost, and which agents they used.",

    users: "Manage users, roles and access.",
    authentication:
        "Configure the built-in authentication. Changes take effect immediately. Users already signed in are not affected by changes to session duration.",
    "service-accounts":
        "Programs that call Search2o's API on their own, each with its own role and key. A key is shown once, when it is created or rotated, and service accounts are unaffected by how people sign in.",
    account:
        "This account's name, and the addresses billing and Search2o use to reach it. The billing name is set by the payment provider when the account is registered and is shown here for reference.",
    billing:
        "What this account is being charged: the seats counted so far in the current period, the estimate for the month, and each closed invoice. Only the account owner can see it.",
    "user-view":
        "One user's account: their role, which decides what they can do, and their recent activity. Developers and above can build agents; a plain user can only search.",
    "audit-log":
        "What has changed in the system and who changed it — agents published, configuration updated. Filter by type or by user to narrow the feed.",

    profile: "View and update your profile details.",
    docs: "Ask a question about Search2o and get an answer from the documentation. Each question is answered on its own \u2014 nothing is remembered between them, so ask a whole question rather than a follow-up.",
};

export function pageHelpKey(title: string): string {
    return title.trim().toLowerCase().replace(/\s+/g, "-");
}

export function pageHelp(key: string): string | undefined {
    return publishedPageHelp(key) ?? PAGE_HELP[key];
}
