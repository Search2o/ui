import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";

export function Pager({
    page,
    pageCount,
    total,
    totalLabel,
    hasMore = false,
    loading,
    showPageCount = true,
    showLast = true,
    onFirst,
    onPrev,
    onNext,
    onLast,
}: {
    page: number;
    pageCount: number;
    total?: number;
    totalLabel?: string;
    hasMore?: boolean;
    loading?: boolean;
    showPageCount?: boolean;
    showLast?: boolean;
    onFirst: () => void;
    onPrev: () => void;
    onNext: () => void;
    onLast: () => void;
}) {
    const plural = totalLabel ?? "total";
    const noun = total === 1 && plural.endsWith("s") ? plural.slice(0, -1) : plural;

    const atFirst = page <= 0;
    const atLast = page >= pageCount - 1;

    if (pageCount <= 1 && !hasMore && !loading) {
        return total != null ? (
            <div className="text-xs text-muted-foreground">
                {total} {noun}
            </div>
        ) : null;
    }

    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span>
                    Page {page + 1}
                    {showPageCount ? ` of ${pageCount}` : ""}
                    {total != null ? ` · ${total} ${noun}` : ""}
                </span>
            </div>
            <div className="flex items-center gap-1">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onFirst}
                    disabled={atFirst || loading}
                    aria-label="First page"
                >
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onPrev}
                    disabled={atFirst || loading}
                    aria-label="Previous page"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onNext}
                    disabled={(atLast && !hasMore) || loading}
                    aria-label="Next page"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
                {showLast ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={onLast}
                        disabled={atLast || loading}
                        aria-label="Last page"
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
