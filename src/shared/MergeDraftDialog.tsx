import { useState } from "react";
import * as API from "@/orval/search2o";
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
import { Loader2 } from "lucide-react";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

export function MergeDraftDialog({
    open,
    onOpenChange,
    draftid,
    agentName,
    onMerged,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    draftid: string;
    agentName: string;
    onMerged: (definition: string) => void;
}) {
    const [merging, setMerging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const change = (next: boolean) => {
        if (merging) return;
        if (!next) setError(null);
        onOpenChange(next);
    };

    const merge = async () => {
        setMerging(true);
        setError(null);
        try {
            const resp = await API.mergeDraft({ draftid });
            if (!resp.success) {
                setError(resp.error?.message || "The draft could not be merged.");
                return;
            }
            const merged = resp.agentDefinition ?? "";
            if (!merged.trim()) {
                setError(uiText("draft.mergeEmpty"));
                return;
            }
            onMerged(merged);
            onOpenChange(false);
        } catch (e) {
            setError(errorText(e, "The draft could not be merged."));
        } finally {
            setMerging(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={change}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {agentName} was changed by another developer
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {uiText("draft.changedByAnother")}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error ? (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                ) : null}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={merging}
                        onClick={(e) => {
                            e.preventDefault();
                            void merge();
                        }}
                    >
                        {merging ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                Merging…
                            </>
                        ) : (
                            "Merge"
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
