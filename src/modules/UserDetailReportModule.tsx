import { useCallback, useEffect, useMemo, useState } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";

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
import { RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { StatTile } from "@/shared/StatTile";
import { useCachedReport } from "@/shared/reportState";
import { ReportRangeControl } from "@/shared/ReportRangeControl";
import { type ReportRange, type RangePreset, rangeFromPayload } from "@/shared/ReportRange";
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
import { ApiError } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

type PayloadType = {
    email: string;
    start?: number;
    end?: number;
    preset?: RangePreset;
};

const trendConfig = {
    success: { label: "Success", theme: CHART_COLOR_PRIMARY },
    failure: { label: "Failure", theme: CHART_COLOR_DANGER },
} satisfies ChartConfig;

const costConfig = {
    llmCost: { label: "LLM cost", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

const agentsConfig = {
    distinctAgents: { label: "Distinct agents", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

const durationConfig = {
    totalDuration: { label: "Total execution time", theme: CHART_COLOR_PRIMARY },
} satisfies ChartConfig;

export default function UserDetailReportModule() {
    const payload = (UI.useModulePayload<PayloadType>() ?? { email: "" }) as PayloadType;

    const viewKey = `report.userDetail.${payload.email}`;
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
            if (!payload.email) return null;
            const resp = await API.getUserDetailReport({
                email: payload.email,
                start: range.start.getTime(),
                end: range.end.getTime(),
            });
            if (!resp.success) {
                throw new ApiError(resp.error?.message || "Failed to load the user detail report.");
            }
            return resp.report ?? null;
        }, [payload.email, range]),
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

    const trendData = useMemo(
        () =>
            (report?.trend ?? []).map((b) => ({
                bucketStart: b.bucketStart,
                success: b.successCount ?? 0,
                failure: b.failureCount ?? 0,
                llmCost: b.llmCost ?? 0,
                distinctAgents: b.distinctAgents ?? 0,
                totalDuration: b.totalDuration ?? 0,
            })),
        [report],
    );

    const agents = report?.agents ?? [];
    const errors = report?.errors ?? [];
    const maxAgentExecutions = agents.reduce((m, a) => Math.max(m, a.executionCount ?? 0), 0);

    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                    <CardTitle>User detail report</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                        <HoverTip tip={payload.email}>
                            <span className="cursor-help">{report?.userName || payload.email}</span>
                        </HoverTip>
                    </CardDescription>
                </div>
                <BackButton fallback="UserUsageReport" />
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

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatTile label="Executions" value={fmtCount(report?.executionCount)} />
                    <StatTile label="Success rate" value={fmtRate(report?.successRate)} />
                    <StatTile label="Agents used" value={fmtCount(report?.distinctAgentsUsed)} />
                    <StatTile label="LLM cost" value={fmtCost(report?.totalLlmCost)} />
                    <StatTile label="Avg duration" value={fmtDuration(report?.averageDuration)} />
                    <StatTile label="Active days" value={fmtCount(report?.activeDays)} />
                </div>

                <div className="text-xs text-muted-foreground">
                    First executed {fmtEpoch(report?.firstExecutedAt)} • Last executed{" "}
                    {fmtEpoch(report?.lastExecutedAt)}
                </div>

                {trendData.length > 0 ? (
                    <TrendSection hourly={hourly} columnsClassName="sm:grid-cols-2 lg:grid-cols-4">
                        <TrendChart
                            fillRange={trendFill}
                            title="Executions"
                            data={trendData}
                            config={trendConfig}
                            series={["success", "failure"]}
                            hourly={hourly}
                        />
                        <TrendChart
                            fillRange={trendFill}
                            title="LLM cost"
                            data={trendData}
                            config={costConfig}
                            series={["llmCost"]}
                            hourly={hourly}
                            valueFormatter={fmtCost}
                        />
                        <TrendChart
                            fillRange={trendFill}
                            title="Distinct agents"
                            data={trendData}
                            config={agentsConfig}
                            series={["distinctAgents"]}
                            hourly={hourly}
                        />
                        <TrendChart
                            fillRange={trendFill}
                            title="Total execution time"
                            data={trendData}
                            config={durationConfig}
                            series={["totalDuration"]}
                            hourly={hourly}
                            valueFormatter={fmtDuration}
                        />
                    </TrendSection>
                ) : (
                    <div className="text-sm text-muted-foreground">
                        {loading ? "Loading…" : (error ?? uiText("report.noExecutions"))}
                    </div>
                )}

                <div>
                    <div className="text-sm font-medium mb-2">Agents used</div>
                    <div className="border rounded-xl">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[24%] text-left">Agent</TableHead>
                                    <TableHead className="w-[11%] text-left">Executions</TableHead>
                                    <TableHead className="w-[11%] text-left">
                                        Success rate
                                    </TableHead>
                                    <TableHead className="w-[9%] text-left">Failures</TableHead>
                                    <TableHead className="w-[11%] text-left">Total cost</TableHead>
                                    <TableHead className="w-[12%] text-left">
                                        Avg duration
                                    </TableHead>
                                    <TableHead className="w-[22%] text-left">
                                        Last executed
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {agents.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={7}
                                            className="text-center py-8 text-sm opacity-70"
                                        >
                                            {loading ? "Loading…" : uiText("report.noAgentsUsed")}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    agents.map((a) => (
                                        <TableRow
                                            key={a.agentName}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() =>
                                                UI.openSubModule("AgentView", {
                                                    agentName: a.agentName,
                                                })
                                            }
                                        >
                                            <TableCell>{a.agentName}</TableCell>
                                            <TableCell className="tabular-nums whitespace-nowrap">
                                                <RankBar
                                                    value={a.executionCount}
                                                    max={maxAgentExecutions}
                                                />
                                                {fmtCount(a.executionCount)}
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {fmtRate(a.successRate)}
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {fmtCount(a.failureCount)}
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {fmtCost(a.totalLlmCost)}
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {fmtDuration(a.averageDuration)}
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
                </div>

                {errors.length > 0 && (
                    <div>
                        <div className="text-sm font-medium mb-2">Errors</div>
                        <div className="border rounded-xl">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40%] text-left">
                                            Result code
                                        </TableHead>
                                        <TableHead className="w-[20%] text-left">Count</TableHead>
                                        <TableHead className="w-[40%] text-left">
                                            Last occurred
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {errors.map((e) => (
                                        <TableRow key={e.resultCode}>
                                            <TableCell className="font-mono text-xs">
                                                {e.resultCode}
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {fmtCount(e.errorCount)}
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {fmtEpoch(e.lastOccurredAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
