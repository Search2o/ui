import { useState } from "react";
import * as API from "@/orval/search2o";
import { Button } from "@/components/ui/button";
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
import { errorText } from "@/shared/apiError";
import { toast } from "sonner";
import { ArrowUpCircle, Loader2 } from "lucide-react";
import { useUiText } from "@/shared/uiText";
import { HoverTip } from "@/shared/HoverTip";

export function UpgradeToPaid({
    onDone,
    available = true,
}: {
    onDone: () => void | Promise<void>;
    available?: boolean;
}) {
    const t = useUiText();
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    const start = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const resp = await API.startPaidService({});
            if (!resp.success) {
                toast.error(resp.error?.message ?? "The account could not be upgraded.");
                return;
            }
            setConfirming(false);
            toast.success(t("upgrade.paid.done"));
            await onDone();
        } catch (e) {
            toast.error(errorText(e, "The account could not be upgraded."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <HoverTip tip={available ? null : t("upgrade.paid.unavailable")} wrap>
                <Button
                    type="button"
                    className="gap-2"
                    disabled={!available}
                    onClick={() => setConfirming(true)}
                >
                    <ArrowUpCircle className="h-4 w-4" aria-hidden />
                    Upgrade to the paid plan
                </Button>
            </HoverTip>

            <AlertDialog open={confirming} onOpenChange={(next) => !busy && setConfirming(next)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("upgrade.paid.confirmTitle")}</AlertDialogTitle>
                        <AlertDialogDescription className="text-left">
                            {t("upgrade.paid.confirmBody")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>Not now</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={busy}
                            onClick={(e) => {
                                e.preventDefault();
                                void start();
                            }}
                        >
                            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Upgrade
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
