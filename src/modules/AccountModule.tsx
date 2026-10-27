import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp } from "@/shared/fieldHelp";
import { accountUpdatePayload, type AccountFields } from "@/shared/accountUpdate";
import { serviceLevelLabel } from "@/shared/serviceLevel";
import { UpgradeToPaid } from "@/shared/UpgradeToPaid";
import { upgradeOffer } from "@/shared/accountUpgrade";
import { DeleteAccountDialog } from "@/shared/DeleteAccountDialog";
import { reportAccountSuspended } from "@/shared/accountSuspended";
import { errorText } from "@/shared/apiError";
import { Loader2, Trash2 } from "lucide-react";
import { ActionBar } from "@/shared/ActionBar";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";
import { uiText } from "@/shared/uiText";
import { useSession } from "@/shared/useSession";
import { MAX_LENGTHS } from "@/shared/schemaRules";

function formatBillingStart(epochMs: number): string {
    return new Date(epochMs).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

const trimmedFields = (f: AccountFields) =>
    JSON.stringify([
        f.accountName?.trim() ?? "",
        f.billingEmail?.trim() ?? "",
        f.accountContactEmail?.trim() ?? "",
    ]);

export default function AccountModule() {
    const fh = useFieldHelp("AccountModel");
    const [account, setAccount] = useState<AccountFields>({ accountName: "" });
    const [loadedAccount, setLoadedAccount] = useState<AccountFields>({ accountName: "" });
    const [billingName, setBillingName] = useState<string>("");
    const [serviceLevel, setServiceLevel] = useState<string>("");
    const [billingStartAt, setBillingStartAt] = useState<number | null>(null);
    const [paidServiceAvailable, setPaidServiceAvailable] = useState(false);
    const { setServiceLevel: setSessionServiceLevel } = useSession();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await API.getAccount();
            if (resp.success === false) {
                toast.error(resp.error?.message ?? "Failed to load the account.");
                return;
            }
            const fields: AccountFields = {
                accountName: resp.accountName ?? "",
                billingEmail: resp.billingEmail ?? "",
                accountContactEmail: resp.accountContactEmail ?? "",
            };
            setAccount(fields);
            setLoadedAccount(fields);
            setBillingName(resp.billingName ?? "");
            setServiceLevel(resp.serviceLevel ?? "");
            setSessionServiceLevel(resp.serviceLevel ?? null);
            setPaidServiceAvailable(resp.paidServiceAvailable ?? false);
            setBillingStartAt(resp.billingStartAt ?? null);
        } catch (err) {
            toast.error(errorText(err, "Failed to load the account."));
        } finally {
            setLoading(false);
        }
    }, [setSessionServiceLevel]);

    useEffect(() => {
        void load();
    }, [load]);

    const dirty = !loading && trimmedFields(account) !== trimmedFields(loadedAccount);

    const save = async (): Promise<boolean> => {
        try {
            setSaving(true);
            const res = await API.updateAccount(accountUpdatePayload(account, loadedAccount));
            if (res && res.success === false) {
                toast.error(res.error?.message ?? "Failed to update account.");
                return false;
            }
            setLoadedAccount(account);
            toast.success(`Account updated. ${uiText("account.namePropagation")}`);
            return true;
        } catch (err) {
            toast.error(errorText(err, "Failed to update account."));
            return false;
        } finally {
            setSaving(false);
        }
    };

    const offer = upgradeOffer(serviceLevel);

    const deleteAccount = async (haveBackedUpData: boolean) => {
        if (deleting) return;
        setDeleting(true);
        try {
            const res = await API.deleteAccount({ haveBackedUpData });
            if (!res.success) {
                toast.error(res.error?.message ?? "The account could not be deleted.");
                setDeleting(false);
                return;
            }
            setConfirmDelete(false);
            reportAccountSuspended(billingName);
        } catch (err) {
            toast.error(errorText(err, "The account could not be deleted."));
            setDeleting(false);
        }
    };

    const { dialog: unsavedDialog } = useUnsavedChanges({
        isDirty: () => dirty,
        onSave: !loading ? save : undefined,
        what: "page",
    });

    return (
        <Card>
            <CardHeader>
                <ModuleCardTitle title="Account" />
            </CardHeader>

            <CardContent className="space-y-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading account…</span>
                    </div>
                ) : (
                    <>
                        {billingName ? (
                            <div className="grid max-w-xl gap-2">
                                <FieldLabel help={uiText("account.accountIdHelp")}>
                                    Account ID
                                </FieldLabel>
                                <p className="font-mono text-sm">{billingName}</p>
                            </div>
                        ) : null}

                        {serviceLevel ? (
                            <div className="flex max-w-xl flex-wrap items-center justify-between gap-3">
                                <div className="grid gap-2">
                                    <FieldLabel help={fh("serviceLevel")}>Service level</FieldLabel>
                                    <p className="text-sm">{serviceLevelLabel(serviceLevel)}</p>
                                </div>

                                {offer.kind === "startPaid" ? (
                                    <UpgradeToPaid onDone={load} available={paidServiceAvailable} />
                                ) : null}
                            </div>
                        ) : null}

                        {billingStartAt ? (
                            <div className="grid max-w-xl gap-2">
                                <FieldLabel help={fh("billingStartAt")}>Billing start</FieldLabel>
                                <p className="text-sm">{formatBillingStart(billingStartAt)}</p>
                            </div>
                        ) : null}

                        <div className="grid max-w-xl gap-2">
                            <FieldLabel help={fh("accountName")} htmlFor="accountName">
                                Account name
                            </FieldLabel>
                            <Input
                                id="accountName"
                                value={account.accountName ?? ""}
                                onChange={(e) =>
                                    setAccount((a) => ({ ...a, accountName: e.target.value }))
                                }
                                placeholder="Enter account name"
                                maxLength={MAX_LENGTHS.ACCOUNT_NAME.max}
                            />
                        </div>

                        <div className="grid max-w-xl gap-2">
                            <FieldLabel help={fh("billingEmail")} htmlFor="billingEmail">
                                Billing email
                            </FieldLabel>
                            <Input
                                id="billingEmail"
                                type="email"
                                value={account.billingEmail ?? ""}
                                onChange={(e) =>
                                    setAccount((a) => ({ ...a, billingEmail: e.target.value }))
                                }
                                placeholder="Enter billing email"
                            />
                        </div>

                        <div className="grid max-w-xl gap-2">
                            <FieldLabel
                                help={fh("accountContactEmail")}
                                htmlFor="accountContactEmail"
                            >
                                Account contact email
                            </FieldLabel>
                            <Input
                                id="accountContactEmail"
                                type="email"
                                value={account.accountContactEmail ?? ""}
                                onChange={(e) =>
                                    setAccount((a) => ({
                                        ...a,
                                        accountContactEmail: e.target.value,
                                    }))
                                }
                                placeholder="Enter account contact email"
                            />
                        </div>

                        <section className="mt-10 border-t pt-6">
                            <Button
                                type="button"
                                variant="outline"
                                className="gap-2 text-destructive hover:bg-destructive/5 hover:text-destructive"
                                onClick={() => setConfirmDelete(true)}
                            >
                                <Trash2 className="h-4 w-4" aria-hidden />
                                Delete account
                            </Button>
                        </section>

                        <DeleteAccountDialog
                            open={confirmDelete}
                            onOpenChange={setConfirmDelete}
                            accountName={loadedAccount.accountName ?? ""}
                            busy={deleting}
                            onConfirm={(haveBackedUpData) => void deleteAccount(haveBackedUpData)}
                        />
                    </>
                )}
            </CardContent>

            {unsavedDialog}
            <ActionBar
                onUpdate={() => void save()}
                dirty={dirty}
                busy={saving}
                disabled={loading}
            />
        </Card>
    );
}
