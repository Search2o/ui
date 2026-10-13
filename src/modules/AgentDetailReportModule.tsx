import { Fragment, useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";
import type { AgentVersionDetailRow } from "@/orval/search2o.schemas";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ReportRangeControl } from "@/shared/ReportRangeControl";
import { type ReportRange, type RangePreset, rangeFromPayload } from "@/shared/ReportRange";
import { useCachedReport } from "@/shared/reportState";
import {
    fmtCost,
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

type PayloadType = {
    agentName: string;
    start?: number;
    end?: number;
    preset?: RangePreset;
};

const trendConfig = {
    executions: { label: "Executions", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

const durationConfig = {
    avgDuration: { label: "Avg", theme: CHART_COLOR_PRIMARY },
    p95Duration: { label: "P95", theme: CHART_COLOR_DANGER },
} satisfies ChartConfig;

const usersConfig = {
    users: { label: "Unique users", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

const fmtVersion = (version: number) =>
    new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(version));

export default function AgentDetailReportModule() {
    const payload = (UI.useModulePayload<PayloadType>() ?? { agentName: "" }) as PayloadType;

    const viewKey = `report.agentDetail.${payload.agentName}`;
    const [range, setRangeState] = useState<ReportRange>(() => rangeFromPayload(payload));

    const setRange = useCallback((next: ReportRange) => {
        setRangeState(next);
        UI.updatePayload({
            start: next.start.getTime(),
            end: next.end.getTime(),
            preset: next.preset,
        });
    }, []);

    const {
        data: report,
        loading,
        error,
        refresh,
    } = useCachedReport(
        `${viewKey}|${range.start.getTime()}|${range.end.getTime()}`,
        useCallback(async () => {
            if (!payload.agentName) return null;
            const resp = await API.getAgentDetailReport({
                agentName: payload.agentName,
                start: range.start.getTime(),
                end: range.end.getTime(),
            });
            if (!resp.success) {
                throw new ApiError(
                    resp.error?.message || "Failed to load the agent detail report.",
                );
            }
            return resp.report ?? null;
        }, [payload.agentName, range]),
    );

    useEffect(() => {
        if (error) toast.error(error);
    }, [error]);

    const trendFill = {
        start: range.start.getTime(),
        end: range.end.getTime(),
        bucketMs: report?.bucketMs,
    };

    const trendData = (report?.trend ?? []).map((b) => ({
        bucketStart: b.bucketStart,
        executions: b.executionCount ?? 0,
        avgDuration: b.averageDuration ?? 0,
        p95Duration: b.p95Duration ?? 0,
        users: b.uniqueUsers ?? 0,
    }));

    const versions = [...(report?.versions ?? [])].sort((a, b) => b.agentVersion - a.agentVersion);
    const maxExecutions = versions.reduce((m, v) => Math.max(m, v.executionCount ?? 0), 0);

    const renderVersionRow = (v: AgentVersionDetailRow) => {
        return (
            <Fragment key={v.agentVersion}>
                <TableRow>
                    <TableCell>
                        <div className="font-mono text-xs tabular-nums">
                            {fmtVersion(v.agentVersion)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            ran {fmtEpoch(v.firstExecutedAt)} – {fmtEpoch(v.lastExecutedAt)}
                        </div>
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">
                        <RankBar value={v.executionCount} max={maxExecutions} />
                        {fmtCount(v.executionCount)}
                    </TableCell>
                    <TableCell className="tabular-nums">{fmtCount(v.uniqueUsers)}</TableCell>
                    <TableCell className="tabular-nums">{fmtRate(v.successRate)}</TableCell>
                    <TableCell className="tabular-nums">{fmtCount(v.failureCount)}</TableCell>
                    <TableCell className="tabular-nums">{fmtDuration(v.averageDuration)}</TableCell>
                    <TableCell className="tabular-nums">{fmtDuration(v.p95Duration)}</TableCell>
                    <TableCell className="tabular-nums">{fmtCost(v.totalLlmCost)}</TableCell>
                    <TableCell className="tabular-nums">{fmtCost(v.averageLlmCost)}</TableCell>
                </TableRow>
            </Fragment>
        );
    };

    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                    <CardTitle>Agent detail report</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                        {payload.agentName}
                    </CardDescription>
                </div>
                <BackButton fallback="AgentPerformanceReport" />
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
                    <TrendSection
                        hourly={report?.trendInterval === "hourly"}
                        title="Trends, all versions"
                    >
                        <TrendChart
                            fillRange={trendFill}
                            title="Executions"
                            data={trendData}
                            config={trendConfig}
                            series={["executions"]}
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
                            title="Unique users"
                            data={trendData}
                            config={usersConfig}
                            series={["users"]}
                            hourly={report?.trendInterval === "hourly"}
                        />
                    </TrendSection>
                )}

                <div className="border rounded-xl">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[20%] text-left">Version</TableHead>
                                <TableHead className="w-[10%] text-left">Executions</TableHead>
                                <TableHead className="w-[8%] text-left">Users</TableHead>
                                <TableHead className="w-[10%] text-left">Success rate</TableHead>
                                <TableHead className="w-[8%] text-left">Failures</TableHead>
                                <TableHead className="w-[11%] text-left">Avg duration</TableHead>
                                <TableHead className="w-[11%] text-left">P95 duration</TableHead>
                                <TableHead className="w-[11%] text-left">Total cost</TableHead>
                                <TableHead className="w-[11%] text-left">Avg cost</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {versions.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={9}
                                        className="text-center py-10 text-sm opacity-70"
                                    >
                                        {loading
                                            ? "Loading…"
                                            : (error ?? uiText("report.agentNotExecuted"))}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                versions.map(renderVersionRow)
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="text-xs text-muted-foreground">
                    {uiText("report.failuresElsewhere")}
                </div>
            </CardContent>
        </Card>
    );
}
