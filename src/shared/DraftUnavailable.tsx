import { useState } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import * as API from "@/orval/search2o";
import { BackButton } from "@/shared/BackButton";
import { errorText } from "@/shared/apiError";
import { resetPagedList } from "@/shared/pagedList";
import * as UI from "@/shared/uistate";
import { uiText } from "@/shared/uiText";

export function DraftUnavailable({ draftid, reason }: { draftid?: string; reason: string }) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    const discard = async () => {
        if (!draftid) return;
        setBusy(true);
        try {
            const resp = await API.deleteDraft({ draftids: [draftid] });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to discard the draft");
                return;
            }
            resetPagedList("drafts");
            toast.success("Draft discarded");
            setConfirming(false);
            UI.openModule("Drafts");
        } catch (e) {
            toast.error(errorText(e, "Failed to discard the draft"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
            <p className="max-w-md text-sm text-muted-foreground">{reason}</p>
            <div className="flex items-center gap-2">
                <BackButton fallback="Drafts" />
                {draftid ? (
                    <Button variant="outline" onClick={() => setConfirming(true)}>
                        Discard draft
                    </Button>
                ) : null}
            </div>
            <AlertDialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {uiText("delete.cannotBeUndone")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={busy}
                            onClick={(e) => {
                                e.preventDefault();
                                void discard();
                            }}
                        >
                            {busy ? "Discarding…" : "Discard"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
