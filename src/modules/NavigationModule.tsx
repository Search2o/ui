import { Suspense, useCallback, useEffect, useRef, useState, type UIEvent } from "react";
import { HoverTip } from "@/shared/HoverTip";
import { DeleteConversationDialog } from "@/shared/DeleteConversationDialog";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { LazyModules } from "@/shared/moduleRegistry";
import { toast } from "sonner";
import {
    ChevronDown,
    ChevronUp,
    Mail,
    Loader2,
    Menu,
    NotebookText,
    Pencil,
    Pin,
    PinOff,
    Logs,
    SquarePen,
    Trash2,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { HelpDialog } from "@/shared/HelpDialog";
import { ErrorBoundary } from "@/shared/ErrorBoundary";
import { PageErrorScreen, AppUpdatedScreen } from "@/shared/ErrorScreens";
import { isModuleLoadError } from "@/shared/appUpdated";
import { useSession } from "@/shared/useSession";
import { isSearchModule, setSearchWorkspace, useSearchWorkspace } from "@/shared/searchWorkspace";
import { onPagedListReset, resetPagedList } from "@/shared/pagedList";
import type { SearchHistoryModel } from "@/orval/search2o.schemas";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import { MAX_LENGTHS } from "@/shared/schemaRules";
import {
    type RailGroup,
    type RailItem,
    canSeeAdminActions as isAdmin,
    canSeeDevActions as isDeveloper,
    railGroupsFor,
} from "@/shared/railGroups";

function LoadingInline() {
    return (
        <div className="rounded-2xl border bg-card text-card-foreground shadow-sm px-6 py-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
    );
}

const RAIL_SECTION_HEADING = "mt-5 px-2.5 pb-1.5 text-[12px] font-semibold text-[#8fa39f]";

function formatHistoryDate(epochMs?: number | null): string {
    if (!epochMs) return "";
    const d = new Date(epochMs);
    const now = new Date();

    const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const diffDays = Math.round(
        (startOfDay(now).getTime() - startOfDay(d).getTime()) / (24 * 60 * 60 * 1000),
    );

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays >= 2 && diffDays <= 6) return `${diffDays} days ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const DEFAULT_COLLAPSED: Record<string, boolean> = {
    Profiles: true,
    Guardrails: true,
    Operations: true,
    Admin: true,
    Billing: true,
};

const RAIL_GROUP_LABELS = new Set([
    "Agents",
    "Profiles",
    "Guardrails",
    "Operations",
    "Reports",
    "Admin",
    "Billing",
]);

const CRUMBS: Record<UI.ModuleKey, string[]> = {
    SearchHistory: ["Search"],
    SearchConversation: ["Search", "Conversation"],
    Drafts: ["Agents", "Draft agents"],
    DraftEdit: ["Agents", "Draft agents", "Edit"],
    Agents: ["Agents", "Published agents"],
    AgentView: ["Agents", "Published agents", "View"],
    AgentRun: ["Agents", "Published agents", "Run"],
    Users: ["Admin", "Users"],
    UserView: ["Admin", "Users", "User"],
    License: ["Admin", "License"],
    SecretsEncryption: ["Operations", "Secrets & encryption"],
    AuthenticationConfig: ["Admin", "Authentication"],
    ServiceAccounts: ["Admin", "Service accounts"],
    AgentServerConfig: ["Operations", "Agent servers"],
    ApiConnectionPools: ["Operations", "API connection pools"],
    HooksConfig: ["Operations", "Hooks"],
    ValidationConfig: ["Guardrails", "Agent runtime"],
    AllowlistConfig: ["Guardrails", "Allowlist"],
    SysVarConfig: ["Guardrails", "System variables"],
    OperatorsConfig: ["Guardrails", "Compile rules"],
    LlmProfile: ["Profiles", "LLM profiles"],
    LlmProfileDetail: ["Profiles", "LLM profiles", "Profile"],
    MCPConfig: ["Profiles", "MCP servers"],
    MCPConfigDetail: ["Profiles", "MCP servers", "Server"],
    ApiConfig: ["Profiles", "API profiles"],
    ApiConfigDetail: ["Profiles", "API profiles", "Profile"],
    DbConfig: ["Profiles", "Database profiles"],
    DbConfigDetail: ["Profiles", "Database profiles", "Profile"],
    PromptConfig: ["Profiles", "Prompt profiles"],
    PromptConfigDetail: ["Profiles", "Prompt profiles", "Profile"],
    AgentPerformanceReport: ["Reports", "Agent performance"],
    AgentCostReport: ["Reports", "Agent cost"],
    UserUsageReport: ["Reports", "User usage"],
    AgentDetailReport: ["Reports", "Agent performance", "Agent detail"],
    AgentCostDetailReport: ["Reports", "Agent cost", "Cost detail"],
    AgentErrorReport: ["Reports", "Agent errors"],
    AgentErrorDetailReport: ["Reports", "Agent errors", "Error detail"],
    UserDetailReport: ["Reports", "User usage", "User detail"],
    Docs: ["Docs"],
    Billing: ["Billing", "Invoices"],
    Account: ["Billing", "Account"],
    AuditLog: ["Audit log"],
    Profile: ["Profile"],
};

const RECENT_PAGE_SIZE = 25;

function useRecentConversations(enabled: boolean) {
    const [pinned, setPinned] = useState<SearchHistoryModel[]>([]);
    const [recent, setRecent] = useState<SearchHistoryModel[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const cursorRef = useRef<string | null>(null);
    const busyRef = useRef(false);

    const loadPinned = useCallback(async () => {
        try {
            const resp = await API.getPinnedConversations({});
            if (resp.success) setPinned(resp.pinnedConversations ?? []);
        } catch {}
    }, []);

    const loadPage = useCallback(async (reset: boolean) => {
        if (busyRef.current) return;
        if (!reset && cursorRef.current == null) return;
        busyRef.current = true;
        try {
            const resp = await API.getUnpinnedConversations({
                limit: RECENT_PAGE_SIZE,
                nextCursor: reset ? undefined : cursorRef.current,
            });
            if (resp.success) {
                const batch = resp.unpinnedConversations ?? [];
                cursorRef.current = resp.nextCursor ?? null;
                setHasMore(cursorRef.current != null);
                setRecent((prev) => (reset ? batch : [...prev, ...batch]));
            }
        } catch {
        } finally {
            busyRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;
        void loadPinned();
        void loadPage(true);
        return onPagedListReset("searchHistory", () => {
            void loadPinned();
            void loadPage(true);
        });
    }, [enabled, loadPage, loadPinned]);

    const loadMore = useCallback(() => void loadPage(false), [loadPage]);

    const togglePin = useCallback(
        async (h: SearchHistoryModel) => {
            try {
                const resp = await API.setPinned({ convid: h.convid, pinned: !h.pinned });
                if (!resp.success) {
                    toast.error(resp.error?.message || "Failed to update the pin");
                    return;
                }
                void loadPinned();
                void loadPage(true);
            } catch (e) {
                toast.error(errorText(e, "Failed to update the pin"));
            }
        },
        [loadPage, loadPinned],
    );

    const rename = useCallback(async (convid: string, title: string) => {
        try {
            const resp = await API.setConversationTitle({ convid, title });
            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to rename the conversation");
                return false;
            }
            const patch = (l: SearchHistoryModel[]) =>
                l.map((x) => (x.convid === convid ? { ...x, title } : x));
            setPinned(patch);
            setRecent(patch);
            return true;
        } catch (e) {
            toast.error(errorText(e, "Failed to rename the conversation"));
            return false;
        }
    }, []);

    const remove = useCallback(async (convid: string) => {
        try {
            const resp = await API.deleteConversation({ convid });
            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to delete the conversation");
                return false;
            }
            resetPagedList("searchHistory");
            return true;
        } catch (e) {
            toast.error(errorText(e, "Failed to delete the conversation"));
            return false;
        }
    }, []);

    return { pinned, recent, hasMore, loadMore, togglePin, rename, remove };
}

const ROLE_LABELS: Record<string, string> = {
    user: "User",
    developer: "Developer",
    admin: "Administrator",
    owner: "Account Owner",
};

export default function NavigationModule() {
    const { user, accountName, signOut } = useSession();

    const open = UI.openModule;
    const active = UI.useActiveModule();
    const ActiveCmp = LazyModules[active];
    const role = user?.role;

    const [helpOpen, setHelpOpen] = useState(false);
    const [railOpen, setRailOpen] = useState(false);

    const logout = useCallback(async () => {
        const failed = await signOut();
        if (failed) toast.error(failed);
    }, [signOut]);

    const canSeeAdminActions = isAdmin(role);
    const canSeeDevActions = isDeveloper(role);

    const showWorkspaceRail = useSearchWorkspace();

    const {
        pinned,
        recent,
        hasMore: recentHasMore,
        loadMore: loadMoreRecent,
        togglePin,
        rename,
        remove: removeConversation,
    } = useRecentConversations(showWorkspaceRail);
    const activePayload = UI.useModulePayload<{ convid?: string }>() ?? {};

    const [railRenamingId, setRailRenamingId] = useState<string | null>(null);
    const [railRenameText, setRailRenameText] = useState("");
    const submitRailRename = async () => {
        const convid = railRenamingId;
        const title = railRenameText.trim();
        if (!convid) return;
        if (!title) {
            setRailRenamingId(null);
            return;
        }
        if (await rename(convid, title)) setRailRenamingId(null);
    };

    const [railPendingDelete, setRailPendingDelete] = useState<SearchHistoryModel | null>(null);

    const confirmRailDelete = async () => {
        const target = railPendingDelete;
        setRailPendingDelete(null);
        if (!target) return;
        if (await removeConversation(target.convid)) {
            if (activePayload.convid === target.convid) UI.openModule("SearchHistory");
        }
    };

    const onRailScroll = (e: UIEvent<HTMLElement>) => {
        if (!showWorkspaceRail || !recentHasMore) return;
        const el = e.currentTarget;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) loadMoreRecent();
    };

    const groups: RailGroup[] = railGroupsFor(role);

    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
        try {
            const raw = localStorage.getItem("ui.nav.collapsed");
            if (raw) return JSON.parse(raw) as Record<string, boolean>;
        } catch {}
        return DEFAULT_COLLAPSED;
    });
    const toggleGroup = (label: string) => {
        setCollapsed((prev) => {
            const next = { ...prev, [label]: !prev[label] };
            try {
                localStorage.setItem("ui.nav.collapsed", JSON.stringify(next));
            } catch {}
            return next;
        });
    };

    const isItemActive = (item: RailItem) =>
        active === item.key || (item.aliases?.includes(active) ?? false);

    const openFromRail = (key: UI.ModuleKey) => {
        setRailOpen(false);
        open(key);
    };

    const crumbs = (CRUMBS[active] ?? [active])
        .filter((c) => !RAIL_GROUP_LABELS.has(c))
        .slice(0, -1);

    const railConversationRow = (h: SearchHistoryModel) => {
        const on = active === "SearchConversation" && activePayload.convid === h.convid;
        if (railRenamingId === h.convid) {
            return (
                <form
                    key={h.convid}
                    className="px-1 py-0.5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submitRailRename();
                    }}
                >
                    <input
                        autoFocus
                        maxLength={MAX_LENGTHS.CONVERSATION_TITLE.max}
                        value={railRenameText}
                        onChange={(e) => setRailRenameText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") setRailRenamingId(null);
                        }}
                        onBlur={() => setRailRenamingId(null)}
                        aria-label="Conversation title"
                        className="w-full rounded-lg border border-[#2b4a46] bg-[#1d3532] px-2 py-1 text-[13px] text-white outline-none focus:border-[#63c1b4]"
                    />
                </form>
            );
        }
        return (
            <div key={h.convid} className="group relative">
                <HoverTip
                    tip={[h.title, formatHistoryDate(h.lastExecuted)].filter(Boolean).join(" · ")}
                >
                    <button
                        type="button"
                        onClick={() => {
                            setRailOpen(false);
                            open("SearchConversation", { convid: h.convid });
                        }}
                        aria-current={on ? "page" : undefined}
                        className={
                            "block w-full truncate rounded-lg px-2.5 py-1.5 pr-14 text-left text-[13px] transition-colors " +
                            (on
                                ? "bg-[#0d7d72] font-semibold text-white"
                                : "text-[#cfd8d5] hover:bg-[#1d3532] hover:text-white")
                        }
                    >
                        {h.title}
                    </button>
                </HoverTip>
                <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-40 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <HoverTip tip={h.pinned ? "Unpin" : "Pin"}>
                        <button
                            type="button"
                            aria-label={h.pinned ? "Unpin conversation" : "Pin conversation"}
                            onClick={() => void togglePin(h)}
                            className="rounded p-1 text-[#7d908c] hover:bg-[#2b4a46] hover:text-white"
                        >
                            {h.pinned ? (
                                <PinOff className="h-3.5 w-3.5" />
                            ) : (
                                <Pin className="h-3.5 w-3.5" />
                            )}
                        </button>
                    </HoverTip>
                    <HoverTip tip="Rename">
                        <button
                            type="button"
                            aria-label="Rename conversation"
                            onClick={() => {
                                setRailRenamingId(h.convid);
                                setRailRenameText(h.title);
                            }}
                            className="rounded p-1 text-[#7d908c] hover:bg-[#2b4a46] hover:text-white"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    </HoverTip>
                    <HoverTip tip="Delete">
                        <button
                            type="button"
                            aria-label="Delete conversation"
                            onClick={() => setRailPendingDelete(h)}
                            className="rounded p-1 text-[#7d908c] hover:bg-[#5b2b2b] hover:text-white"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </HoverTip>
                </div>
            </div>
        );
    };

    const rail = (
        <div className="flex h-full flex-col bg-[#142524] text-[#cfd8d5]">
            <button
                type="button"
                onClick={() => openFromRail("SearchHistory")}
                className="px-5 pb-2 pt-5 text-left text-[17px] font-bold tracking-tight text-white"
                aria-label="Search2o home"
            >
                Search<span className="text-[#63c1b4]">2o</span>
            </button>

            <nav
                className="flex-1 overflow-y-auto px-3 pb-3 [color-scheme:dark] [scrollbar-width:thin]"
                aria-label="Main navigation"
                onScroll={onRailScroll}
            >
                <button
                    type="button"
                    onClick={() => openFromRail("SearchHistory")}
                    aria-current={active === "SearchHistory" ? "page" : undefined}
                    className={
                        "mt-2 flex w-full items-center gap-2 rounded-lg border border-[#2b4a46] px-2.5 py-1.5 text-left text-[13px] transition-colors " +
                        (active === "SearchHistory"
                            ? "bg-[#1d3532] font-medium text-white"
                            : "text-[#cfd8d5] hover:bg-[#1d3532] hover:text-white")
                    }
                >
                    <SquarePen className="h-3.5 w-3.5 shrink-0" />
                    New search
                </button>

                {canSeeDevActions ? (
                    <div
                        role="tablist"
                        aria-label="Rail contents"
                        className="mt-3 flex gap-0.5 rounded-lg bg-[#0f1f1e] p-0.5"
                    >
                        {[
                            { label: "Platform", on: !showWorkspaceRail },
                            { label: "Searches", on: showWorkspaceRail },
                        ].map((tab) => (
                            <button
                                key={tab.label}
                                type="button"
                                role="tab"
                                aria-selected={tab.on}
                                aria-controls="rail-section"
                                onClick={() => {
                                    const toSearches = tab.label === "Searches";
                                    setSearchWorkspace(toSearches);
                                    if (toSearches && !isSearchModule(active)) {
                                        openFromRail("SearchHistory");
                                    }
                                    setRailOpen(false);
                                }}
                                className={
                                    "flex-1 rounded-md px-2 py-1 text-[12px] transition-colors " +
                                    (tab.on
                                        ? "bg-[#1d3532] font-semibold text-white"
                                        : "text-[#8fa39f] hover:text-[#cfd8d5]")
                                }
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                ) : null}

                <div
                    id="rail-section"
                    key={showWorkspaceRail ? "searches" : "menu"}
                    className="animate-in fade-in duration-150"
                >
                    {showWorkspaceRail ? (
                        <>
                            {pinned.length > 0 && (
                                <>
                                    <div className={RAIL_SECTION_HEADING}>Pinned</div>
                                    {pinned.map((h) => railConversationRow(h))}
                                </>
                            )}
                            {recent.length > 0 && (
                                <>
                                    <div className={RAIL_SECTION_HEADING}>Recent</div>
                                    {recent.map((h) => railConversationRow(h))}
                                </>
                            )}
                            {pinned.length === 0 && recent.length === 0 && (
                                <p className="mt-4 px-2.5 text-[12px] leading-relaxed text-[#7d908c]">
                                    Nothing here yet. Your searches will be listed here once you ask
                                    something.
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            {groups.map((group) => {
                                const holdsActive = group.items.some(isItemActive);
                                const isCollapsed = Boolean(collapsed[group.label]) && !holdsActive;
                                return (
                                    <div key={group.label}>
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group.label)}
                                            aria-expanded={!isCollapsed}
                                            className={`${RAIL_SECTION_HEADING} flex w-full items-center gap-1.5 text-left transition-colors hover:text-[#cfd8d5]`}
                                        >
                                            <ChevronDown
                                                className={
                                                    "h-3 w-3 shrink-0 transition-transform " +
                                                    (isCollapsed ? "-rotate-90" : "")
                                                }
                                            />
                                            {group.label}
                                        </button>
                                        {!isCollapsed &&
                                            group.items.map((item) => {
                                                const on = isItemActive(item);
                                                return (
                                                    <button
                                                        key={item.key}
                                                        type="button"
                                                        onClick={() => openFromRail(item.key)}
                                                        aria-current={on ? "page" : undefined}
                                                        className={
                                                            "block w-full rounded-md px-2.5 py-1.5 pl-[18px] text-left text-[13px] transition-colors " +
                                                            (on
                                                                ? "bg-[#0d7d72] font-semibold text-white"
                                                                : "text-[#cfd8d5] hover:bg-[#1d3532] hover:text-white")
                                                        }
                                                    >
                                                        {item.label}
                                                    </button>
                                                );
                                            })}
                                    </div>
                                );
                            })}
                            {canSeeDevActions && !canSeeAdminActions && (
                                <div>
                                    <div className={RAIL_SECTION_HEADING}>Admin</div>
                                    <div className="px-2.5 py-1.5 text-[12px] italic text-[#7d908c]">
                                        Administrator access
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </nav>

            <DeleteConversationDialog
                open={railPendingDelete !== null}
                title={railPendingDelete?.title ?? ""}
                onOpenChange={(open) => {
                    if (!open) setRailPendingDelete(null);
                }}
                onConfirm={() => void confirmRailDelete()}
            />

            <div className="flex min-h-16 items-center border-t border-[#24403d] px-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[#1d3532]"
                        >
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#63c1b4] text-[11px] font-bold text-[#0c1a19]">
                                {(user?.userName ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium text-white">
                                    {user?.userName ?? user?.email ?? "User"}
                                </span>
                                <span className="block truncate text-[11px] text-[#7d908c]">
                                    {role ? (ROLE_LABELS[role] ?? role) : ""}
                                </span>
                            </span>
                            <ChevronUp className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-56">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Signed in as
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                            className="px-2 py-2 text-sm font-medium"
                            onSelect={() => openFromRail("Profile")}
                        >
                            <span className="truncate">
                                {user?.userName ?? user?.email ?? "User"}
                            </span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={() =>
                                window.dispatchEvent(new CustomEvent("s2o:show-welcome"))
                            }
                        >
                            {uiText("welcome.replay")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={(e) => {
                                e.preventDefault();
                                void logout();
                            }}
                        >
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen w-full">
            <aside className="sticky top-0 hidden h-screen w-56 shrink-0 lg:block">{rail}</aside>

            {railOpen && (
                <div className="lg:hidden">
                    <div
                        className="fixed inset-0 z-40 bg-black/50"
                        onClick={() => setRailOpen(false)}
                        aria-hidden
                    />
                    <aside className="fixed inset-y-0 left-0 z-50 w-64 shadow-xl">
                        <button
                            type="button"
                            onClick={() => setRailOpen(false)}
                            aria-label="Close navigation"
                            className="absolute right-2 top-4 z-10 rounded-md p-1 text-[#cfd8d5] hover:bg-[#1d3532]"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        {rail}
                    </aside>
                </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/60 lg:px-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Open navigation"
                        className="lg:hidden"
                        onClick={() => setRailOpen(true)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>

                    <div className="flex min-w-0 items-center gap-1.5 truncate text-[13px]">
                        {accountName && (
                            <span className="truncate font-medium text-foreground">
                                {accountName}
                            </span>
                        )}
                        {crumbs.length > 0 && (
                            <nav
                                aria-label="Breadcrumb"
                                className="flex min-w-0 items-center truncate text-muted-foreground"
                            >
                                {accountName && <span className="mr-1.5 opacity-60">/</span>}
                                {crumbs.map((c, i) => (
                                    <span key={`${c}-${i}`} className="truncate">
                                        {i > 0 && <span className="mx-1.5 opacity-60">/</span>}
                                        {c}
                                    </span>
                                ))}
                            </nav>
                        )}
                    </div>

                    <div className="ml-auto flex items-center gap-1">
                        {canSeeDevActions && (
                            <>
                                <HoverTip tip="Audit log">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Audit log"
                                        onClick={() => open("AuditLog")}
                                    >
                                        <Logs className="h-5 w-5" />
                                    </Button>
                                </HoverTip>
                                <HoverTip tip="Docs">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Docs"
                                        onClick={() => open("Docs")}
                                    >
                                        <NotebookText className="h-5 w-5" />
                                    </Button>
                                </HoverTip>
                                <HoverTip tip="Contact us">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Contact us"
                                        onClick={() => setHelpOpen(true)}
                                    >
                                        <Mail className="h-5 w-5" />
                                    </Button>
                                </HoverTip>
                            </>
                        )}
                    </div>
                </header>

                <div
                    className="atrium-flat w-full px-4 py-4 md:px-6 md:py-6"
                    style={{ viewTransitionName: "module-content" }}
                >
                    <ErrorBoundary
                        key={active}
                        fallback={(error, reset) =>
                            isModuleLoadError(error) ? (
                                <AppUpdatedScreen />
                            ) : (
                                <PageErrorScreen onRetry={reset} />
                            )
                        }
                    >
                        <Suspense fallback={<LoadingInline />}>
                            <ActiveCmp />
                        </Suspense>
                    </ErrorBoundary>
                </div>
            </div>

            <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
        </div>
    );
}
