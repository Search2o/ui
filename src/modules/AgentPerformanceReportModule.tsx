import { useCallback, useEffect, useMemo } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import type { AgentPerformanceRow } from "@/orval/search2o.schemas";

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
import { RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { HoverTip } from "@/shared/HoverTip";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { ReportRangeControl } from "@/shared/ReportRangeControl";
import { useCachedReport, useReportRange, useReportViewState } from "@/shared/reportState";
import { SortHeaderButton, type SortDir } from "@/shared/SortHeaderButton";
import {
    ariaSort,
    fmtCount,
    fmtDuration,
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
import { Pager } from "@/shared/Pager";

type SortKey = keyof Pick<
    AgentPerformanceRow,
    | "executionCount"
    | "uniqueUsers"
    | "successRate"
    | "failureCount"
    | "averageDuration"
    | "p95Duration"
    | "lastExecutedAt"
>;

const PAGE_SIZE = 10;

const VIEW_KEY = "report.agentPerformance";

const trendConfig = {
    success: { label: "Success", theme: CHART_COLOR_PRIMARY },
    failure: { label: "Failure", theme: CHART_COLOR_DANGER },
} satisfies ChartConfig;

const durationConfig = {
    avgDuration: { label: "Avg", theme: CHART_COLOR_PRIMARY },
    p95Duration: { label: "P95", theme: CHART_COLOR_DANGER },
} satisfies ChartConfig;

const agentsConfig = {
    agents: { label: "Distinct agents", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

export default function AgentPerformanceReportModule() {
    const [range, setRange] = useReportRange(VIEW_KEY);
    const [sortKey, setSortKey] = useReportViewState<SortKey>(
        `${VIEW_KEY}.sortKey`,
        "executionCount",
    );
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
            const resp = await API.getAgentPerformanceReport({
                start: range.start.getTime(),
                end: range.end.getTime(),
            });
            if (!resp.success) {
                throw new ApiError(
                    resp.error?.message || "Failed to load the agent performance report.",
                );
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
                success: (b.executionCount ?? 0) - (b.failureCount ?? 0),
                failure: b.failureCount ?? 0,
                avgDuration: b.averageDuration ?? 0,
                p95Duration: b.p95Duration ?? 0,
                agents: b.distinctAgents ?? 0,
            })),
        [report],
    );

    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const maxExecutions = rows.reduce((m, r) => Math.max(m, r.executionCount ?? 0), 0);

    const setSort = (key: SortKey) => {
        setPage(1);
        if (sortKey !== key) {
            setSortKey(key);
            setSortDir("desc");
        } else {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        }
    };

    const openAgentDetail = (agentName: string) => {
        UI.openSubModule("AgentDetailReport", {
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
                <ModuleCardTitle title="Agent performance report" />
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
                    {loading && <span className="text-xs opacity-70">Loading…</span>}
                </div>

                {trendData.length > 0 && (
                    <TrendSection hourly={report?.trendInterval === "hourly"}>
                        <TrendChart
                            fillRange={trendFill}
                            title="Executions"
                            data={trendData}
                            config={trendConfig}
                            series={["success", "failure"]}
                            hourly={report?.trendInterval === "hourly"}
                        />
                        <TrendChart
                            fillRange={trendFill}
                            title="Duration"
                            data={trendData}
                            config={durationConfig}
                            series={["avgDuration", "p95Duration"]}
                            hourly={report?.trendInterval === "hourly"}
                            valueFormatter={fmtDuration}
                        />
                        <TrendChart
                            fillRange={trendFill}
                            title="Distinct agents executed"
                            data={trendData}
                            config={agentsConfig}
                            series={["agents"]}
                            hourly={report?.trendInterval === "hourly"}
                        />
                    </TrendSection>
                )}

                <div className="border rounded-xl">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[22%] text-left">Agent</TableHead>
                                {sortHead("executionCount", "Executions", "w-[11%] text-left")}
                                {sortHead("uniqueUsers", "Users", "w-[9%] text-left")}
                                {sortHead("successRate", "Success rate", "w-[11%] text-left")}
                                {sortHead("failureCount", "Failures", "w-[9%] text-left")}
                                {sortHead("averageDuration", "Avg duration", "w-[11%] text-left")}
                                {sortHead("p95Duration", "P95 duration", "w-[11%] text-left")}
                                {sortHead("lastExecutedAt", "Last executed", "w-[16%] text-left")}
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
                                            : (error ?? uiText("report.noAgentsExecuted"))}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pageRows.map((a) => (
                                    <TableRow
                                        key={a.agentName}
                                        className="cursor-pointer"
                                        onClick={() => openAgentDetail(a.agentName)}
                                    >
                                        <TableCell>{a.agentName}</TableCell>
                                        <TableCell className="tabular-nums whitespace-nowrap">
                                            <RankBar value={a.executionCount} max={maxExecutions} />
                                            {fmtCount(a.executionCount)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCount(a.uniqueUsers)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtRate(a.successRate)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCount(a.failureCount)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtDuration(a.averageDuration)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtDuration(a.p95Duration)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtEpoch(a.lastExecutedAt)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Pager
                    page={page - 1}
                    pageCount={pageCount}
                    total={rows.length}
                    totalLabel="agents"
                    loading={false}
                    onFirst={() => setPage(1)}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
                    onLast={() => setPage(pageCount)}
                />
            </CardContent>
        </Card>
    );
}
