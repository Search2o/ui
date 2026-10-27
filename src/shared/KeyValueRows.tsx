import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldLabel } from "@/shared/FieldLabel";
import { HoverTip } from "@/shared/HoverTip";
import { WrappingInput } from "@/shared/WrappingInput";
import { makeKeyValueRow, type KeyValueRow } from "@/shared/keyValueMap";

export function KeyValueRows({
    idPrefix,
    label,
    help,
    rows,
    onChange,
    addLabel,
    emptyText,
    keyHeading,
    valueHeading,
    keyPlaceholder,
    valuePlaceholder,
    valueTip,
    valueClassName,
    overrideLabel,
    overrideHelp,
    footer,
    disabled,
}: {
    idPrefix: string;
    label: string;
    help?: string;
    rows: KeyValueRow[];
    onChange: (rows: KeyValueRow[]) => void;
    addLabel: string;
    emptyText: string;
    keyHeading: string;
    valueHeading: string;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
    valueTip?: string;
    valueClassName?: string;
    overrideLabel?: string;
    overrideHelp?: string;
    footer?: ReactNode;
    disabled?: boolean;
}) {
    const patch = (id: string, changes: Partial<KeyValueRow>) =>
        onChange(rows.map((row) => (row.id === id ? { ...row, ...changes } : row)));

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <FieldLabel help={help} className="whitespace-nowrap">
                    {label}
                </FieldLabel>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-2"
                    onClick={() => onChange([...rows, makeKeyValueRow()])}
                    disabled={disabled}
                >
                    <Plus className="h-4 w-4" /> {addLabel}
                </Button>
            </div>

            {rows.length === 0 ? (
                <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {emptyText}
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="hidden items-center gap-2 px-1 text-xs font-medium text-muted-foreground md:flex">
                        <span className="w-1/3">{keyHeading}</span>
                        <span className="flex-1">{valueHeading}</span>
                        {overrideLabel ? (
                            <HoverTip tip={overrideHelp}>
                                <span className="w-36 cursor-help">{overrideLabel}</span>
                            </HoverTip>
                        ) : null}
                        <span className="w-9 shrink-0" aria-hidden />
                    </div>

                    {rows.map((row) => (
                        <div
                            key={row.id}
                            className="flex flex-col items-start gap-2 rounded-lg border p-2 md:flex-row md:items-center md:rounded-none md:border-0 md:p-0"
                        >
                            <Input
                                className="w-full md:w-1/3"
                                placeholder={keyPlaceholder}
                                aria-label={`${keyHeading} of entry ${row.key.trim() || "(new)"}`}
                                value={row.key}
                                onChange={(e) => patch(row.id, { key: e.target.value })}
                                disabled={disabled}
                            />
                            <HoverTip tip={valueTip}>
                                <WrappingInput
                                    className={`w-full flex-1 ${valueClassName ?? ""}`}
                                    placeholder={valuePlaceholder}
                                    aria-label={`${valueHeading} of entry ${row.key.trim() || "(new)"}`}
                                    value={row.value}
                                    onValueChange={(value) => patch(row.id, { value })}
                                    disabled={disabled}
                                />
                            </HoverTip>
                            {overrideLabel ? (
                                <Label
                                    htmlFor={`${idPrefix}-override-${row.id}`}
                                    className="flex w-full shrink-0 items-center gap-2 text-sm font-normal text-muted-foreground md:w-36"
                                >
                                    <Checkbox
                                        id={`${idPrefix}-override-${row.id}`}
                                        checked={row.override}
                                        aria-label={`${overrideLabel}: ${row.key.trim() || "(new entry)"}`}
                                        onCheckedChange={(checked) =>
                                            patch(row.id, { override: checked === true })
                                        }
                                        disabled={disabled}
                                    />
                                    <span className="md:hidden">{overrideLabel}</span>
                                </Label>
                            ) : null}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 self-end md:self-auto"
                                onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                                aria-label={`Remove ${row.key.trim() || label.toLowerCase()}`}
                                disabled={disabled}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {footer}
        </div>
    );
}
