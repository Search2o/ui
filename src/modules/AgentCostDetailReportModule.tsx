import { Fragment, useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";
import type { AgentCostVersionRow, CostTrendBucket } from "@/orval/search2o.schemas";

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
import type { ChartConfig } from "@/components/ui/chart";
import { ChevronDown, ChevronRight, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { StatTile } from "@/shared/StatTile";
import { HoverTip } from "@/shared/HoverTip";
import { useCachedReport, useReportViewState } from "@/shared/reportState";
import { ReportRangeControl } from "@/shared/ReportRangeControl";
import { type ReportRange, type RangePreset, rangeFromPayload } from "@/shared/ReportRange";
import { TrendChart, TrendSection } from "@/shared/TrendChart";
import { RankBar } from "@/shared/RankBar";
import {
    fmtCost,
    fmtCount,
    fmtEpoch,
    CHART_COLOR_PRIMARY,
    CHART_COLOR_DANGER,
} from "@/shared/reportFormat";
import { ApiError } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

type PayloadType = {
    agentName: string;
    start?: number;
    end?: number;
    preset?: RangePreset;
};

const trendConfig = {
    cost: { label: "LLM cost", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

const perExecConfig = {
    avgCost: { label: "Avg", theme: CHART_COLOR_PRIMARY },
    p95Cost: { label: "P95", theme: CHART_COLOR_DANGER },
} satisfies ChartConfig;

const fmtVersion = (version: number) =>
    new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(version));

const costTrendData = (trend?: CostTrendBucket[]) =>
    (trend ?? []).map((b) => ({
        bucketStart: b.bucketStart,
        cost: b.llmCost ?? 0,
        avgCost: b.averageLlmCost ?? 0,
        p95Cost: b.p95LlmCost ?? 0,
    }));

export default function AgentCostDetailReportModule() {
    const payload = (UI.useModulePayload<PayloadType>() ?? { agentName: "" }) as PayloadType;

    const viewKey = `report.agentCostDetail.${payload.agentName}`;
    const [range, setRangeState] = useState<ReportRange>(() => rangeFromPayload(payload));

    const setRange = useCallback((next: ReportRange) => {
        setRangeState(next);
        UI.updatePayload({
            start: next.start.getTime(),
            end: next.end.getTime(),
            preset: next.preset,
        });
    }, []);
    const [openVersions, setOpenVersions] = useReportViewState<Record<number, boolean>>(
        `${viewKey}.openVersions`,
        {},
    );

    const {
        data: report,
        loading,
        error,
        refresh,
    } = useCachedReport(
        `${viewKey}|${range.start.getTime()}|${range.end.getTime()}`,
        useCallback(async () => {
            if (!payload.agentName) return null;
            const resp = await API.getAgentCostDetailReport({
                agentName: payload.agentName,
                start: range.start.getTime(),
                end: range.end.getTime(),
            });
            if (!resp.success) {
                throw new ApiError(
                    resp.error?.message || "Failed to load the agent cost detail report.",
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

    const hourly = report?.trendInterval === "hourly";
    const trendData = costTrendData(report?.trend);

    const versions = [...(report?.versions ?? [])].sort((a, b) => b.agentVersion - a.agentVersion);
    const maxVersionCost = versions.reduce((m, v) => Math.max(m, v.totalLlmCost ?? 0), 0);

    const toggleVersion = (v: number) => setOpenVersions((prev) => ({ ...prev, [v]: !prev[v] }));

    const renderVersionRow = (v: AgentCostVersionRow) => {
        const open = !!openVersions[v.agentVersion];
        const versionTrend = costTrendData(v.trend);
        return (
            <Fragment key={v.agentVersion}>
                <TableRow className="cursor-pointer" onClick={() => toggleVersion(v.agentVersion)}>
                    <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                            {open ? (
                                <ChevronDown className="h-4 w-4 opacity-60" />
                            ) : (
                                <ChevronRight className="h-4 w-4 opacity-60" />
                            )}
                            <span className="font-mono text-xs tabular-nums">
                                {fmtVersion(v.agentVersion)}
                            </span>
                        </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{fmtCount(v.executionCount)}</TableCell>
                    <TableCell className="tabular-nums">{fmtCount(v.uniqueUsers)}</TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">
                        <RankBar value={v.totalLlmCost} max={maxVersionCost} />
                        {fmtCost(v.totalLlmCost)}
                    </TableCell>
                    <TableCell className="tabular-nums">{fmtCost(v.averageLlmCost)}</TableCell>
                    <TableCell className="tabular-nums">{fmtCost(v.maximumLlmCost)}</TableCell>
                    <TableCell className="tabular-nums">{fmtEpoch(v.lastExecutedAt)}</TableCell>
                </TableRow>
                {open && (
                    <TableRow>
                        <TableCell colSpan={7} className="bg-muted/20">
                            <div className="text-xs text-muted-foreground pt-2 pb-3">
                                First executed {fmtEpoch(v.firstExecutedAt)} • Last executed{" "}
                                {fmtEpoch(v.lastExecutedAt)}
                            </div>
                            {versionTrend.length === 0 ? (
                                <div className="pb-3 text-sm text-muted-foreground">
                                    {uiText("report.noVersionCost")}
                                </div>
                            ) : (
                                <div className="grid gap-x-6 gap-y-4 pb-3 sm:grid-cols-2">
                                    <TrendChart
                                        fillRange={trendFill}
                                        title="LLM cost"
                                        data={versionTrend}
                                        config={trendConfig}
                                        series={["cost"]}
                                        hourly={hourly}
                                        valueFormatter={fmtCost}
                                    />
                                    <TrendChart
                                        fillRange={trendFill}
                                        title="Cost per execution"
                                        data={versionTrend}
                                        config={perExecConfig}
                                        series={["avgCost", "p95Cost"]}
                                        hourly={hourly}
                                        valueFormatter={fmtCost}
                                    />
                                </div>
                            )}
                        </TableCell>
                    </TableRow>
                )}
            </Fragment>
        );
    };

    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                    <CardTitle>Agent cost detail report</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                        {payload.agentName}
                    </CardDescription>
                </div>
                <BackButton fallback="AgentCostReport" label="Back to the agent cost report" />
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

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatTile label="Executions" value={fmtCount(report?.executionCount)} />
                    <StatTile label="Users" value={fmtCount(report?.uniqueUsers)} />
                    <StatTile label="Total LLM cost" value={fmtCost(report?.totalLlmCost)} />
                    <StatTile label="Avg cost" value={fmtCost(report?.averageLlmCost)} />
                    <StatTile label="Max cost" value={fmtCost(report?.maximumLlmCost)} />
                </div>

                <div className="text-xs text-muted-foreground">
                    First executed {fmtEpoch(report?.firstExecutedAt)} • Last executed{" "}
                    {fmtEpoch(report?.lastExecutedAt)}
                </div>

                {trendData.length > 0 ? (
                    <TrendSection hourly={hourly}>
                        <TrendChart
                            fillRange={trendFill}
                            title="LLM cost"
                            data={trendData}
                            config={trendConfig}
                            series={["cost"]}
                            hourly={hourly}
                            valueFormatter={fmtCost}
                        />
                        <TrendChart
                            fillRange={trendFill}
                            title="Cost per execution"
                            data={trendData}
                            config={perExecConfig}
                            series={["avgCost", "p95Cost"]}
                            hourly={hourly}
                            valueFormatter={fmtCost}
                        />
                    </TrendSection>
                ) : (
                    <div className="text-sm text-muted-foreground">
                        {loading ? "Loading…" : (error ?? uiText("report.noCost"))}
                    </div>
                )}

                <div className="border rounded-xl">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[22%] text-left">Version</TableHead>
                                <TableHead className="w-[11%] text-left">Executions</TableHead>
                                <TableHead className="w-[9%] text-left">Users</TableHead>
                                <TableHead className="w-[12%] text-left">Total cost</TableHead>
                                <TableHead className="w-[12%] text-left">Avg cost</TableHead>
                                <TableHead className="w-[12%] text-left">Max cost</TableHead>
                                <TableHead className="w-[22%] text-left">Last executed</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {versions.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
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
                    {uiText("report.clickVersionCost")}
                </div>
            </CardContent>
        </Card>
    );
}
