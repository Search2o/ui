import { useCallback, useRef, useState } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import type {
    GetUsersResponseModel,
    UserItemModel,
    UserRole,
    UserRoleFacet,
} from "@/orval/search2o.schemas";
import { usePagedList, useClientPaging, usePersistentState } from "@/shared/pagedList";
import { Pager } from "@/shared/Pager";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogCancel,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { X, Users, UserMinus, UserCog, RefreshCcw, Search, AlertCircle } from "lucide-react";
import { useSession } from "@/shared/useSession";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

type Role = UserRole;
type VisibleRole = "Account Owner" | "Administrator" | "Developer" | "User";

const ROLE_LABELS: Record<Role, VisibleRole> = {
    user: "User",
    developer: "Developer",
    admin: "Administrator",
    owner: "Account Owner",
};

const ROLE_ORDER: Role[] = ["user", "developer", "admin", "owner"];
const VISIBLE_ROLES_FOR_ADMIN: Role[] = ["user", "developer", "admin"];
const VISIBLE_ROLES_FOR_OWNER: Role[] = ROLE_ORDER;

const USERS_PAGE_SIZE = 25;

const MAX_BULK_EMAILS = 25;

function getRoleLabel(role: unknown): VisibleRole | string {
    if (typeof role !== "string") return "";
    return ROLE_LABELS[role as Role] ?? role;
}

function parseEmails(text: string): string[] {
    return text
        .split(/[\s,]+/g)
        .map((s) => s.trim())
        .filter(Boolean);
}

