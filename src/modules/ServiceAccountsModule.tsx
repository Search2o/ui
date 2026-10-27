import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import type { CreateServiceAccountModel, ServiceAccountItemModel } from "@/orval/search2o.schemas";
import { UserRole } from "@/orval/search2o.schemas";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
import { Check, Copy, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FieldLabel } from "@/shared/FieldLabel";
import { HoverTip } from "@/shared/HoverTip";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import { SERVICE_ACCOUNT_NAME, matchesRule } from "@/shared/schemaRules";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

const ROLES: UserRole[] = [UserRole.user, UserRole.developer, UserRole.admin];

const ROLE_LABELS: Record<string, string> = {
    user: "User",
    developer: "Developer",
    admin: "Administrator",
};

type ShownKey = {
    email: string;
    userName: string;
    token: string;
    tokenType: string;
    rotated: boolean;
};

type Pending = { kind: "rotate" | "delete"; account: ServiceAccountItemModel };

export default function ServiceAccountsModule() {
    const [accounts, setAccounts] = useState<ServiceAccountItemModel[]>([]);
    const [loading, setLoading] = useState(true);

    const [name, setName] = useState("");
    const [role, setRole] = useState<UserRole>(UserRole.user);
    const [email, setEmail] = useState("");
    const [creating, setCreating] = useState(false);

    const [shown, setShown] = useState<ShownKey | null>(null);
    const [copied, setCopied] = useState(false);
    const [pending, setPending] = useState<Pending | null>(null);
    const [busyEmail, setBusyEmail] = useState<string | null>(null);

    const fh = useFieldHelp("CreateServiceAccountModel", "ServiceAccountItemModel");
    const ft = useFieldTitle("CreateServiceAccountModel", "ServiceAccountItemModel");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await API.getServiceAccounts({});
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to load the service accounts.");
                return;
            }
            setAccounts(resp.serviceAccounts ?? []);
        } catch (e) {
            toast.error(errorText(e, "Failed to load the service accounts."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const show = (key: ShownKey) => {
        setShown(key);
        setCopied(false);
    };

    const trimmedName = name.trim();
    const nameValid = matchesRule(SERVICE_ACCOUNT_NAME, trimmedName);

    const create = async () => {
        if (!nameValid || creating) return;
        setCreating(true);
        try {
            const body: CreateServiceAccountModel = {
                name: trimmedName,
                role,
                ...(email.trim() ? { email: email.trim() } : {}),
            };
            const resp = await API.createServiceAccount(body);
            if (!resp.success) {
                toast.error(resp.error?.message ?? "The service account could not be created.");
                return;
            }
            setName("");
            setEmail("");
            setRole(UserRole.user);
            if (resp.token) {
                show({
                    email: resp.email || body.email || `${body.name}@service`,
                    userName: resp.userName || body.name,
                    token: resp.token,
                    tokenType: resp.tokenType || "Bearer",
                    rotated: false,
                });
            } else {
                toast.error(uiText("serviceAccounts.noKeyReturned"));
            }
            await load();
        } catch (e) {
            toast.error(errorText(e, "The service account could not be created."));
        } finally {
            setCreating(false);
        }
    };

    const rotate = async (account: ServiceAccountItemModel) => {
        setBusyEmail(account.email);
        try {
            const resp = await API.rotateServiceAccountKey({ email: account.email });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "The key could not be rotated.");
                return;
            }
            if (!resp.token) {
                toast.error(uiText("serviceAccounts.noKeyReturned"));
                return;
            }
            show({
                email: account.email,
                userName: account.userName,
                token: resp.token,
                tokenType: resp.tokenType || "Bearer",
                rotated: true,
            });
        } catch (e) {
            toast.error(errorText(e, "The key could not be rotated."));
        } finally {
            setBusyEmail(null);
        }
    };

    const remove = async (account: ServiceAccountItemModel) => {
        setBusyEmail(account.email);
        try {
            const resp = await API.deleteServiceAccount({ email: account.email });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "The service account could not be deleted.");
                return;
            }
            setShown((current) => (current?.email === account.email ? null : current));
            await load();
        } catch (e) {
            toast.error(errorText(e, "The service account could not be deleted."));
        } finally {
            setBusyEmail(null);
        }
    };

    const changeRole = async (account: ServiceAccountItemModel, next: UserRole) => {
        if (next === account.role) return;
        setBusyEmail(account.email);
        try {
            const resp = await API.setServiceAccountRole({ email: account.email, role: next });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "The role could not be changed.");
                return;
            }
            setAccounts((list) =>
                list.map((a) => (a.email === account.email ? { ...a, role: next } : a)),
            );
        } catch (e) {
            toast.error(errorText(e, "The role could not be changed."));
        } finally {
            setBusyEmail(null);
        }
    };

    const copy = async () => {
        if (!shown) return;
        try {
            await navigator.clipboard.writeText(shown.token);
            setCopied(true);
        } catch {
            toast.error(uiText("serviceAccounts.copyBlocked"));
        }
    };

    const confirm = () => {
        if (!pending) return;
        const { kind, account } = pending;
        setPending(null);
        void (kind === "rotate" ? rotate(account) : remove(account));
    };

    return (
        <Card>
            <CardHeader>
                <ModuleCardTitle title="Service accounts" />
            </CardHeader>
            <CardContent className="space-y-6">
                <form
                    className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)_auto]"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void create();
                    }}
                >
                    <div className="space-y-1.5">
                        <FieldLabel htmlFor="service-account-name" help={fh("name")}>
                            {ft("name")}
                        </FieldLabel>
                        <Input
                            id="service-account-name"
                            value={name}
                            maxLength={SERVICE_ACCOUNT_NAME.maxLength}
                            placeholder="ci-pipeline"
                            aria-invalid={(!!trimmedName && !nameValid) || undefined}
                            onChange={(e) => setName(e.target.value)}
                            disabled={creating}
                        />
                        {trimmedName && !nameValid ? (
                            <p className="text-xs text-destructive">
                                {uiText("validate.serviceAccountName")}
                            </p>
                        ) : null}
                    </div>
                    <div className="space-y-1.5">
                        <FieldLabel htmlFor="service-account-role" help={fh("role")}>
                            Role
                        </FieldLabel>
                        <Select
                            value={role}
                            onValueChange={(v) => setRole(v as UserRole)}
                            disabled={creating}
                        >
                            <SelectTrigger id="service-account-role" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ROLES.map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {ROLE_LABELS[r]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <FieldLabel htmlFor="service-account-email" help={fh("email")}>
                            {ft("email")} (optional)
                        </FieldLabel>
                        <Input
                            id="service-account-email"
                            type="email"
                            value={email}
                            placeholder={`${trimmedName || "name"}@service`}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={creating}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <div className="hidden h-3.5 lg:block" aria-hidden />
                        <Button type="submit" className="gap-2" disabled={!nameValid || creating}>
                            {creating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            {creating ? "Creating…" : "Create"}
                        </Button>
                    </div>
                </form>

                {shown ? (
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                    {shown.rotated ? "New key" : "Key"} for {shown.userName}
                                </div>
                                <div className="mt-1 break-all font-mono text-sm">
                                    {shown.token}
                                </div>
                            </div>
                            <HoverTip
                                tip={`${uiText("serviceAccounts.keyUsage")} Authorization: ${shown.tokenType} <key>`}
                            >
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => void copy()}
                                >
                                    {copied ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                    {copied ? "Copied" : "Copy key"}
                                </Button>
                            </HoverTip>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            {uiText("serviceAccounts.keyOnce")}
                        </p>
                    </div>
                ) : null}

                {loading ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading service accounts…
                    </p>
                ) : accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {uiText("empty.serviceAccounts")}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="w-44">Role</TableHead>
                                    <TableHead className="w-0" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {accounts.map((account) => {
                                    const busy = busyEmail === account.email;
                                    return (
                                        <TableRow key={account.email}>
                                            <TableCell className="font-medium">
                                                {account.userName}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {account.email}
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={account.role}
                                                    onValueChange={(v) =>
                                                        void changeRole(account, v as UserRole)
                                                    }
                                                    disabled={busy}
                                                >
                                                    <SelectTrigger
                                                        aria-label={`Role of ${account.userName}`}
                                                        className="h-8"
                                                    >
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ROLES.map((r) => (
                                                            <SelectItem key={r} value={r}>
                                                                {ROLE_LABELS[r]}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-2"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            setPending({ kind: "rotate", account })
                                                        }
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                        Rotate key
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-2 text-destructive hover:text-destructive"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            setPending({ kind: "delete", account })
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pending?.kind === "rotate"
                                ? `Rotate the key for ${pending.account.userName}?`
                                : `Delete ${pending?.account.userName}?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pending?.kind === "rotate"
                                ? uiText("serviceAccounts.rotateBody")
                                : uiText("serviceAccounts.deleteBody")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {pending?.kind === "rotate" ? "Keep the current key" : "Keep it"}
                        </AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={confirm}>
                            {pending?.kind === "rotate" ? "Rotate key" : "Delete service account"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
