import { useCallback, useRef, useState } from "react";
import * as API from "@/orval/search2o";
import { HoverTip } from "@/shared/HoverTip";
import {
    AuditEntryType,
    type GetAuditLogModel,
    type AuditLogModel,
} from "@/orval/search2o.schemas";
import { usePagedList, useClientPaging, usePersistentState } from "@/shared/pagedList";
import { Pager } from "@/shared/Pager";
import { localDatetime } from "@/shared/commonFuncs";
import { describeAuditEntry, labelForType } from "@/shared/auditLogText";
import { ReportRangeControl } from "@/shared/ReportRangeControl";
import { useReportRange } from "@/shared/reportState";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AlertCircle, RefreshCcw, Search as SearchIcon } from "lucide-react";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { uiText } from "@/shared/uiText";

const PAGE_SIZE = 25;

type FilterMode = "all" | "user" | "type";

const TYPE_OPTIONS = Object.values(AuditEntryType);

export default function AuditLogModule() {
    const [range, setRange] = useReportRange("auditLog");

    const [mode, setMode] = usePersistentState<FilterMode>("auditLog.filterMode", "all");
    const [userFilter, setUserFilter] = usePersistentState("auditLog.user", "");
    const [typeFilter, setTypeFilter] = usePersistentState<string>(
        "auditLog.type",
        TYPE_OPTIONS[0],
    );
    const [userDraft, setUserDraft] = useState(userFilter);

    const params = useRef({ range, mode, userFilter, typeFilter });
    params.current = { range, mode, userFilter, typeFilter };

    const { items, loading, error, hasMore, loadMore, reload } = usePagedList<AuditLogModel>(
        "auditLog",
        async (cursor) => {
            const p = params.current;
            const filter: Pick<GetAuditLogModel, "userEmail" | "entryType"> =
                p.mode === "user" && p.userFilter
                    ? { userEmail: p.userFilter }
                    : p.mode === "type" && p.typeFilter
                      ? { entryType: p.typeFilter as AuditEntryType }
                      : {};
            const resp = await API.getAuditLog({
                start: p.range.start.getTime(),
                end: p.range.end.getTime(),
                nextCursor: cursor,
                limit: PAGE_SIZE,
                ...filter,
            });
            return {
                success: resp.success ?? false,
                items: resp.auditLog ?? [],
                nextCursor: resp.nextCursor ?? null,
                errorMessage: resp.error?.message ?? undefined,
            };
        },
    );

    const paging = useClientPaging("auditLog", items, {
        hasMore,
        loadMore,
        pageSize: PAGE_SIZE,
    });

    const rows = error ? [] : paging.rows;

    const { first } = paging;
    const refetch = useCallback(() => {
        first();
        void reload();
    }, [first, reload]);

    const onModeChange = (next: FilterMode) => {
        params.current = { ...params.current, mode: next };
        setMode(next);
        refetch();
    };

    const onApplyUser = () => {
        const email = userDraft.trim();
        params.current = { ...params.current, userFilter: email };
        setUserFilter(email);
        refetch();
    };

    const onTypeChange = (next: string) => {
        params.current = { ...params.current, typeFilter: next };
        setTypeFilter(next);
        refetch();
    };

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <ModuleCardTitle title="Audit log" />
                    <HoverTip tip="Refresh — reload the latest entries">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={refetch}
                            disabled={loading}
                            aria-label="Refresh"
                        >
                            <RefreshCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                        </Button>
                    </HoverTip>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Period</Label>
                        <ReportRangeControl
                            value={range}
                            onChange={(next) => {
                                params.current = { ...params.current, range: next };
                                setRange(next);
                                refetch();
                            }}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Show</Label>
                        <Select value={mode} onValueChange={(v) => onModeChange(v as FilterMode)}>
                            <SelectTrigger className="w-56">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All entries</SelectItem>
                                <SelectItem value="user">Raised by one user</SelectItem>
                                <SelectItem value="type">Of one type</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {mode === "user" && (
                        <form
                            className="space-y-1.5"
                            onSubmit={(e) => {
                                e.preventDefault();
                                onApplyUser();
                            }}
                        >
                            <Label
                                htmlFor="audit-log-user"
                                className="text-xs text-muted-foreground"
                            >
                                User email
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="audit-log-user"
                                    name="auditLogUser"
                                    type="email"
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="w-72"
                                    placeholder="name@example.com"
                                    value={userDraft}
                                    onChange={(e) => setUserDraft(e.target.value)}
                                />
                                <Button type="submit" variant="outline" disabled={loading}>
                                    <SearchIcon className="h-4 w-4" />
                                    Apply
                                </Button>
                            </div>
                        </form>
                    )}

                    {mode === "type" && (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Type</Label>
                            <Select value={typeFilter} onValueChange={onTypeChange}>
                                <SelectTrigger className="w-64">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TYPE_OPTIONS.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {labelForType(t)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {error && (
                    <Alert className="border-destructive/50 bg-destructive/10">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <AlertTitle className="text-destructive line-clamp-none">
                            {error}
                        </AlertTitle>
                    </Alert>
                )}

                <div className="rounded-2xl border border-border/60">
                    {loading && items.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            Loading…
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            {error ? "Nothing to show." : uiText("empty.auditLog")}
                        </div>
                    ) : (
                        <ul className="divide-y divide-border/60">
                            {rows.map((n, idx) => {
                                const text = describeAuditEntry(n);
                                return (
                                    <li
                                        key={`${n.createdAt}:${idx}`}
                                        className="flex items-start justify-between gap-4 px-4 py-3"
                                    >
                                        <div className="min-w-0 space-y-1">
                                            <div className="break-words text-sm">
                                                {text.headline}
                                            </div>
                                            {text.detail ? (
                                                <div className="break-words text-xs text-muted-foreground">
                                                    {text.detail}
                                                </div>
                                            ) : null}
                                            {text.showUser && (n.userName || n.userEmail) && (
                                                <div className="text-xs text-muted-foreground">
                                                    <HoverTip tip={n.userEmail || undefined}>
                                                        <span className="cursor-help">
                                                            {n.userName || n.userEmail}
                                                        </span>
                                                    </HoverTip>
                                                </div>
                                            )}
                                        </div>
                                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                            {localDatetime(n.createdAt)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <Pager
                    page={paging.page}
                    pageCount={paging.pageCount}
                    hasMore={paging.hasMore}
                    loading={loading}
                    onFirst={paging.first}
                    onPrev={paging.prev}
                    onNext={() => void paging.next()}
                    onLast={paging.last}
                    showPageCount={false}
                    showLast={false}
                />
            </CardContent>
        </Card>
    );
}
