import { Fragment, useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";
import type { AgentErrorVersionRow, VersionErrorGroup } from "@/orval/search2o.schemas";

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
import { ChevronDown, ChevronRight, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { StatTile } from "@/shared/StatTile";
import { HoverTip } from "@/shared/HoverTip";
import { useCachedReport, useReportViewState } from "@/shared/reportState";
import { ReportRangeControl } from "@/shared/ReportRangeControl";
import { type ReportRange, type RangePreset, rangeFromPayload } from "@/shared/ReportRange";
import { RankBar } from "@/shared/RankBar";
import { fmtCount, fmtEpoch } from "@/shared/reportFormat";
import { ApiError } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

type PayloadType = {
    agentName: string;
    start?: number;
    end?: number;
    preset?: RangePreset;
};

const fmtVersion = (version: number) =>
    new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(version));

function ErrorGroups({
    errors,
    onOpenPath,
}: {
    errors: VersionErrorGroup[];
    onOpenPath: (path: string) => void;
}) {
    if (errors.length === 0) {
        return (
            <div className="py-3 text-sm text-muted-foreground">
                {uiText("report.noVersionErrors")}
            </div>
        );
    }
    return (
        <div className="space-y-3 py-3">
            {errors.map((g) => (
                <div key={g.resultCode} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="font-mono font-medium">{g.resultCode}</span>
                        <span className="text-muted-foreground">
                            {fmtCount(g.errorCount)} error{(g.errorCount ?? 0) === 1 ? "" : "s"}
                        </span>
                        <span className="text-muted-foreground">
                            {fmtCount(g.uniqueUsers)} users
                        </span>
                        <span className="text-muted-foreground">
                            {fmtEpoch(g.firstOccurredAt)} – {fmtEpoch(g.lastOccurredAt)}
                        </span>
                    </div>

                    {(g.messages ?? []).length > 0 && (
                        <div className="space-y-1.5">
                            {(g.messages ?? []).map((m) => (
                                <div
                                    key={`${m.path ?? ""}|${m.errorMessage}`}
                                    className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs"
                                >
                                    <div className="font-mono whitespace-pre-wrap break-words">
                                        {m.errorMessage}
                                    </div>
                                    {m.path ? (
                                        <div className="mt-1 font-mono text-[11px] text-muted-foreground/80">
                                            at{" "}
                                            <HoverTip
                                                tip={`${m.path} — open this command in the agent`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenPath(m.path!)}
                                                    className="rounded underline-offset-2 transition-colors hover:text-foreground hover:underline"
                                                >
                                                    {m.path}
                                                </button>
                                            </HoverTip>
                                        </div>
                                    ) : null}
                                    <HoverTip tip={uiText("report.queriesPrivate")}>
                                        <div className="mt-1 w-fit cursor-help text-muted-foreground">
                                            ×{fmtCount(m.occurrenceCount)} •{" "}
                                            {fmtCount(m.uniqueUsers)} users • first{" "}
                                            {fmtEpoch(m.firstOccurredAt)} • last{" "}
                                            {fmtEpoch(m.lastOccurredAt)}
                                        </div>
                                    </HoverTip>
                                </div>
                            ))}
                            {(g.distinctMessages ?? 0) > (g.messages ?? []).length && (
                                <div className="text-xs text-muted-foreground">
                                    Showing {(g.messages ?? []).length} of {g.distinctMessages}{" "}
                                    distinct messages.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default function AgentErrorDetailReportModule() {
    const payload = (UI.useModulePayload<PayloadType>() ?? { agentName: "" }) as PayloadType;

    const viewKey = `report.agentErrorDetail.${payload.agentName}`;
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
            const resp = await API.getAgentErrorDetailReport({
                agentName: payload.agentName,
                start: range.start.getTime(),
                end: range.end.getTime(),
            });
            if (!resp.success) {
                throw new ApiError(
                    resp.error?.message || "Failed to load the agent error detail report.",
                );
            }
            return resp.report ?? null;
        }, [payload.agentName, range]),
    );

    useEffect(() => {
        if (error) toast.error(error);
    }, [error]);

    const versions = [...(report?.versions ?? [])].sort((a, b) => b.agentVersion - a.agentVersion);
    const maxVersionErrors = versions.reduce((m, v) => Math.max(m, v.errorCount ?? 0), 0);

    const toggleVersion = (v: number) => setOpenVersions((prev) => ({ ...prev, [v]: !prev[v] }));

    const openPath = (path: string) =>
        UI.openSubModule("AgentView", { agentName: payload.agentName, highlightPath: path });

    const renderVersionRow = (v: AgentErrorVersionRow) => {
        const open = !!openVersions[v.agentVersion];
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
                    <TableCell className="tabular-nums whitespace-nowrap">
                        <RankBar value={v.errorCount} max={maxVersionErrors} />
                        {fmtCount(v.errorCount)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                        {fmtCount((v.errors ?? []).length)}
                    </TableCell>
                </TableRow>
                {open && (
                    <TableRow>
                        <TableCell colSpan={3} className="bg-muted/20">
                            <ErrorGroups errors={v.errors ?? []} onOpenPath={openPath} />
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
                    <CardTitle>Agent error detail report</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                        {payload.agentName}
                    </CardDescription>
                </div>
                <BackButton fallback="AgentErrorReport" label="Back to the agent error report" />
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

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <StatTile label="Errors" value={fmtCount(report?.errorCount)} />
                    <StatTile label="Versions affected" value={fmtCount(versions.length)} />
                </div>

                <div className="border rounded-xl">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[46%] text-left">Version</TableHead>
                                <TableHead className="w-[27%] text-left">Errors</TableHead>
                                <TableHead className="w-[27%] text-left">Result codes</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {versions.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={3}
                                        className="text-center py-10 text-sm opacity-70"
                                    >
                                        {loading
                                            ? "Loading…"
                                            : (error ?? uiText("report.agentNoFailures"))}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                versions.map(renderVersionRow)
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="text-xs text-muted-foreground">
                    Click a version to see every failure it produced, grouped by result code and
                    then by message.
                </div>
            </CardContent>
        </Card>
    );
}
