import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import { InvoiceStatus, type Invoice } from "@/orval/search2o.schemas";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { periodMonth, periodRange } from "@/shared/billingFormat";
import { indentPadding, rowStyle } from "@/shared/invoiceRow";
import { isBilled } from "@/shared/serviceLevel";
import { localDatetime } from "@/shared/commonFuncs";
import { errorText } from "@/shared/apiError";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { useUiText, uiText } from "@/shared/uiText";

const CURRENT = "current";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
    [InvoiceStatus.draft]: { label: "Draft", className: "border-border text-muted-foreground" },
    [InvoiceStatus.open]: { label: "Open", className: "border-amber-500/40 text-amber-700" },
    [InvoiceStatus.paid]: { label: "Paid", className: "border-emerald-500/40 text-emerald-700" },
    [InvoiceStatus.pastDue]: {
        label: "Past due",
        className: "border-destructive/40 text-destructive",
    },
    [InvoiceStatus.uncollectible]: {
        label: "Uncollectible",
        className: "border-destructive/40 text-destructive",
    },
    [InvoiceStatus.void]: { label: "Void", className: "border-border text-muted-foreground" },
};

function StatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLE[status] ?? {
        label: status,
        className: "border-border text-muted-foreground",
    };
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${style.className}`}
        >
            {style.label}
        </span>
    );
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {label}
            </div>
            <div className="text-sm">{children}</div>
        </div>
    );
}

export default function BillingModule() {
    const t = useUiText();
    const [current, setCurrent] = useState<Invoice | null>(null);
    const [past, setPast] = useState<Invoice | null>(null);
    const [period, setPeriod] = useState<string>(CURRENT);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await API.getCurrentInvoice({});
            if (!resp.success || !resp.invoice) {
                setError(resp.error?.message || "The current invoice could not be loaded.");
                return;
            }
            setCurrent(resp.invoice);
        } catch (e) {
            setError(errorText(e, "The current invoice could not be loaded."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const choosePeriod = async (value: string) => {
        setPeriod(value);
        setError(null);
        if (value === CURRENT) {
            setPast(null);
            return;
        }
        setLoading(true);
        try {
            const resp = await API.getPastInvoice({ periodStart: Number(value) });
            if (!resp.success || !resp.invoice) {
                setPast(null);
                setError(resp.error?.message || "That invoice could not be loaded.");
                return;
            }
            setPast(resp.invoice);
        } catch (e) {
            setPast(null);
            setError(errorText(e, "That invoice could not be loaded."));
        } finally {
            setLoading(false);
        }
    };

    const shown = period === CURRENT ? current : past;
    const pastPeriods = current?.pastPeriods ?? [];
    const isCurrent = period === CURRENT;

    const unbilled = isCurrent && shown?.serviceLevel ? !isBilled(shown.serviceLevel) : false;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <ModuleCardTitle title="Billing" />
                    {current ? (
                        pastPeriods.length > 0 ? (
                            <Select value={period} onValueChange={(v) => void choosePeriod(v)}>
                                <SelectTrigger className="w-[16rem]" aria-label="Billing period">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={CURRENT}>This period</SelectItem>
                                    {[...pastPeriods]
                                        .sort((a, b) => b - a)
                                        .map((start) => (
                                            <SelectItem key={start} value={String(start)}>
                                                {periodMonth(start)}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <span className="text-sm text-muted-foreground">
                                This period · no past invoices yet
                            </span>
                        )
                    ) : null}
                </div>
            </CardHeader>

            <CardContent className="space-y-5">
                {error ? (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="line-clamp-none">{error}</AlertTitle>
                    </Alert>
                ) : null}

                {loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading the invoice…</span>
                    </div>
                ) : null}

                {!loading && shown ? (
                    <div className="overflow-hidden rounded-2xl border bg-surface shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
                            <div className="text-lg font-semibold tracking-tight">Search2o</div>
                            <div className="flex flex-col items-end gap-1.5">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    {isCurrent ? "Current period" : "Invoice"}
                                </div>
                                <div className="text-sm font-medium">{shown.heading}</div>
                                {shown.invoiceId ? (
                                    <div className="font-mono text-xs text-muted-foreground">
                                        {shown.invoiceId}
                                    </div>
                                ) : null}
                                {isCurrent ? (
                                    <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        In progress
                                    </span>
                                ) : shown.status ? (
                                    <StatusBadge status={shown.status} />
                                ) : null}
                            </div>
                        </div>

                        {unbilled ? (
                            <div className="flex items-start gap-3 border-y border-amber-500/30 bg-amber-500/[0.07] px-6 py-4">
                                <Info
                                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500"
                                    aria-hidden
                                />
                                <span className="text-sm font-medium text-foreground">
                                    {t("invoice.informational")}
                                </span>
                            </div>
                        ) : null}

                        <div className="grid gap-5 border-b px-6 py-5 sm:grid-cols-3">
                            {shown.billingName ? (
                                <MetaField label="Billed to">
                                    <span className="font-mono">{shown.billingName}</span>
                                </MetaField>
                            ) : null}
                            <MetaField label="Billing period">
                                {periodRange(shown.periodStart, shown.periodEnd)}
                            </MetaField>
                            {shown.finalizedAt ? (
                                <MetaField label="Issued">
                                    {localDatetime(shown.finalizedAt)}
                                </MetaField>
                            ) : null}
                        </div>

                        <div className="px-6 py-5">
                            {shown.rows.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {uiText("invoice.nothingCharged")}
                                </p>
                            ) : (
                                <dl>
                                    {shown.rows.map((row, idx) => {
                                        const style = rowStyle(row.kind);
                                        return (
                                            <div
                                                key={idx}
                                                className={`flex items-baseline justify-between gap-6 ${style.row}`}
                                            >
                                                <dt
                                                    className={`min-w-0 ${style.label}`}
                                                    style={{
                                                        paddingLeft: indentPadding(row.indent),
                                                    }}
                                                >
                                                    <span className="block">{row.label}</span>
                                                    {row.detail ? (
                                                        <span className="mt-0.5 block text-xs text-muted-foreground">
                                                            {row.detail}
                                                        </span>
                                                    ) : null}
                                                </dt>
                                                <dd
                                                    className={`shrink-0 whitespace-nowrap ${style.amount}`}
                                                >
                                                    {row.amount}
                                                </dd>
                                            </div>
                                        );
                                    })}
                                </dl>
                            )}
                        </div>

                        <div className="border-t px-6 py-3 text-xs text-muted-foreground">
                            All amounts are in {shown.currency}.
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
