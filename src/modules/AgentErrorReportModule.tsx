import { useCallback, useEffect, useMemo } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import type { AgentErrorsRow } from "@/orval/search2o.schemas";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { HoverTip } from "@/shared/HoverTip";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { ReportRangeControl } from "@/shared/ReportRangeControl";
import { useCachedReport, useReportRange, useReportViewState } from "@/shared/reportState";
import { SortHeaderButton, type SortDir } from "@/shared/SortHeaderButton";
import {
    ariaSort,
    fmtCount,
    fmtEpoch,
    fmtRate,
    CHART_COLOR_PRIMARY,
    CHART_COLOR_DANGER,
} from "@/shared/reportFormat";
import { TrendChart, TrendSection } from "@/shared/TrendChart";
import { RankBar } from "@/shared/RankBar";
import type { ChartConfig } from "@/components/ui/chart";
import { ApiError } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

type SortKey = keyof Pick<
    AgentErrorsRow,
    "errorCount" | "executionCount" | "errorRate" | "uniqueUsers" | "distinctMessages"
>;

const PAGE_SIZE = 10;

const volumeConfig = {
    errorCount: { label: "Errors", theme: CHART_COLOR_DANGER },
    executionCount: { label: "Executions", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

const reachConfig = {
    uniqueUsers: { label: "Users affected", theme: CHART_COLOR_DANGER },
    distinctAgents: { label: "Agents affected", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

const VIEW_KEY = "report.agentErrors";

function rankedCounts(counts?: AgentErrorsRow["counts"]): [string, number][] {
    return Object.entries(counts ?? {})
        .map(([code, n]) => [code, Number(n)] as [string, number])
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function describeCounts(counts?: AgentErrorsRow["counts"]): string {
    return rankedCounts(counts)
        .map(([code, n]) => `${code} ×${fmtCount(n)}`)
        .join(" • ");
}

export default function AgentErrorReportModule() {
    const [range, setRange] = useReportRange(VIEW_KEY);
    const [sortKey, setSortKey] = useReportViewState<SortKey>(`${VIEW_KEY}.sortKey`, "errorCount");
    const [sortDir, setSortDir] = useReportViewState<SortDir>(`${VIEW_KEY}.sortDir`, "desc");
    const [page, setPage] = useReportViewState(`${VIEW_KEY}.page`, 1);

    const {
        data: report,
        loading,
        error,
        refresh,
    } = useCachedReport(
        `${VIEW_KEY}|${range.start.getTime()}|${range.end.getTime()}`,
        useCallback(async () => {
            const resp = await API.getAgentErrorReport({
                start: range.start.getTime(),
                end: range.end.getTime(),
            });
            if (!resp.success) {
                throw new ApiError(resp.error?.message || "Failed to load the agent error report.");
            }
            return resp.report ?? null;
        }, [range]),
    );

    useEffect(() => {
        if (error) toast.error(error);
    }, [error]);

    const trendFill = {
        start: range.start.getTime(),
        end: range.end.getTime(),
        bucketMs: report?.bucketMs,
    };

    const rows = useMemo(() => {
        const list = report?.agents ?? [];
        return [...list].sort((a, b) => {
            const A = a[sortKey] ?? 0;
            const B = b[sortKey] ?? 0;
            if (A === B) {
                const t = a.agentName.localeCompare(b.agentName);
                return sortDir === "asc" ? t : -t;
            }
            return sortDir === "asc" ? A - B : B - A;
        });
    }, [report, sortKey, sortDir]);

    const trendData = useMemo(
        () =>
            (report?.trend ?? []).map((b) => ({
                bucketStart: b.bucketStart,
                errorCount: b.errorCount ?? 0,
                executionCount: b.executionCount ?? 0,
                uniqueUsers: b.uniqueUsers ?? 0,
                distinctAgents: b.distinctAgents ?? 0,
            })),
        [report],
    );

    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const maxErrors = rows.reduce((m, r) => Math.max(m, r.errorCount ?? 0), 0);

    const setSort = (key: SortKey) => {
        setPage(1);
        if (sortKey !== key) {
            setSortKey(key);
            setSortDir("desc");
        } else {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        }
    };

    const openAgentErrorDetail = (agentName: string) => {
        UI.openSubModule("AgentErrorDetailReport", {
            agentName,
            start: range.start.getTime(),
            end: range.end.getTime(),
            preset: range.preset,
        });
    };

    const sortHead = (key: SortKey, label: string, className: string) => (
        <TableHead className={className} aria-sort={ariaSort(sortKey === key, sortDir)}>
            <SortHeaderButton
                label={label}
                active={sortKey === key}
                dir={sortDir}
                onClick={() => setSort(key)}
            />
        </TableHead>
    );

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <ModuleCardTitle title="Agent error report" />
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                    <ReportRangeControl value={range} onChange={setRange} />
                    <HoverTip tip="Refresh — ask the server for current data">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Refresh"
                            onClick={refresh}
                            disabled={loading}
                        >
                            <RefreshCcw className="h-4 w-4" />
                        </Button>
                    </HoverTip>

                    {report?.errorCount != null && (
                        <span className="text-xs text-muted-foreground">
                            {fmtCount(report.errorCount)} error
                            {report.errorCount === 1 ? "" : "s"} in this window
                        </span>
                    )}

                    {loading && <span className="text-xs opacity-70">Loading…</span>}
                </div>

                {trendData.length > 0 && (
                    <TrendSection hourly={report?.trendInterval === "hourly"}>
                        <TrendChart
                            fillRange={trendFill}
                            title="Errors and executions"
                            data={trendData}
                            config={volumeConfig}
                            series={["errorCount", "executionCount"]}
                            hourly={report?.trendInterval === "hourly"}
                            valueFormatter={fmtCount}
                        />
                        <TrendChart
                            fillRange={trendFill}
                            title="How far each spike reached"
                            data={trendData}
                            config={reachConfig}
                            series={["uniqueUsers", "distinctAgents"]}
                            hourly={report?.trendInterval === "hourly"}
                            valueFormatter={fmtCount}
                        />
                    </TrendSection>
                )}

                <div className="border rounded-xl">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[17%] text-left">Agent</TableHead>
                                {sortHead("errorCount", "Errors", "w-[11%] text-left")}
                                <TableHead className="w-[20%] text-left">Result code</TableHead>
                                {sortHead("executionCount", "Executions", "w-[10%] text-left")}
                                {sortHead("errorRate", "Error rate", "w-[9%] text-left")}
                                {sortHead("uniqueUsers", "Users", "w-[7%] text-left")}
                                {sortHead("distinctMessages", "Messages", "w-[9%] text-left")}
                                <TableHead className="w-[17%] text-left">Last error</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {pageRows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={8}
                                        className="text-center py-10 text-sm opacity-70"
                                    >
                                        {loading
                                            ? "Loading…"
                                            : (error ?? uiText("report.noAgentFailed"))}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pageRows.map((a) => (
                                    <TableRow
                                        key={a.agentName}
                                        className="cursor-pointer"
                                        onClick={() => openAgentErrorDetail(a.agentName)}
                                    >
                                        <TableCell>{a.agentName}</TableCell>
                                        <TableCell className="tabular-nums whitespace-nowrap">
                                            <HoverTip
                                                tip={`First error ${fmtEpoch(a.firstOccurredAt)}`}
                                            >
                                                <span>
                                                    <RankBar value={a.errorCount} max={maxErrors} />
                                                    {fmtCount(a.errorCount)}
                                                </span>
                                            </HoverTip>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {(() => {
                                                const ranked = rankedCounts(a.counts);
                                                if (ranked.length === 0) return "—";
                                                const [code, n] = ranked[0];
                                                const others = ranked.length - 1;
                                                return (
                                                    <HoverTip tip={describeCounts(a.counts)}>
                                                        <span className="flex items-baseline gap-1.5">
                                                            <span className="truncate font-mono">
                                                                {code} ×{fmtCount(n)}
                                                            </span>
                                                            {others > 0 && (
                                                                <span className="shrink-0 text-muted-foreground">
                                                                    +{others}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </HoverTip>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCount(a.executionCount)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtRate(a.errorRate)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCount(a.uniqueUsers)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCount(a.distinctMessages)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtEpoch(a.lastOccurredAt)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="text-xs opacity-70">
                        Page {page} of {pageCount} • Showing {pageRows.length} of {rows.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                            disabled={page >= pageCount}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
