import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { BarChart3, Trash2 } from "lucide-react";
import type { UserModel, UserRole } from "@/orval/search2o.schemas";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { HoverTip } from "@/shared/HoverTip";
import { resetPagedList } from "@/shared/pagedList";
import { fmtLocalShort } from "@/shared/commonFuncs";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

export type UserPayloadType = {
    email: string;
};

const ROLE_LABELS: Record<UserRole, string> = {
    user: "User",
    developer: "Developer",
    admin: "Administrator",
    owner: "Account Owner",
};

const ASSIGNABLE_ROLES: UserRole[] = ["user", "developer", "admin", "owner"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <div className="text-sm">{children}</div>
        </div>
    );
}

export default function UserViewModule() {
    const payload = UI.useModulePayload<UserPayloadType>();
    const email = payload?.email;

    const [loading, setLoading] = useState(!!email);
    const [user, setUser] = useState<UserModel | null>(null);
    const [role, setRole] = useState<UserRole>("user");
    const [savingRole, setSavingRole] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const load = useCallback(async () => {
        if (!email) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const resp = await API.getUser({ email });
            if (!resp.success || !resp.user) {
                toast.error(resp.error?.message ?? `No user found for ${email}.`);
                UI.goBack("Users");
                return;
            }
            setUser(resp.user);
            setRole(resp.user.role ?? "user");
        } catch (e) {
            toast.error(errorText(e, "Failed to load the user."));
            UI.goBack("Users");
        } finally {
            setLoading(false);
        }
    }, [email]);

    useEffect(() => {
        void load();
    }, [load]);

    const roleDirty = !!user && role !== (user.role ?? "user");

    const onSaveRole = async () => {
        if (!user || !roleDirty) return;
        setSavingRole(true);
        try {
            const resp = await API.updateRole({ emails: [user.email], role });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to update the role");
                return;
            }
            setUser({ ...user, role });
            resetPagedList("users");
            toast.success("Role updated");
        } catch (e) {
            toast.error(errorText(e, "Failed to update the role"));
        } finally {
            setSavingRole(false);
        }
    };

    const onDelete = async () => {
        if (!user) return;
        try {
            const resp = await API.deleteUsers({ emails: [user.email] });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to delete the user");
                return;
            }
            resetPagedList("users");
            toast.success(`${user.email} deleted`);
            UI.goBack("Users");
        } catch (e) {
            toast.error(errorText(e, "Failed to delete the user"));
        }
    };

    if (!email) {
        return (
            <Card className="w-full shadow-sm">
                <CardHeader>
                    <ModuleCardTitle title="User" help="user-view" />
                    <div className="text-sm text-muted-foreground">No user selected.</div>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="w-full shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    {loading ? (
                        <>
                            <Skeleton className="h-7 w-56 rounded-xl" />
                            <Skeleton className="h-4 w-72 rounded-xl" />
                        </>
                    ) : user ? (
                        <>
                            <ModuleCardTitle title={user.userName || user.email} help="user-view" />
                            <div className="truncate text-xs text-muted-foreground">
                                {user.email}
                            </div>
                        </>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
                    {user ? (
                        <HoverTip tip="This user's executions, cost and agents used">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    UI.openSubModule("UserDetailReport", {
                                        email,
                                    })
                                }
                            >
                                <BarChart3 className="h-4 w-4" />
                                Usage
                            </Button>
                        </HoverTip>
                    ) : null}
                    <BackButton fallback="Users" label="Back to users" />
                </div>
            </CardHeader>

            {user ? (
                <>
                    <CardContent className="space-y-6">
                        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
                            <Field label="Name">{user.userName || "—"}</Field>
                            <Field label="Email">{user.email}</Field>
                            <Field label="Last sign-in">
                                {user.lastLoginAt ? (
                                    fmtLocalShort(user.lastLoginAt)
                                ) : (
                                    <span className="text-muted-foreground">Never</span>
                                )}
                            </Field>
                        </div>

                        <Separator />

                        <div className="max-w-3xl space-y-2">
                            <HoverTip tip={uiText("help.userRole")}>
                                <div className="text-sm font-medium">Role</div>
                            </HoverTip>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <Select
                                    value={role}
                                    onValueChange={(v) => setRole(v as UserRole)}
                                    disabled={savingRole}
                                >
                                    <SelectTrigger className="w-56">
                                        <SelectValue>{ROLE_LABELS[role]}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ASSIGNABLE_ROLES.map((r) => (
                                            <SelectItem key={r} value={r}>
                                                {ROLE_LABELS[r]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={!roleDirty || savingRole}
                                    onClick={() => void onSaveRole()}
                                >
                                    {savingRole ? "Saving…" : "Save role"}
                                </Button>
                            </div>
                        </div>
                    </CardContent>

                    <Separator />

                    <div className="flex items-center justify-between gap-3 p-4">
                        <span className="text-xs text-muted-foreground">
                            {uiText("delete.userCannotBeUndone")}
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelete(true)}
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </Button>
                    </div>
                </>
            ) : null}

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {user?.email} will be deleted. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => void onDelete()}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
