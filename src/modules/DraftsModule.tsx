import { useEffect, useState } from "react";
import * as UI from "@/shared/uistate";
import { preloadModule } from "@/shared/moduleRegistry";
import * as API from "@/orval/search2o";
import { fmtLocalShort } from "@/shared/commonFuncs";
import { usePagedList, useClientPaging } from "@/shared/pagedList";
import { Pager } from "@/shared/Pager";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Trash2, Loader2, SquarePen } from "lucide-react";
import { type DraftItemModel } from "@/orval/search2o.schemas";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

const MAX_BULK_DRAFTS = 25;

export default function DraftsModule() {
    const { items, loading, error, hasMore, loadMore, mutate } = usePagedList<DraftItemModel>(
        "drafts",
        async (cursor) => {
            const resp = await API.getDraftList({ nextCursor: cursor, limit: 25 });
            return {
                success: resp.success ?? false,
                items: resp.drafts ?? [],
                nextCursor: resp.nextCursor ?? null,
                errorMessage: resp.error?.message ?? undefined,
            };
        },
    );

    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmCount, setConfirmCount] = useState(0);
    const [deleting, setDeleting] = useState(false);

    const toggleSelected = (draftid: string, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(draftid);
            else next.delete(draftid);
            return next;
        });
    };

    const paging = useClientPaging("drafts", items, { pageSize: 25, hasMore, loadMore });

    const onCreate = () => UI.openSubModule("DraftEdit", { create: true });

    useEffect(() => {
        preloadModule("DraftEdit");
    }, []);

    const onEdit = (item: DraftItemModel) => {
        UI.openSubModule("DraftEdit", { draftid: item.draftid });
    };

    const togglePage = (checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const d of paging.rows) {
                if (checked) next.add(d.draftid);
                else next.delete(d.draftid);
            }
            return next;
        });
    };

    const onDeleteSelected = async () => {
        const draftids = [...selected];
        if (draftids.length === 0 || draftids.length > MAX_BULK_DRAFTS) return;
        setDeleting(true);
        try {
            const resp = await API.deleteDraft({ draftids });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to delete the selected drafts");
                return;
            }
            mutate((list) => list.filter((d) => !draftids.includes(d.draftid)));
            toast.success(
                draftids.length === 1 ? "Draft deleted" : `${draftids.length} drafts deleted`,
            );
            setSelected(new Set());
            setConfirmDelete(false);
        } catch (e) {
            toast.error(errorText(e, "Failed to delete the selected drafts"));
        } finally {
            setDeleting(false);
        }
    };

    const displayName = (item: DraftItemModel) =>
        item.draftName || (item.isNewDraft ? "" : item.draftid);

    return (
        <Card>
            <CardHeader>
                <ModuleCardTitle title="Draft agents" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="flex justify-end">
                    <Button onClick={onCreate} variant="outline">
                        <SquarePen className="h-4 w-4" />
                        Create new draft
                    </Button>
                </div>

                {selected.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                        <span className="text-sm font-medium">
                            {selected.size} draft{selected.size === 1 ? "" : "s"} selected
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                                setConfirmCount(selected.size);
                                setConfirmDelete(true);
                            }}
                            disabled={deleting || selected.size > MAX_BULK_DRAFTS}
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelected(new Set())}
                            disabled={deleting}
                        >
                            Clear selection
                        </Button>
                        <span
                            className={
                                selected.size > MAX_BULK_DRAFTS
                                    ? "text-xs text-destructive"
                                    : "text-xs text-muted-foreground"
                            }
                        >
                            {selected.size > MAX_BULK_DRAFTS
                                ? `Too many drafts — select at most ${MAX_BULK_DRAFTS} at a time (${selected.size} selected).`
                                : `Up to ${MAX_BULK_DRAFTS} drafts at a time.`}
                        </span>
                    </div>
                )}

                <div className="rounded-2xl border bg-card p-2 shadow-sm">
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <Checkbox
                                        aria-label="Select all drafts on this page"
                                        checked={
                                            paging.rows.length > 0 &&
                                            paging.rows.every((d) => selected.has(d.draftid))
                                        }
                                        onCheckedChange={(checked) => togglePage(checked === true)}
                                    />
                                </TableHead>
                                <TableHead>Agent</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead className="whitespace-nowrap">Tag</TableHead>
                                <TableHead className="whitespace-nowrap">Last updated</TableHead>
                                <TableHead className="whitespace-nowrap">Draft for</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {loading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-10 text-center">
                                        <div className="inline-flex items-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading drafts…
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}

                            {!loading && paging.total === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="py-10 text-center text-muted-foreground"
                                    >
                                        {error ?? uiText("empty.drafts")}
                                    </TableCell>
                                </TableRow>
                            )}

                            {!loading &&
                                paging.rows.map((item) => (
                                    <TableRow
                                        key={item.draftid}
                                        className="cursor-pointer hover:bg-muted/40"
                                        onClick={() => onEdit(item)}
                                    >
                                        <TableCell
                                            className="w-10"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Checkbox
                                                aria-label={`Select ${displayName(item) || "unnamed draft"}`}
                                                checked={selected.has(item.draftid)}
                                                onCheckedChange={(checked) =>
                                                    toggleSelected(item.draftid, checked === true)
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {displayName(item) || (
                                                <span className="italic text-muted-foreground">
                                                    (unnamed)
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="truncate">
                                            {item.agentTitle || ""}
                                        </TableCell>
                                        <TableCell className="truncate text-muted-foreground">
                                            {item.agentTag || ""}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-muted-foreground">
                                            {fmtLocalShort(item.draftUpdatedAt ?? 0)}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {item.isNewDraft ? (
                                                <span className="text-muted-foreground">
                                                    New agent
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    Existing agent
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
                </div>

                <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Delete {confirmCount} draft{confirmCount === 1 ? "" : "s"}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {uiText("delete.draftKeepsAgent")}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault();
                                    void onDeleteSelected();
                                }}
                                variant="destructive"
                            >
                                {deleting ? "Deleting…" : "Delete"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

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
