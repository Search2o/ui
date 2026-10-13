import { useEffect, useRef } from "react";
import { CircleCheck, Search } from "lucide-react";
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
import { uiText } from "@/shared/uiText";

export function PublishedDialog({
    open,
    isIndexed,
    onIndex,
    onLater,
}: {
    open: boolean;
    isIndexed: boolean;
    onIndex: () => void;
    onLater: () => void;
}) {
    const decided = useRef(false);
    useEffect(() => {
        if (open) decided.current = false;
    }, [open]);
    const decide = (outcome: () => void) => {
        if (decided.current) return;
        decided.current = true;
        outcome();
    };

    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) decide(onLater);
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Agent published</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3 text-left">
                            <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
                                <CircleCheck
                                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                                    aria-hidden
                                />
                                <div className="min-w-0">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                                        Done
                                    </div>
                                    <p className="text-sm text-foreground">
                                        {uiText("draft.publishedDone")}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
                                <Search
                                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                                    aria-hidden
                                />
                                <div className="min-w-0">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        Next: search index
                                    </div>
                                    <p className="text-sm text-foreground">
                                        {isIndexed
                                            ? uiText("draft.indexChoiceIndexed")
                                            : uiText("draft.indexChoiceNotIndexed")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => decide(onLater)}>Not now</AlertDialogCancel>
                    <AlertDialogAction onClick={() => decide(onIndex)}>
                        {isIndexed ? "Change description" : "Add to index"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
