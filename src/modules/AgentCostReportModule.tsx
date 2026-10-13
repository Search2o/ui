import { useCallback, useEffect, useMemo } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import type { AgentCostRow } from "@/orval/search2o.schemas";

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
    fmtCost,
    fmtCount,
    fmtEpoch,
    CHART_COLOR_PRIMARY,
    CHART_COLOR_DANGER,
} from "@/shared/reportFormat";
import { TrendChart, TrendSection } from "@/shared/TrendChart";
import { RankBar } from "@/shared/RankBar";
import type { ChartConfig } from "@/components/ui/chart";
import { ApiError } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

type SortKey = keyof Pick<
    AgentCostRow,
    | "executionCount"
    | "uniqueUsers"
    | "totalLlmCost"
    | "averageLlmCost"
    | "maximumLlmCost"
    | "lastExecutedAt"
>;

const PAGE_SIZE = 10;

const trendConfig = {
    cost: { label: "LLM cost", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

const perExecConfig = {
    avgCost: { label: "Avg", theme: CHART_COLOR_PRIMARY },
    p95Cost: { label: "P95", theme: CHART_COLOR_DANGER },
} satisfies ChartConfig;

const VIEW_KEY = "report.agentCost";

export default function AgentCostReportModule() {
    const [range, setRange] = useReportRange(VIEW_KEY);
    const [sortKey, setSortKey] = useReportViewState<SortKey>(
        `${VIEW_KEY}.sortKey`,
        "totalLlmCost",
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
            const resp = await API.getAgentCostReport({
                start: range.start.getTime(),
                end: range.end.getTime(),
            });
            if (!resp.success) {
                throw new ApiError(resp.error?.message || "Failed to load the agent cost report.");
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
                cost: b.totalLlmCost ?? 0,
                avgCost: b.averageLlmCost ?? 0,
                p95Cost: b.p95LlmCost ?? 0,
            })),
        [report],
    );

    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const maxCost = rows.reduce((m, r) => Math.max(m, r.totalLlmCost ?? 0), 0);

    const setSort = (key: SortKey) => {
        setPage(1);
        if (sortKey !== key) {
            setSortKey(key);
            setSortDir("desc");
        } else {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        }
    };

    const openAgentCostDetail = (agentName: string) => {
        UI.openSubModule("AgentCostDetailReport", {
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
                <ModuleCardTitle title="Agent cost report" />
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
                            title="LLM cost"
                            data={trendData}
                            config={trendConfig}
                            series={["cost"]}
                            hourly={report?.trendInterval === "hourly"}
                            valueFormatter={fmtCost}
                        />
                        <TrendChart
                            fillRange={trendFill}
                            title="Cost per execution"
                            data={trendData}
                            config={perExecConfig}
                            series={["avgCost", "p95Cost"]}
                            hourly={report?.trendInterval === "hourly"}
                            valueFormatter={fmtCost}
                        />
                    </TrendSection>
                )}

                <div className="border rounded-xl">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[24%] text-left">Agent</TableHead>
                                {sortHead("executionCount", "Executions", "w-[11%] text-left")}
                                {sortHead("uniqueUsers", "Users", "w-[9%] text-left")}
                                {sortHead("totalLlmCost", "Total cost", "w-[12%] text-left")}
                                {sortHead("averageLlmCost", "Avg cost", "w-[12%] text-left")}
                                {sortHead("maximumLlmCost", "Max cost", "w-[12%] text-left")}
                                {sortHead("lastExecutedAt", "Last executed", "w-[20%] text-left")}
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {pageRows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
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
                                        onClick={() => openAgentCostDetail(a.agentName)}
                                    >
                                        <TableCell>{a.agentName}</TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCount(a.executionCount)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCount(a.uniqueUsers)}
                                        </TableCell>
                                        <TableCell className="tabular-nums whitespace-nowrap">
                                            <RankBar value={a.totalLlmCost} max={maxCost} />
                                            {fmtCost(a.totalLlmCost)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCost(a.averageLlmCost)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCost(a.maximumLlmCost)}
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