function BulkEmailLimitNote({ count }: { count: number }) {
    const over = count > MAX_BULK_EMAILS;
    return (
        <div className={over ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {over
                ? `Too many emails — enter at most ${MAX_BULK_EMAILS} at a time (${count} entered).`
                : `Up to ${MAX_BULK_EMAILS} emails at a time.`}
        </div>
    );
}

export default function UsersModule() {
    const { user: currentUser } = useSession();

    const [facet, setFacet] = usePersistentState<UserRoleFacet>("users.roleFacet", "all");
    const facetRef = useRef(facet);
    facetRef.current = facet;

    const [userCounts, setUserCounts] = useState<GetUsersResponseModel["userCounts"] | null>(null);

    const list = usePagedList<UserItemModel>("users", async (cursor) => {
        const resp = await API.getUsers({
            nextCursor: cursor,
            limit: USERS_PAGE_SIZE,
            roleFacet: facetRef.current,
        });
        if (resp.userCounts) setUserCounts(resp.userCounts);
        return {
            success: resp.success ?? false,
            items: resp.users ?? [],
            nextCursor: resp.nextCursor ?? null,
            errorMessage: resp.error?.message ?? undefined,
        };
    });

    const paging = useClientPaging("users", list.items, {
        hasMore: list.hasMore,
        loadMore: list.loadMore,
        pageSize: USERS_PAGE_SIZE,
    });

    const [addOpen, setAddOpen] = useState(false);
    const [addText, setAddText] = useState("");
    const [addRole, setAddRole] = useState<Role>("user");
    const [sendInvite, setSendInvite] = useState(true);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [roleOpen, setRoleOpen] = useState(false);
    const [roleValue, setRoleValue] = useState<Role>("user");

    const [busy, setBusy] = useState(false);

    const [lookupText, setLookupText] = useState("");
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [lookingUp, setLookingUp] = useState(false);

    const allowedAddRoles: Role[] =
        currentUser?.role === "owner" ? VISIBLE_ROLES_FOR_OWNER : VISIBLE_ROLES_FOR_ADMIN;

    const { reload } = list;
    const { first } = paging;

    const reloadAll = useCallback(async () => {
        setLookupError(null);
        setSelected(new Set());
        first();
        await reload();
    }, [reload, first]);

    const onFacetChange = (v: UserRoleFacet) => {
        facetRef.current = v;
        setFacet(v);
        setSelected(new Set());
        first();
        void reload();
    };

    const openDetail = useCallback((u: Pick<UserItemModel, "email">) => {
        UI.openSubModule("UserView", { email: u.email });
    }, []);

    const onLookup = useCallback(async () => {
        const email = lookupText.trim();
        if (!email) return;
        setLookupError(null);

        try {
            setLookingUp(true);
            const resp = await API.getUser({ email });
            if (!resp.success || !resp.user) {
                setLookupError(resp.error?.message ?? `No user found for ${email}.`);
                return;
            }
            openDetail(resp.user);
        } catch (e) {
            setLookupError(errorText(e, "Failed to look up that user."));
        } finally {
            setLookingUp(false);
        }
    }, [lookupText, openDetail]);

    const toggleSelected = (email: string, on: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (on) next.add(email);
            else next.delete(email);
            return next;
        });
    };

    const onAddUsers = async () => {
        const emails = parseEmails(addText);
        if (emails.length === 0 || emails.length > MAX_BULK_EMAILS) return;
        try {
            setBusy(true);
            const resp = await API.addUsers({ emails, role: addRole, sendEmail: sendInvite });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to add users", {
                    description: "No users were added.",
                });
                return;
            }
            setAddOpen(false);
            setAddText("");
            setAddRole("user");
            await reloadAll();
            toast.success(emails.length === 1 ? "User added" : `${emails.length} users added`);
        } catch (e) {
            toast.error(errorText(e, "Failed to add users"));
        } finally {
            setBusy(false);
        }
    };

    const onModifySelectedRoles = async () => {
        const emails = [...selected];
        if (emails.length === 0 || emails.length > MAX_BULK_EMAILS) return;
        try {
            setBusy(true);
            const resp = await API.updateRole({ emails, role: roleValue });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to modify roles");
                return;
            }
            setRoleOpen(false);
            setRoleValue("user");
            await reloadAll();
            toast.success(emails.length === 1 ? "Role updated" : `${emails.length} roles updated`);
        } catch (e) {
            toast.error(errorText(e, "Failed to modify roles"));
        } finally {
            setBusy(false);
        }
    };

    const onDeleteSelected = async () => {
        const emails = [...selected];
        if (emails.length === 0 || emails.length > MAX_BULK_EMAILS) return;
        try {
            setBusy(true);
            const resp = await API.deleteUsers({ emails });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to delete users");
                return;
            }
            await reloadAll();
            toast.success(emails.length === 1 ? "User deleted" : `${emails.length} users deleted`);
        } catch (e) {
            toast.error(errorText(e, "Failed to delete users"));
        } finally {
            setBusy(false);
        }
    };

    const roleSelect = (value: Role, onChange: (r: Role) => void, pool: Role[]) => (
        <Select value={value} onValueChange={(v) => onChange(v as Role)}>
            <SelectTrigger className="w-48">
                <SelectValue>{getRoleLabel(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
                {pool.map((r) => (
                    <SelectItem key={r} value={r}>
                        {getRoleLabel(r)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    const selectionOverCap = selected.size > MAX_BULK_EMAILS;
    const allOnPageSelected =
        paging.rows.length > 0 && paging.rows.every((u) => selected.has(u.email));

    const facetCount = (f: UserRoleFacet): number | null => {
        if (!userCounts) return null;
        if (f !== "all") return userCounts[f] ?? 0;
        if (typeof userCounts.all === "number") return userCounts.all;
        return ROLE_ORDER.reduce((sum, r) => sum + (userCounts[r] ?? 0), 0);
    };

    const withCount = (label: string, f: UserRoleFacet): string => {
        const n = facetCount(f);
        return n == null ? label : `${label} (${n})`;
    };

    return (
        <Card className="w-full rounded-2xl">
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <ModuleCardTitle title="Users" />
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => {
                                setAddRole("user");
                                setAddOpen(true);
                            }}
                            variant="outline"
                        >
                            <Users className="h-4 w-4" />
                            Add Users
                        </Button>
                        <HoverTip tip="Refresh — reload the list from the first page">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => void reloadAll()}
                                disabled={list.loading}
                                aria-label="Refresh"
                            >
                                <RefreshCcw
                                    className={list.loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                                />
                            </Button>
                        </HoverTip>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <Dialog
                    open={addOpen}
                    onOpenChange={(open) => {
                        if (!open && !busy) setAddOpen(false);
                    }}
                >
                    <DialogContent
                        onInteractOutside={(e) => e.preventDefault()}
                        className="sm:max-w-[560px] rounded-2xl [&>button:last-child]:hidden"
                    >
                        <DialogHeader className="flex flex-row items-center justify-between">
                            <DialogTitle>Add Users</DialogTitle>
                            <DialogClose asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label="Close"
                                    onClick={() => setAddOpen(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </DialogClose>
                        </DialogHeader>
                        <div className="grid gap-3">
                            <Textarea
                                rows={5}
                                value={addText}
                                onChange={(e) => setAddText(e.target.value)}
                                placeholder={uiText("placeholder.newUserEmails")}
                            />
                            <BulkEmailLimitNote count={parseEmails(addText).length} />
                            <div className="space-y-1">
                                <div className="text-sm font-medium">Role</div>
                                {roleSelect(addRole, setAddRole, allowedAddRoles)}
                            </div>
                            <div className="space-y-1">
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={sendInvite}
                                        onCheckedChange={(v) => setSendInvite(v === true)}
                                    />
                                    {uiText("users.sendInvite")}
                                </label>
                                {!sendInvite ? (
                                    <p className="pl-6 text-xs text-muted-foreground">
                                        {uiText("users.sendInviteOff")}
                                    </p>
                                ) : null}
                            </div>

                            <div>
                                <Button
                                    onClick={() => void onAddUsers()}
                                    variant="outline"
                                    disabled={
                                        busy ||
                                        parseEmails(addText).length === 0 ||
                                        parseEmails(addText).length > MAX_BULK_EMAILS
                                    }
                                >
                                    <Users className="h-4 w-4" />
                                    Add
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={roleOpen}
                    onOpenChange={(open) => {
                        if (!open && !busy) setRoleOpen(false);
                    }}
                >
                    <DialogContent
                        onInteractOutside={(e) => e.preventDefault()}
                        className="sm:max-w-[480px] rounded-2xl [&>button:last-child]:hidden"
                    >
                        <DialogHeader className="flex flex-row items-center justify-between">
                            <DialogTitle>Modify role</DialogTitle>
                            <DialogClose asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label="Close"
                                    onClick={() => setRoleOpen(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </DialogClose>
                        </DialogHeader>
                        <div className="grid gap-3">
                            <div className="text-sm text-muted-foreground">
                                {selected.size === 1
                                    ? "1 selected user is given this role."
                                    : `${selected.size} selected users are given this role.`}
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-medium">New role</div>
                                {roleSelect(roleValue, setRoleValue, allowedAddRoles)}
                            </div>
                            <div>
                                <Button
                                    onClick={() => void onModifySelectedRoles()}
                                    variant="outline"
                                    disabled={busy || selected.size === 0 || selectionOverCap}
                                >
                                    <UserCog className="h-4 w-4" />
                                    Modify
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <Card className="gap-0 rounded-2xl py-0">
                    <CardContent className="p-0">
                        <div className="flex flex-wrap items-end gap-4 border-b p-4">
                            <div className="space-y-1">
                                <div className="text-sm font-medium">Role</div>
                                <Select
                                    value={facet}
                                    onValueChange={(v) => onFacetChange(v as UserRoleFacet)}
                                >
                                    <SelectTrigger className="w-56">
                                        <SelectValue>
                                            {withCount(
                                                facet === "all" ? "All" : getRoleLabel(facet),
                                                facet,
                                            )}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            {withCount("All", "all")}
                                        </SelectItem>
                                        {ROLE_ORDER.map((r) => (
                                            <SelectItem key={r} value={r}>
                                                {withCount(getRoleLabel(r), r)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <form
                                className="flex min-w-[min(300px,100%)] flex-1 items-end gap-2"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void onLookup();
                                }}
                            >
                                <div className="flex-1 space-y-1">
                                    <Label
                                        htmlFor="user-lookup-email"
                                        className="text-sm font-medium"
                                    >
                                        Find a user by email
                                    </Label>
                                    <Input
                                        id="user-lookup-email"
                                        name="user-lookup-email"
                                        autoComplete="off"
                                        inputMode="email"
                                        spellCheck={false}
                                        value={lookupText}
                                        onChange={(e) => {
                                            setLookupText(e.target.value);
                                            setLookupError(null);
                                        }}
                                        placeholder={uiText("placeholder.userLookup")}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    variant="outline"
                                    disabled={lookingUp || !lookupText.trim()}
                                >
                                    <Search className="h-4 w-4" />
                                    Find
                                </Button>
                            </form>
                        </div>
                        {lookupError ? (
                            <div className="border-b p-4">
                                <Alert
                                    variant="destructive"
                                    className="border-destructive/50 bg-destructive/10"
                                >
                                    <AlertCircle />
                                    <AlertTitle className="font-semibold line-clamp-none">
                                        {lookupError}
                                    </AlertTitle>
                                </Alert>
                            </div>
                        ) : null}
                        {selected.size > 0 ? (
                            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 p-3">
                                <div className="text-sm">
                                    {selected.size} selected
                                    {selectionOverCap ? (
                                        <span className="ml-2 text-xs text-destructive">
                                            (at most {MAX_BULK_EMAILS} at a time)
                                        </span>
                                    ) : null}
                                </div>
                                <div className="ml-auto flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setRoleValue("user");
                                            setRoleOpen(true);
                                        }}
                                        disabled={busy || selectionOverCap}
                                    >
                                        <UserCog className="h-4 w-4" />
                                        Modify role
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                disabled={busy || selectionOverCap}
                                            >
                                                <UserMinus className="h-4 w-4" />
                                                Delete
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                    Delete {selected.size} user
                                                    {selected.size === 1 ? "" : "s"}?
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {uiText("users.actionCannotBeUndone")}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <div className="flex justify-end gap-2">
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => void onDeleteSelected()}
                                                >
                                                    Delete
                                                </AlertDialogAction>
                                            </div>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelected(new Set())}
                                        disabled={busy}
                                    >
                                        Clear selection
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-sm whitespace-nowrap">
                                <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur">
                                    <tr className="border-b">
                                        <th className="w-10 px-3 py-2 text-left">
                                            <Checkbox
                                                aria-label="Select all users on this page"
                                                checked={allOnPageSelected}
                                                onCheckedChange={(checked) => {
                                                    setSelected((prev) => {
                                                        const next = new Set(prev);
                                                        for (const u of paging.rows) {
                                                            if (checked === true) next.add(u.email);
                                                            else next.delete(u.email);
                                                        }
                                                        return next;
                                                    });
                                                }}
                                            />
                                        </th>
                                        <th className="w-14 px-3 py-2 text-left">#</th>
                                        <th className="px-3 py-2 text-left">Email</th>
                                        <th className="px-3 py-2 text-left">Name</th>
                                        <th className="px-3 py-2 text-left">Role</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paging.rows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-3 py-6 text-center text-muted-foreground"
                                            >
                                                {list.loading
                                                    ? "Loading…"
                                                    : (list.error ?? uiText("empty.users"))}
                                            </td>
                                        </tr>
                                    ) : (
                                        paging.rows.map((u, idx) => (
                                            <tr
                                                key={u?.email ?? idx}
                                                className="cursor-pointer border-b hover:bg-muted/50"
                                                onClick={() => openDetail(u)}
                                            >
                                                <td
                                                    className="w-10 px-3 py-2"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Checkbox
                                                        aria-label={`Select ${u.email}`}
                                                        checked={selected.has(u.email)}
                                                        onCheckedChange={(checked) =>
                                                            toggleSelected(
                                                                u.email,
                                                                checked === true,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    {paging.page * USERS_PAGE_SIZE + idx + 1}
                                                </td>
                                                <td className="px-3 py-2">{u?.email ?? "—"}</td>
                                                <td className="px-3 py-2">
                                                    {u?.userName ?? u?.email ?? "(unknown)"}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {getRoleLabel(u?.role ?? "")}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-3 py-2">
                            <Pager
                                page={paging.page}
                                pageCount={paging.pageCount}
                                total={facetCount(facet) ?? undefined}
                                totalLabel="users"
                                hasMore={paging.hasMore}
                                loading={list.loading}
                                showPageCount={false}
                                showLast={false}
                                onFirst={paging.first}
                                onPrev={paging.prev}
                                onNext={() => void paging.next()}
                                onLast={paging.last}
                            />
                        </div>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
    );
}
