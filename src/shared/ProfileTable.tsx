import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { UpdatedBy } from "@/shared/UpdatedBy";

export type ProfileColumn<T> = {
    header: string;
    cell: (item: T) => ReactNode;
    className?: string;
};

export function ProfileTable<T>({
    title,
    help,
    items,
    columns,
    rowKey,
    onRowClick,
    onAdd,
    addLabel,
    emptyMessage,
    error,
    updatedBy,
    maxRows,
    loading,
}: {
    title: string;
    help: string;
    items: T[];
    columns: ProfileColumn<T>[];
    rowKey: (item: T) => string;
    onRowClick: (item: T) => void;
    onAdd: () => void;
    addLabel: string;
    emptyMessage: string;
    error?: string | null;
    updatedBy?: Parameters<typeof UpdatedBy>[0]["obj"];
    maxRows: number;
    loading?: boolean;
}) {
    const atLimit = items.length >= maxRows;

    return (
        <Card className="w-full shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    <ModuleCardTitle title={title} help={help} />
                    <UpdatedBy obj={updatedBy} />
                </div>
                <Button type="button" size="sm" onClick={onAdd} disabled={atLimit}>
                    <Plus className="h-4 w-4" />
                    {addLabel}
                </Button>
            </CardHeader>

            <CardContent className="space-y-3">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((c) => (
                                <TableHead key={c.header}>{c.header}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="py-8 text-center text-sm text-muted-foreground"
                                >
                                    Loading…
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="py-8 text-center text-sm text-destructive"
                                >
                                    {error}
                                </TableCell>
                            </TableRow>
                        ) : items.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="py-8 text-center text-sm text-muted-foreground"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow
                                    key={rowKey(item)}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => onRowClick(item)}
                                >
                                    {columns.map((c) => (
                                        <TableCell key={c.header} className={c.className}>
                                            {c.cell(item)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <div className="text-xs text-muted-foreground">
                    {error ? "" : `${items.length} of ${maxRows} maximum`}
                    {atLimit ? " — delete one before adding another." : ""}
                </div>
            </CardContent>
        </Card>
    );
}
