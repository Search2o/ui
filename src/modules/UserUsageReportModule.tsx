import { useCallback, useEffect } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import type { UserUsageSortField } from "@/orval/search2o.schemas";

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
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import type { ReportRange } from "@/shared/ReportRange";
import { useCachedReport, useReportRange, useReportViewState } from "@/shared/reportState";
import { ReportRangeControl } from "@/shared/ReportRangeControl";
import { SortHeaderButton } from "@/shared/SortHeaderButton";
import {
    ariaSort,
    fmtCost,
    fmtCount,
    fmtDuration,
    fmtEpoch,
    fmtRate,
    CHART_COLOR_PRIMARY,
} from "@/shared/reportFormat";
import { TrendChart, TrendSection } from "@/shared/TrendChart";
import { RankBar } from "@/shared/RankBar";
import type { ChartConfig } from "@/components/ui/chart";
import { ApiError } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

const PAGE_SIZE = 10;

const trendConfig = {
    users: { label: "Active users", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

const durationConfig = {
    totalDuration: { label: "Total execution time", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

const VIEW_KEY = "report.userUsage";

export default function UserUsageReportModule() {
    const [range, setRange] = useReportRange(VIEW_KEY);
    const [page, setPage] = useReportViewState(`${VIEW_KEY}.page`, 1);
    const [sortBy, setSortBy] = useReportViewState<UserUsageSortField>(
        `${VIEW_KEY}.sortBy`,
        "executionCount",
    );
    const [sortDescending, setSortDescending] = useReportViewState(`${VIEW_KEY}.sortDesc`, true);

    const {
        data: report,
        loading,
        error,
        refresh,
    } = useCachedReport(
        `${VIEW_KEY}|${range.start.getTime()}|${range.end.getTime()}|${page}|${sortBy}|${sortDescending}`,
        useCallback(async () => {
            const resp = await API.getUserUsageReport({
                start: range.start.getTime(),
                end: range.end.getTime(),
                page,
                pageSize: PAGE_SIZE,
                sortBy,
                sortDescending,
            });
            if (!resp.success) {
                throw new ApiError(resp.error?.message || "Failed to load the user usage report.");
            }
            return resp.report ?? null;
        }, [range, page, sortBy, sortDescending]),
    );

    useEffect(() => {
        if (error) toast.error(error);
    }, [error]);

    const trendFill = {
        start: range.start.getTime(),
        end: range.end.getTime(),
        bucketMs: report?.bucketMs,
    };

    const onRangeChange = (r: ReportRange) => {
        setPage(1);
        setRange(r);
    };

    const setSort = (key: UserUsageSortField) => {
        setPage(1);
        if (sortBy !== key) {
            setSortBy(key);
            setSortDescending(true);
        } else {
            setSortDescending((d) => !d);
        }
    };

    const openUserDetail = (email: string) => {
        UI.openSubModule("UserDetailReport", {
            email,
            start: range.start.getTime(),
            end: range.end.getTime(),
            preset: range.preset,
        });
    };

    const sortDir = sortDescending ? "desc" : "asc";
    const sortHead = (key: UserUsageSortField, label: string, className: string) => (
        <TableHead className={className} aria-sort={ariaSort(sortBy === key, sortDir)}>
            <SortHeaderButton
                label={label}
                active={sortBy === key}
                dir={sortDir}
                onClick={() => setSort(key)}
            />
        </TableHead>
    );

    const rows = report?.users ?? [];
    const pageCount = Math.max(1, report?.totalPages ?? 1);

    const trendData = (report?.trend ?? []).map((b) => ({
        bucketStart: b.bucketStart,
        users: b.userCount ?? 0,
        totalDuration: b.totalDuration ?? 0,
    }));
    const maxExecutions = rows.reduce((m, u) => Math.max(m, u.executionCount ?? 0), 0);

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <ModuleCardTitle title="User usage report" />
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                    <ReportRangeControl value={range} onChange={onRangeChange} />
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
                    <div className="space-y-1">
                        <TrendSection hourly={report?.trendInterval === "hourly"}>
                            <TrendChart
                                fillRange={trendFill}
                                title="Active users"
                                data={trendData}
                                config={trendConfig}
                                series={["users"]}
                                hourly={report?.trendInterval === "hourly"}
                            />
                            <TrendChart
                                fillRange={trendFill}
                                title="Total execution time"
                                data={trendData}
                                config={durationConfig}
                                series={["totalDuration"]}
                                hourly={report?.trendInterval === "hourly"}
                                valueFormatter={fmtDuration}
                            />
                        </TrendSection>
                        <div className="text-xs text-muted-foreground">
                            {uiText("report.coversAllUsers")}
                        </div>
                    </div>
                )}

                <div className="border rounded-xl">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[26%] text-left">User</TableHead>
                                {sortHead("executionCount", "Executions", "w-[11%] text-left")}
                                {sortHead("distinctAgentsUsed", "Agents used", "w-[11%] text-left")}
                                {sortHead("successRate", "Success rate", "w-[11%] text-left")}
                                {sortHead("failureCount", "Failures", "w-[9%] text-left")}
                                {sortHead("totalLlmCost", "Total cost", "w-[11%] text-left")}
                                {sortHead("lastExecutedAt", "Last executed", "w-[21%] text-left")}
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="text-center py-10 text-sm opacity-70"
                                    >
                                        {loading
                                            ? "Loading…"
                                            : (error ?? uiText("report.noUserActivity"))}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((u) => (
                                    <TableRow
                                        key={u.userEmail}
                                        className="cursor-pointer"
                                        onClick={() => openUserDetail(u.userEmail)}
                                    >
                                        <TableCell>
                                            <HoverTip tip={u.userEmail}>
                                                <span className="font-medium cursor-help">
                                                    {u.userName || u.userEmail}
                                                </span>
                                            </HoverTip>
                                        </TableCell>
                                        <TableCell className="tabular-nums whitespace-nowrap">
                                            <RankBar value={u.executionCount} max={maxExecutions} />
                                            {fmtCount(u.executionCount)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCount(u.distinctAgentsUsed)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtRate(u.successRate)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCount(u.failureCount)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtCost(u.totalLlmCost)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {fmtEpoch(u.lastExecutedAt)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="text-xs opacity-70">
                        Page {report?.page ?? page} of {pageCount} •{" "}
                        {fmtCount(report?.totalRows ?? 0)} users
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={loading || page <= 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                            disabled={loading || page >= pageCount}
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
