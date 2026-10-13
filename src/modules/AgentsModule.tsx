import { useMemo } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import type { AgentItemModel } from "@/orval/search2o.schemas";
import * as UI from "@/shared/uistate";
import { usePagedList, useClientPaging, usePersistentState, PAGE_LIMIT } from "@/shared/pagedList";
import { Pager } from "@/shared/Pager";

import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle2, RefreshCcw } from "lucide-react";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { SortHeaderButton, type SortDir } from "@/shared/SortHeaderButton";
import { ariaSort } from "@/shared/reportFormat";
import { uiText } from "@/shared/uiText";

type SortKey = "agentName" | "agentTitle" | "agentTag" | "developer" | "modified" | "indexed";

function formatEpoch(ms: number | string | undefined): string {
    if (!ms && ms !== 0) return "";
    const n = typeof ms === "string" ? Number(ms) : ms;
    if (!Number.isFinite(n)) return "";
    try {
        return new Date(n).toLocaleString();
    } catch {
        return String(ms);
    }
}

export default function AgentsModule() {
    const {
        items: agents,
        loading,
        error,
        hasMore,
        loadMore,
        reload,
    } = usePagedList<AgentItemModel>("agents", async (cursor) => {
        const resp = await API.getAgentList({ nextCursor: cursor, limit: PAGE_LIMIT });
        return {
            success: resp.success ?? false,
            items: resp.agents ?? [],
            nextCursor: resp.nextCursor ?? null,
            errorMessage: resp.error?.message ?? undefined,
        };
    });

    const [titleFilter, setTitleFilter] = usePersistentState("agents.titleFilter", "");
    const [onlyUnindexed, setOnlyUnindexed] = usePersistentState("agents.onlyUnindexed", false);
    const [sortKey, setSortKey] = usePersistentState<SortKey>("agents.sortKey", "modified");
    const [sortDir, setSortDir] = usePersistentState<SortDir>("agents.sortDir", "desc");

    const unindexedCount = useMemo(() => agents.filter((a) => !a?.isIndexed).length, [agents]);

    const filtered = useMemo(() => {
        let filtered = titleFilter
            ? agents.filter((a) =>
                  (a?.agentTitle ?? "").toLowerCase().includes(titleFilter.toLowerCase()),
              )
            : agents.slice();
        if (onlyUnindexed) filtered = filtered.filter((a) => !a?.isIndexed);

        return filtered.sort((a, b) => {
            const dir = sortDir === "asc" ? 1 : -1;

            if (sortKey === "agentName") {
                const av = (a?.agentName ?? "").toLowerCase();
                const bv = (b?.agentName ?? "").toLowerCase();
                if (av < bv) return -1 * dir;
                if (av > bv) return 1 * dir;
                return 0;
            }

            if (sortKey === "agentTitle") {
                const av = (a?.agentTitle ?? "").toLowerCase();
                const bv = (b?.agentTitle ?? "").toLowerCase();
                if (av < bv) return -1 * dir;
                if (av > bv) return 1 * dir;
                return 0;
            }

            if (sortKey === "agentTag") {
                const av = (a?.agentTag ?? "").toLowerCase();
                const bv = (b?.agentTag ?? "").toLowerCase();
                if (av < bv) return -1 * dir;
                if (av > bv) return 1 * dir;
                return 0;
            }

            if (sortKey === "developer") {
                const av = (a?.lastUpdatedByName ?? "").toLowerCase();
                const bv = (b?.lastUpdatedByName ?? "").toLowerCase();
                if (av < bv) return -1 * dir;
                if (av > bv) return 1 * dir;
                return 0;
            }

            if (sortKey === "modified") {
                const av = Number(a?.agentVersion ?? 0);
                const bv = Number(b?.agentVersion ?? 0);
                return (av - bv) * dir;
            }

            const av = a?.isIndexed ? 1 : 0;
            const bv = b?.isIndexed ? 1 : 0;
            return (av - bv) * dir;
        });
    }, [agents, titleFilter, onlyUnindexed, sortDir, sortKey]);

    const paging = useClientPaging("agents", filtered, { hasMore, loadMore });

    const onRefresh = () => {
        paging.first();
        void reload();
    };

    const toggleSort = (key: SortKey) => {
        setSortKey((prev) => {
            if (prev !== key) {
                setSortDir("asc");
                return key;
            }
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            return key;
        });
    };

    const onOpen = (item: AgentItemModel) => {
        UI.openSubModule("AgentView", { agentName: item.agentName });
    };

    const sortHead = (key: SortKey, label: string, className = "") => (
        <TableHead className={className} aria-sort={ariaSort(sortKey === key, sortDir)}>
            <SortHeaderButton
                label={label}
                active={sortKey === key}
                dir={sortDir}
                onClick={() => toggleSort(key)}
            />
        </TableHead>
    );

    return (
        <Card className="bg-background/60 border-border/60 shadow-sm">
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <ModuleCardTitle title="Published agents" />
                    <HoverTip tip="Refresh — reload from the first page">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={onRefresh}
                            disabled={loading}
                            aria-label="Refresh"
                        >
                            <RefreshCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                        </Button>
                    </HoverTip>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        placeholder={uiText("placeholder.filterByTitle")}
                        value={titleFilter}
                        onChange={(e) => setTitleFilter(e.target.value)}
                        className="w-64"
                    />
                    {unindexedCount > 0 && (
                        <Button
                            type="button"
                            size="sm"
                            variant={onlyUnindexed ? "default" : "outline"}
                            onClick={() => setOnlyUnindexed((v) => !v)}
                        >
                            {unindexedCount} not in the search index
                        </Button>
                    )}
                </div>

                <div className="overflow-x-auto rounded-2xl border border-border/60">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {sortHead("agentName", "Agent", "min-w-[180px]")}
                                {sortHead("agentTitle", "Title", "min-w-[220px]")}
                                {sortHead("agentTag", "Tag", "w-[140px]")}
                                {sortHead("developer", "Developer", "whitespace-nowrap")}
                                {sortHead("modified", "Modified", "whitespace-nowrap")}
                                {sortHead("indexed", "Search index", "whitespace-nowrap")}
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {loading && paging.rows.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="py-10 text-center text-muted-foreground"
                                    >
                                        Loading agents…
                                    </TableCell>
                                </TableRow>
                            )}

                            {!loading && paging.rows.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="py-10 text-center text-muted-foreground"
                                    >
                                        {error ?? uiText("empty.agents")}
                                    </TableCell>
                                </TableRow>
                            )}

                            {paging.rows.map((item) => (
                                <TableRow
                                    key={item.agentName}
                                    className="cursor-pointer hover:bg-muted/40"
                                    onClick={() => onOpen(item)}
                                >
                                    <TableCell className="max-w-0">
                                        <span className="block truncate">{item.agentName}</span>
                                    </TableCell>

                                    <TableCell className="max-w-0">
                                        <span className="block truncate">{item.agentTitle}</span>
                                    </TableCell>

                                    <TableCell className="w-[140px] max-w-[140px]">
                                        <span className="block truncate text-muted-foreground">
                                            {item.agentTag}
                                        </span>
                                    </TableCell>

                                    <TableCell className="whitespace-nowrap">
                                        <HoverTip tip={item.lastUpdatedByEmail || ""}>
                                            <span className="cursor-help">
                                                {item.lastUpdatedByName || "—"}
                                            </span>
                                        </HoverTip>
                                    </TableCell>

                                    <TableCell className="whitespace-nowrap text-muted-foreground">
                                        {formatEpoch(item.agentVersion)}
                                    </TableCell>

                                    <TableCell className="whitespace-nowrap">
                                        {item.isIndexed ? (
                                            <span className="inline-flex items-center gap-1.5 text-emerald-600">
                                                <CheckCircle2 className="h-4 w-4" />
                                                Indexed
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                Not indexed
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <Pager
                    page={paging.page}
                    pageCount={paging.pageCount}
                    total={paging.total}
                    totalLabel="agents"
                    hasMore={paging.hasMore}
                    loading={loading}
                    onFirst={paging.first}
                    onPrev={paging.prev}
                    onNext={() => void paging.next()}
                    onLast={paging.last}
                />
            </CardContent>
        </Card>
    );
}
