import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2 } from "lucide-react";
import { useUiText } from "@/shared/uiText";

export function DeleteAccountDialog({
    open,
    onOpenChange,
    accountName,
    busy,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accountName: string;
    busy: boolean;
    onConfirm: (haveBackedUpData: boolean) => void;
}) {
    const t = useUiText();
    const [typed, setTyped] = useState("");
    const [acknowledged, setAcknowledged] = useState(false);

    useEffect(() => {
        if (open) {
            setTyped("");
            setAcknowledged(false);
        }
    }, [open]);

    const nameMatches = typed.trim() === accountName.trim() && accountName.trim() !== "";
    const confirmed = nameMatches && acknowledged;

    return (
        <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t("account.delete.title")}</AlertDialogTitle>
                    <AlertDialogDescription className="text-left">
                        {t("account.delete.body")}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="flex items-start gap-3">
                    <Checkbox
                        id="delete-account-ack"
                        checked={acknowledged}
                        onCheckedChange={(v) => setAcknowledged(v === true)}
                        disabled={busy}
                        className="mt-0.5"
                    />
                    <Label
                        htmlFor="delete-account-ack"
                        className="text-sm leading-snug font-normal"
                    >
                        {t("account.delete.acknowledge")}
                    </Label>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="confirm-account-name" className="font-normal">
                        {t("account.delete.confirmPrompt")}
                    </Label>
                    <Input
                        id="confirm-account-name"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        placeholder={accountName}
                        autoComplete="off"
                        disabled={busy}
                    />
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>Keep the account</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        disabled={!confirmed || busy}
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm(acknowledged);
                        }}
                    >
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Permanently delete account
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
