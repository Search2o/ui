import { RowKind } from "@/orval/search2o.schemas";

export type RowStyle = {
    row: string;
    label: string;
    amount: string;
};

const PLAIN: RowStyle = {
    row: "py-1.5",
    label: "text-sm",
    amount: "text-sm tabular-nums",
};

const STYLES: Record<string, RowStyle> = {
    [RowKind.heading]: {
        row: "pt-5 pb-1 first:pt-0",
        label: "text-xs font-medium uppercase tracking-wider text-muted-foreground",
        amount: "text-sm tabular-nums",
    },
    [RowKind.item]: PLAIN,
    [RowKind.subtotal]: {
        row: "mt-1 border-t pt-2.5",
        label: "text-sm font-medium",
        amount: "text-sm font-medium tabular-nums",
    },
    [RowKind.total]: {
        row: "mt-1 border-t pt-3",
        label: "text-sm font-medium",
        amount: "text-base font-semibold tabular-nums",
    },
    [RowKind.credit]: {
        row: "py-1.5",
        label: "text-sm",
        amount: "text-sm tabular-nums text-emerald-700 dark:text-emerald-400",
    },
    [RowKind.note]: {
        row: "py-1.5",
        label: "text-sm text-muted-foreground",
        amount: "text-sm tabular-nums text-muted-foreground",
    },
};

export function rowStyle(kind: string): RowStyle {
    return STYLES[kind] ?? PLAIN;
}

export function indentPadding(indent: number | undefined): string {
    const depth = Number.isFinite(indent) && (indent ?? 0) > 0 ? (indent as number) : 0;
    return `${depth * 1.25}rem`;
}
