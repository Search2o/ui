export const UI_TEXT_DEFAULTS = {
    "support.responseTime":
        "You will receive a response from {support.email} within 1 to 3 business days.",
    "support.email": "support@search2o.com",

    "upgrade.paid.unavailable": "Paid plans are not available yet.",
    "upgrade.paid.confirmTitle": "Move this account to the paid plan?",
    "upgrade.paid.confirmBody":
        "Billing starts today. The account is charged monthly: a platform fee, a fee for each developer, a storage fee for the agents, memories and conversations it keeps, and a usage fee for each search and agent run. This cannot be undone.",
    "upgrade.paid.done":
        "This account is now on the paid plan. Restart the agent server(s) for this to take effect.",

    "account.delete.title": "Permanently delete account?",
    "account.delete.body":
        "Deleting this account will permanently delete the account and its data. This action cannot be undone.",
    "account.delete.acknowledge":
        "I have backed up any agents and other information I need from this account. I understand that they will not be available after this account is deleted.",
    "account.delete.confirmPrompt": "To confirm, enter the account name below.",
    "account.limitedTitle": "This account has reached its limit",
    "account.limitedFallback": "This account cannot be used again until its usage limit resets.",
    "account.suspendedTitle": "Account suspended",
    "account.suspendedBody": "It will be deleted in a few days.",
    "account.suspendedLead": "This account has been suspended immediately.",

    "invoice.informational":
        "This invoice is for informational purposes only. This account is not charged.",
    "invoice.nothingCharged": "Nothing has been charged in this period.",

    "docs.url": "https://search2o.com/docs",
    "docs.disclaimer": "AI-generated. Verify against",
    "docs.disclaimerLinkText": "the documentation",
    "docs.placeholder": "e.g., How do I use the ask command inside a while loop?",
    "docs.heading": "Search2o documentation",
    "docs.subheading":
        "Ask how Search2o itself works. Answers come from the product documentation — this does not search your agents or your data.",
    "docs.tooShort": "Say a little more about what you want to know.",
    "docs.emptyAnswer": "Nothing came back. Try asking the question a different way.",

    "tokens.maxPerAccount": "10",
    "tokens.storageWarning":
        "Paste it into the integration\u2019s own settings. A token pasted into a chat channel stays in that workspace\u2019s history for good.",
    "tokens.empty": "No integrations can act as you yet.",
    "tokens.copyBlocked":
        "This browser will not let the page copy for you. Select the token instead.",

    "actionBar.unsaved": "Unsaved changes",
    "config.appliesToNewRuns":
        "Changes apply to agents that start running after this update. Agents already running will continue using the previous settings.",
    "allowlist.errors": "The marked entries have errors. Nothing was saved.",
    "config.appliesImmediately": "Changes take effect immediately.",
    "account.namePropagation":
        "The account name takes up to 15 minutes to appear at the top (refresh after that).",
    "config.compileUpdated":
        "Compile options updated. Changes apply only to agents published going forward. Previously published agents remain unaffected until they are republished.",
    "compile.rewriteTo": "Function name",
    "compile.rewriteNeedsName": "Name the function each rewritten operator uses.",
    "config.encryptionUpdated":
        "Encryption configuration has been updated. New agent executions will use the updated settings.",
    "config.secretsUpdated":
        "Secrets configuration has been updated. New agent executions will use the updated settings.",
    "config.hooksUpdated":
        "Hooks have been updated. Restart the agent server(s) for this to take effect.",
    "config.poolsUpdated":
        "API connection pools updated. Agents that start running after this update use the new settings.",
    "config.serversUpdated":
        "Agent server configurations have been updated. This requires the agent server(s) to be restarted, to take effect.",
    "servers.route.auth":
        "Signing in and out, single sign-on, and what the sign-in page reads before anyone has signed in.",
    "servers.route.exec": "Search, and running agents.",
    "servers.route.user": "Each user's own profile, conversations and integration tokens.",
    "servers.route.dev": "Drafts, published agents, descriptions and indexing.",
    "servers.route.admin": "Users, service accounts, the license and every configuration page.",
    "servers.route.reports": "The performance, error, cost and usage reports.",
    "servers.route.owner": "The account, billing and invoices.",
    "servers.routesEvery": "Every route",
    "servers.routesOnly": "Only these routes",
    "servers.routesUiNeeds":
        "The UI served from this agent server cannot start without the auth and user routes. Leave them out only if people use a UI hosted elsewhere.",

    "encryption.rotate.title": "Rotate the encryption key?",
    "encryption.rotate.body":
        "New data will be encrypted with the new key. Data encrypted with earlier keys stays readable.",
    "encryption.rotate.restartNote":
        "Agent servers keep using the previous key until they are restarted.",
    "encryption.rotate.cadence": "The key can be rotated once every 90 days.",
    "encryption.rotate.nextAllowed": "It can be rotated again after",
    "encryption.rotate.rotatedAt": "Rotated",
    "encryption.rotate.done": "The encryption key has been rotated.",

    "placeholder.sharedPool": "Empty: one pool shared by every run",
    "placeholder.searchQuery": "Ask a question…",
    "placeholder.agentRunQuery": "Enter a search query",
    "placeholder.filterAgentList": "Filter by name, title or tag…",
    "placeholder.draftTitle": "Enter a title.",
    "placeholder.bundledUi": "Leave empty for the bundled UI",
    "placeholder.neverExpires": "Never expires",
    "placeholder.newUserEmails": "Enter emails of new users separated by spaces/newlines",
    "placeholder.userLookup": "Opens the user's details — searches every role…",
    "placeholder.displayName": "Your name as seen by others",
    "placeholder.mustBeSpecified": "Must be specified",
    "placeholder.optional": "optional",

    "welcome.title": "Welcome to Search2o",
    "welcome.subtitle": "Here is where everything is.",
    "welcome.ask.title": "Ask a question",
    "welcome.ask.body":
        "Type what you want to know. Search2o picks the agent that answers it and runs it for you.",
    "welcome.searches.title": "Your searches",
    "welcome.searches.body":
        "Every conversation is kept here. Pin the ones you come back to, and pick up where you left off.",
    "welcome.platform.title": "Platform and Searches",
    "welcome.platform.body":
        "Switch the panel below between your conversations and everything you can configure.",
    "welcome.replay": "Show me around",
    "welcome.dismiss": "Get started",

    "welcome.group.Agents":
        "The agents themselves — the ones you are drafting and the ones you have published.",
    "welcome.group.Profiles":
        "What agents connect to: models, REST services, databases and MCP servers. Named once here, used by name in every agent.",
    "welcome.group.Guardrails":
        "What an agent is allowed to do — which Python compiles, what that code may call and read, and how far a run may go.",
    "welcome.group.Operations":
        "The servers that run your agents, the connections they open, how they hold secrets, and the hooks your own code adds.",
    "welcome.group.Reports":
        "What ran and what it cost, what failed and where, and who has been using it.",
    "welcome.group.Admin":
        "Who may use this account, people and programs, how they sign in, and your licence key.",
    "welcome.group.Billing": "Your account details, and what this account is being charged.",

    "welcome.icon.auditLog.title": "Audit log",
    "welcome.icon.auditLog.body":
        "What changed and who changed it — agents published, configuration updated.",
    "welcome.icon.docs.title": "Docs",
    "welcome.icon.docs.body":
        "Ask how Search2o itself works, and get an answer from the documentation.",
    "welcome.icon.help.title": "Contact us",
    "welcome.icon.help.body": "Send us a message when something is not working or not clear.",
    "welcome.newSearch.title": "New search",
    "welcome.newSearch.body": "Starts a fresh question from wherever you are.",
    "welcome.profile.title": "Your profile",
    "welcome.profile.body":
        "Your name, theme and password, the integrations that can act as you, and the way out.",

    "signIn.codeSent.body":
        "Your code is on its way. It should arrive within a minute — if it does not, have a look in your spam folder.",
    "signIn.codeSent.onlyIfKnown":
        "We only send a code to an address that is already set up here, so if nothing turns up, it is worth checking the address for a typo.",

    "serviceAccounts.keyOnce":
        "This is the only time this key will be shown. Copy it to a safe place; if it is lost, rotate the key to get another.",
    "serviceAccounts.keyUsage": "A program sends this key with every request, as a header:",
    "serviceAccounts.rotateBody":
        "The current key stops working immediately. Anything still using it will be refused until it is given the new key.",
    "serviceAccounts.deleteBody":
        "Its key stops working immediately, and the service account cannot be recovered.",
    "serviceAccounts.noKeyReturned":
        "No key came back from the server. Rotate the service account's key to get one.",
    "serviceAccounts.copyBlocked":
        "Your browser did not allow copying. Select the key and copy it instead.",

    "auth.passwordsNeedSso":
        "Password sign-in can be turned off once single sign-on has been saved.",
    "auth.keepPasswordsOn":
        "Keep this on until someone has signed in with single sign-on successfully.",
    "auth.passwordsOff":
        "Only single sign-on can be used. If the identity provider cannot be reached, nobody can sign in.",
    "auth.turnOffPasswords":
        "There is no back door. If your identity provider cannot be reached, nobody can sign in, and the only way back is a support request. Turn this off only after single sign-on has been proven.",
    "auth.returnUrlMatch":
        "Register exactly this address at your identity provider as the application's redirect URI. If the two differ at all, even by a trailing slash, the provider refuses the sign-in.",
    "auth.clientSecretStored":
        "A secret is stored and is not shown. Leave this empty to keep it, or enter a new one to replace it.",
    "auth.removingPeople":
        "Removing someone at your identity provider stops them starting a new session, but does not end the sessions they already have or revoke their integration tokens. Remove them in Search2o as well.",

    "empty.agents": "No agents to display.",
    "empty.drafts": "No drafts yet. Create one to get started.",
    "empty.filtered": "Nothing matches the filter.",
    "empty.users": "No users to display.",
    "empty.serviceAccounts": "No service accounts yet.",
    "users.sendInvite": "Email an invitation to each new user",
    "users.sendInviteOff":
        "They will be added, but will not hear from us — you will need to tell them yourself.",
    "empty.auditLog": "No entries in this period.",
    "empty.llmProfiles": "No LLM profiles are configured yet.",
    "empty.apiProfiles": "No API profiles are configured yet.",
    "empty.dbProfiles": "No database profiles are configured yet.",
    "empty.mcpServers": "No MCP servers are configured yet.",
    "empty.encryptionKeys": "No encryption keys added yet.",

    "report.range": "Reports cover the last 3 months.",
    "report.coversAllUsers": "Covers all users in the selected range, not just the current page.",
    "report.noAgentsExecuted": "No agents were executed in the selected range.",
    "report.agentNotExecuted": "This agent was not executed in the selected range.",
    "report.noCost": "No cost recorded in the selected range.",
    "report.noVersionCost": "No cost recorded for this version in the selected range.",
    "report.clickVersionCost": "Click a version to see its cost trend.",
    "report.failuresElsewhere": "Failures are broken down in the agent error report.",
    "report.noAgentFailed": "No agent failed in the selected range.",
    "report.agentNoFailures": "This agent did not fail in the selected range.",
    "report.noVersionErrors": "No errors recorded for this version in the selected range.",
    "report.queriesPrivate":
        "What users asked is not shown here. Queries are never exposed to other people.",
    "report.noUserActivity": "No user activity in the selected range.",
    "report.noExecutions": "No executions in the selected range.",
    "report.noAgentsUsed": "No agents were used in the selected range.",

    "delete.cannotBeUndone": "Deleting cannot be undone.",
    "delete.agentCannotBeUndone": "Deleting an agent cannot be undone.",
    "delete.userCannotBeUndone": "Deleting a user cannot be undone.",
    "delete.profileCannotBeUndone": "Deleting a profile cannot be undone.",
    "delete.apiInUse": "Agents are using this API; deleting it will break them.",
    "delete.dbInUse": "Agents are using this profile; deleting it will break them.",
    "delete.mcpInUse": "Agents are using this server; deleting it will break them.",
    "delete.llmInUse": "Agents are using this profile; it cannot be deleted.",
    "delete.draftKeepsAgent": "This does not delete any published agent.",
    "agent.deindexFirst": "Remove this agent from the search index before deleting it.",
    "agent.memoryLabelsWarning":
        "Deleting this agent deletes every user's memories stored under these labels.",
    "agent.removeFromIndexTitle": "Remove from the search index?",
    "users.actionCannotBeUndone": "This action cannot be undone.",

    "draft.changedByAnother":
        "It was published again after this draft was created, so the draft cannot be published as it is. Merge combines those changes with yours and saves the result; the draft then has to be validated again before it can be published.",
    "draft.mergedValidateAgain": "Merged and saved. Validate the draft before publishing it.",
    "draft.mergeEmpty": "No merged definition came back. Reload the draft to see what it holds.",
    "draft.profileNotConfigured": "No longer configured",
    "draft.tabs.waitForAi": "Wait for the AI to finish.",
    "draft.tabs.waitForValidation": "Wait for validation to finish.",
    "draft.readyToPublish": "Validated. This draft is ready to publish.",
    "agent.descriptionPrompt": "Describe what this agent does in a few lines.",
    "agent.descriptionPurpose":
        "How search decides this agent answers a query. Without it the agent is never matched.",
    "indexing.wait": "Carry on elsewhere. Reloading or closing the tab loses the result.",
    "indexing.stillWorking": "Still working. A large agent takes longer than a small one.",
    "agent.indexedOk":
        "The description was indexed successfully. Search queries will now match the agent against the new description.",
    "agent.removedFromIndex":
        "The agent is out of the search index. Searches will not match it until it is indexed again.",
    "agent.descriptionRejected": "Edit it above and index again.",
    "agent.nameLocked": "A published agent's name cannot be changed.",
    "agent.tagLocked":
        "The tag of a published agent can be changed from the Published agents list.",
    "draft.publishedDone": "Your agent is published and live.",
    "draft.indexChoiceNotIndexed":
        "It is not in the search index yet, so searches will not find it. To add it, write a short description of what it does. You can do this now, or later on the agent's page.",
    "draft.indexingHere":
        "Checking and indexing the description can take a minute or more. Stay here until it is done: if the description is refused, it comes back here to be fixed.",
    "draft.indexChoiceIndexed":
        "It is already in the search index, found by its current description. If this version does something different, change the description so searches keep finding it for the right questions.",
    "draft.runCancelled": "Validation cancelled. Nothing from that run was saved.",
    "draft.validationQueryHelp":
        "A typical user query, saved with the draft. A draft must validate against one before it can be published.",
    "draft.followupHelp":
        "Asked of the conversation the last run started. It is not saved with the draft.",

    "prompt.intro":
        "Each llm command names one of these. The system and user prompts are expressions, like the rest of the agent: plain text, or { ... } Python, worked out on every LLM call in the scope of the function that makes it. A user prompt may also work out to a content part, such as an image with data and mimeType, or a list of parts.",
    "prompt.scope.conversation": "One history, shared by every agent in the conversation.",
    "prompt.scope.agent": "This agent's own history in the conversation.",
    "prompt.scope.local":
        "A history for one run only. It is kept across an ask, and starts empty on the next run.",
    "prompt.nameRequired": "Every prompt needs a name.",
    "prompt.needsText": "give it a system prompt, a user prompt or both.",
    "prompt.duplicateName": "another prompt already has this name.",
    "validate.promptName":
        "letters, numbers and underscores only, starting with a letter and ending with a letter or number. Up to 100 characters.",
    "prompt.publishedHelp":
        "Prompts are changed in a draft, where the agent is validated with them, and take effect when the draft is published.",
    "prompt.notVersioned":
        "Prompts are not versioned, so a past version has none of its own. These are the agent's current prompts.",
    "empty.agentPrompts": "This agent has no prompts.",
    "empty.draftPrompts": "No prompts yet. An llm command needs one to name.",

    "const.help":
        "A JSON object the agent reads as const, for example const.region. It is stored encrypted, so the cloud cannot read it.",
    "const.publishedHelp":
        "Changed only in a draft. A change takes effect when the draft is published.",
    "empty.agentConst": "This agent has no const.",
    "const.decryptFailed": "The stored const could not be decrypted, so it is shown empty.",
    "const.replaceOnSave":
        "Saving a const here replaces the stored one. Leave it empty to keep the stored one as it is.",
    "const.replaceInDraft":
        "The agent keeps its stored const. To replace it, set a new const in a draft and publish.",
    "publish.metaChanged":
        "The published agent was changed after this draft was made from it. These differ between the draft and the agent:",
    "publish.metaOverwrite":
        "Publishing anyway replaces them with the draft's. The changes made on the published agent will be lost.",

    "validate.serviceAccountName":
        "Use letters and digits, with '_', '-' or '.' between them, starting and ending with a letter or a digit. Up to 64 characters.",
    "validate.agentName":
        "An agent name must start with a letter, end with a letter or number, and contain only letters, numbers and underscores. Up to 32 characters.",
    "validate.agentTag":
        "A tag must be lower-case letters and digits, with single underscores between them. Up to 16 characters.",
    "validate.profileNameChars":
        "Letters, numbers and underscores. Start with a letter, end with a letter or number. Up to 50 characters.",
    "validate.mcpNameChars":
        "Letters and numbers only, starting with a letter — the name has to be valid as an LLM tool name. 2 to 16 characters.",
    "validate.profileNameRequired": "Please enter a profile name.",
    "validate.serverNameRequired": "Every server configuration must have a name.",
    "validate.poolName":
        "A pool name must start with a letter, end with a letter or number, and contain only letters, numbers and underscores. Up to 50 characters.",
    "validate.poolNameRequired": "Every pool needs a name.",
    "validate.encryptionKeyRequired":
        "At least one encryption key is required for client encryption.",
    "validate.encryptionKeyName": "Each encryption key must have a key name.",
    "validate.encryptionKeyNameRule":
        "A key name may hold letters, digits and _ . - : /, must start and end with a letter or digit, and can be at most 256 characters.",
    "validate.maxTime": "The run time limit must be a whole number of seconds, at least 1.",
    "validate.maxCost": "The cost limit must be more than 0 dollars.",
    "validate.importPath":
        "Each hook must be a dotted Python import path, such as mycompany.hooks.on_agent_end. Up to 200 characters.",
    "validate.passwordBoth": "Enter both your current password and the new one.",
    "validate.queryTooShort": "Query is too short. Please type a longer query to search.",
    "validate.expiryDate": "Please choose a valid expiration date and time.",

    "search.noMatchHint": "Try asking in different words.",
    "search.runCancelled": "Run cancelled. Nothing from it was saved.",

    "account.accountIdHelp": "An automatically assigned account ID, used for billing.",
    "sysVariables.userEmail": "Email of the user.",
    "sysVariables.userSession":
        "A hashed value of the session ID of the user in the agent server. This can be used to store data that is specific to the current user session.",
    "sysVariables.serverIp":
        "IP address of the agent server as seen by the cloud. This can be used in logging server specific activity.",
    "sysVariables.cookies":
        "User cookies in the request. These can expose the raw session ID of the user and other secret values. Turn it on only where an agent needs them.",
    "sysVariables.removeTitle": "Turn off %names%?",
    "sysVariables.removeBody":
        "Any agent or profile that reads %names% will fail at its next run, and nothing here says which ones do. Check them before turning it off.",
    "sysVariables.removeConfirm": "Turn off",
    "sysVariables.removeKeep": "Keep it on",
    "sysVariables.inputs": "The inputs this run was started with, keyed by name.",
    "sysVariables.query": "The question the user asked.",
    "sysVariables.secret":
        "The secrets this account has configured. Where they are read from is set on the Secrets & encryption page.",
    "help.userRole":
        "Determines what this user can do. Developers and above can build agents; a plain user can only search.",
    "help.profileDocUse":
        "What this profile is for and when an agent should use it. Used when an agent draft is generated from a description.",
    "help.llmPricing":
        "Prices are per million tokens and are what agent runs are charged at. A blank price counts as 0, which reports this model as free.",
    "help.llmSystemPrompt": "Leave empty to use the built-in prompt.",
    "help.dbOptions": "Optional driver-specific connection options.",
    "help.dbValidate": "Validate connections before using them.",
    "help.defaultServerConfig":
        "Used when the agent server is started with a license key that has no suffix. The default configuration cannot be renamed or deleted.",
    "help.fallbackPool": "The fallback pool cannot be renamed or removed.",
    "pools.certificateWarning":
        "Certificates here can stop the agent server working, unless its calls go through a proxy that handles them. A CA certificate file replaces the authorities trusted by default rather than adding to them.",

    "api.addPath.can": "An api command can add a path to this URL",
    "api.addPath.cannot": "Calls go to this URL exactly, with no path added",
    "api.addPath.must": "An api command must add a path to this URL",
    "api.canAddHeaders": "An api command can add more headers",
    "api.canAddQueryParams": "An api command can add more query parameters",
    "secrets.openVaultHook": "Set up the vault hook",
    "encryption.openKeyHook": "Set up the encryption key hook",
    "help.secretTransform":
        "Transformations to apply to the secret name, before the environment variable is looked up or the file is read.",
    "help.dynamicExpression":
        "Accepts a Python expression in { } braces, evaluated at execution time.",
    "help.freeze":
        "This will freeze any changes to the system other than administrative functions.",
    "help.limitsSection": "Stop a run that goes too far.",
    "help.executionSection": "How the engine runs and monitors agents — knobs, not ceilings.",

    "trace.output": "What the agent produced — the output parts a user would see.",
    "trace.progress": "Progress notes emitted while the run is under way.",
    "trace.authorNotes":
        "The `trace` command written in the agent definition \u2014 the author's own notes. (`trace`, `progress`, `log` and `output` carry only a string, so they are not traced as input or output.)",
    "trace.flow":
        "Command and function boundaries, if-conditions, loop conditions and completions, break and continue when they fire, `end`, and the compile checks.",
    "trace.inputs":
        "What each command was called with — the LLM request, API URL and headers, SQL, prompt text, a called function's args, and the fields an `ask` presented.",
    "trace.results":
        "What each command produced — LLM content and token counts, API bodies, DB row counts, a function's return value, what a `var` assigned, and the answers an `ask` came back with.",
    "trace.tools": "Tool calls the LLM makes, their arguments and results, and MCP discovery.",
    "trace.errors": "Every failure, whatever raised it — so 'errors only' is complete.",

    "connect.signInPrompt": "Sign in to approve this request.",
    "connect.approved": "You can close this and return to the app that asked.",
    "connect.rejected": "Nothing was connected. You can close this window.",
    "connect.expired": "Start again from the app that asked to connect.",

    "aiAssist.placeholder": "Describe the agent, or what to change in this one",
    "aiAssist.inputLabel": "What should the agent do?",
    "aiAssist.working": "Writing the code takes a moment.",
    "aiAssist.tooShort": "Say a little more about what you want.",
    "aiAssist.emptyAnswer": "Nothing came back. Try describing what you want differently.",
    "aiAssist.replaced": "The draft was replaced with the answer.",

    "run.connectionLost": "The connection to the server was lost, so this run was stopped.",
    "run.noOutput": "Agent executed successfully without an output.",
} as const;

export type UiTextKey = keyof typeof UI_TEXT_DEFAULTS;
