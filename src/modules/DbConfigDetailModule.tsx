import { useCallback, useEffect, useState, useRef } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import type {
    AgentConfigPartRowModel,
    DbConnectionModel,
    DbConnectionPool,
} from "@/orval/search2o.schemas";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Trash2 } from "lucide-react";
import { ActionBar } from "@/shared/ActionBar";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { ProfileDoc } from "@/shared/ProfileDoc";
import { openNameSet, reopenByName, makeUiId } from "@/shared/collectionUi";
import { DYNAMIC_FIELD_INPUT_CLASS } from "@/shared/dynamicField";
import { WrappingInput } from "@/shared/WrappingInput";
import { dynamicFieldTitle, useDynamicFields } from "@/shared/dynamicSchema";
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";
import { UsedByAgents } from "@/shared/UsedByAgents";

import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp } from "@/shared/fieldHelp";
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
import { uiText } from "@/shared/uiText";
import { EXPR_TEXT, MAX_LENGTHS, textFieldsError } from "@/shared/schemaRules";

type EditableDbProfile = DbConnectionModel & {
    uiId: string;
    source: DbConnectionModel;
    connectArgsText: string;
    connectArgsError?: string;
    lastUpdatedByEmail?: string;
    lastUpdatedByName?: string;
    configVersion?: number;
    usedBy: string[];
    isNew?: boolean;
    isSaving?: boolean;
    isDeleting?: boolean;
};

function makeDefaultPool(): DbConnectionPool {
    return {
        isolationLevel: null,
        poolSize: 3,
        poolTimeout: 5,
        poolRecycle: -1,
        poolPrePing: false,
        maxOverflow: 10,
        idleTimeout: 300,
        connectArgs: {},
    };
}

function jsonPretty(v: unknown) {
    try {
        return JSON.stringify(v ?? {}, null, 2);
    } catch {
        return "{}";
    }
}

function itemToEditable(item: AgentConfigPartRowModel): EditableDbProfile {
    const profile = item.configValue as DbConnectionModel;
    const pool = profile.connectionPool ?? makeDefaultPool();
    return {
        uiId: makeUiId(profile.name),
        source: profile,
        name: profile.name,
        doc: profile.doc ?? "",
        connectionString: profile.connectionString ?? "",
        poolKey: profile.poolKey ?? "",
        connectionPool: pool,
        connectArgsText: jsonPretty(pool.connectArgs),
        connectArgsError: undefined,
        lastUpdatedByEmail: item.lastUpdatedByEmail,
        lastUpdatedByName: item.lastUpdatedByName,
        configVersion: item.configVersion,
        usedBy: Array.isArray(item.usedBy) ? item.usedBy : [],
    };
}

function editableToProfile(profile: EditableDbProfile): DbConnectionModel {
    return {
        ...profile.source,
        name: profile.name.trim(),
        type: "db",
        connectionString: profile.connectionString ?? "",
        poolKey: profile.poolKey?.trim() ? profile.poolKey : null,
        connectionPool: profile.connectionPool ?? makeDefaultPool(),
        doc: profile.doc ?? "",
    };
}

function openAgentView(agentName: string) {
    UI.openSubModule("AgentView", {
        agentName,
    });
}

function PoolEditor(props: {
    pool: DbConnectionPool;
    setPool: (next: DbConnectionPool) => void;
    connectArgsText: string;
    setConnectArgsText: (value: string) => void;
    connectArgsError?: string | null;
    helperText?: string;
    idPrefix: string;
    disabled?: boolean;
}) {
    const {
        pool,
        setPool,
        connectArgsText,
        setConnectArgsText,
        connectArgsError,
        helperText,
        idPrefix,
        disabled,
    } = props;
    const fh = useFieldHelp("DbConnectionPool");

    const updatePool = <K extends keyof DbConnectionPool>(key: K, value: DbConnectionPool[K]) => {
        setPool({ ...pool, [key]: value });
    };

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="grid gap-2">
                <FieldLabel help={fh("isolationLevel")} htmlFor={`${idPrefix}-isolation`}>
                    Isolation level
                </FieldLabel>
                <Select
                    value={pool.isolationLevel ?? "none"}
                    onValueChange={(v) =>
                        updatePool(
                            "isolationLevel",
                            v === "none" ? null : (v as DbConnectionPool["isolationLevel"]),
                        )
                    }
                    disabled={disabled}
                >
                    <SelectTrigger id={`${idPrefix}-isolation`} className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="READ COMMITTED">READ COMMITTED</SelectItem>
                        <SelectItem value="AUTOCOMMIT">AUTOCOMMIT</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-2">
                <FieldLabel help={fh("poolSize")} htmlFor={`${idPrefix}-poolSize`}>
                    Pool size
                </FieldLabel>
                <Input
                    id={`${idPrefix}-poolSize`}
                    type="number"
                    value={pool.poolSize}
                    onChange={(e) => updatePool("poolSize", Number(e.target.value))}
                    disabled={disabled}
                />
            </div>

            <div className="grid gap-2">
                <FieldLabel help={fh("poolTimeout")} htmlFor={`${idPrefix}-poolTimeout`}>
                    Pool timeout (sec)
                </FieldLabel>
                <Input
                    id={`${idPrefix}-poolTimeout`}
                    type="number"
                    value={pool.poolTimeout}
                    onChange={(e) => updatePool("poolTimeout", Number(e.target.value))}
                    disabled={disabled}
                />
            </div>

            <div className="grid gap-2">
                <FieldLabel help={fh("poolRecycle")} htmlFor={`${idPrefix}-poolRecycle`}>
                    Pool recycle (sec)
                </FieldLabel>
                <Input
                    id={`${idPrefix}-poolRecycle`}
                    type="number"
                    value={pool.poolRecycle}
                    onChange={(e) => updatePool("poolRecycle", Number(e.target.value))}
                    disabled={disabled}
                />
            </div>

            <div className="grid gap-2">
                <FieldLabel help={fh("maxOverflow")} htmlFor={`${idPrefix}-maxOverflow`}>
                    Max overflow
                </FieldLabel>
                <Input
                    id={`${idPrefix}-maxOverflow`}
                    type="number"
                    value={pool.maxOverflow}
                    onChange={(e) => updatePool("maxOverflow", Number(e.target.value))}
                    disabled={disabled}
                />
            </div>

            <div className="grid gap-2">
                <FieldLabel help={fh("idleTimeout")} htmlFor={`${idPrefix}-idleTimeout`}>
                    Idle timeout (sec)
                </FieldLabel>
                <Input
                    id={`${idPrefix}-idleTimeout`}
                    type="number"
                    min={0}
                    step={1}
                    value={pool.idleTimeout ?? ""}
                    placeholder="300"
                    onChange={(e) =>
                        updatePool(
                            "idleTimeout",
                            e.target.value === ""
                                ? undefined
                                : Math.max(0, Math.floor(Number(e.target.value))),
                        )
                    }
                    disabled={disabled}
                />
            </div>

            <div className="grid gap-2 md:col-span-3">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`${idPrefix}-poolPrePing`}
                        checked={!!pool.poolPrePing}
                        onCheckedChange={(v) => updatePool("poolPrePing", v === true)}
                        disabled={disabled}
                    />
                    <FieldLabel
                        help={fh("poolPrePing")}
                        className="cursor-pointer"
                        htmlFor={`${idPrefix}-poolPrePing`}
                    >
                        Pre-ping connections
                    </FieldLabel>
                </div>
                <div className="text-xs text-muted-foreground">{uiText("help.dbValidate")}</div>
            </div>

            <div className="grid gap-2 md:col-span-3">
                <FieldLabel help={fh("connectArgs")} htmlFor={`${idPrefix}-connectArgs`}>
                    Connect args (JSON)
                </FieldLabel>
                <Textarea
                    id={`${idPrefix}-connectArgs`}
                    className="font-mono text-xs"
                    value={connectArgsText}
                    onChange={(e) => setConnectArgsText(e.target.value)}
                    disabled={disabled}
                />
                {connectArgsError ? (
                    <div className="text-xs text-destructive">{connectArgsError}</div>
                ) : (
                    <div className="text-xs text-muted-foreground">
                        {helperText ?? uiText("help.dbOptions")}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DbConfigDetailModule() {
    function addProfile() {
        const uiId = makeUiId("db");
        setProfiles((previous) => [
            {
                uiId,
                source: { name: "", type: "db" },
                name: "",
                connectionString: "",
                poolKey: "",
                connectionPool: makeDefaultPool(),
                connectArgsText: jsonPretty(makeDefaultPool().connectArgs),
                usedBy: [],
                isNew: true,
            },
            ...previous,
        ]);
        setOpenProfiles((previous) => ({ ...previous, [uiId]: true }));
    }

    const payload = UI.useModulePayload<{ name?: string; isNew?: boolean }>();
    const fh = useFieldHelp("DbConnectionModel", "DbConnectionPool");
    const dynamic = useDynamicFields("DbConnectionModel");
    const [loading, setLoading] = useState(true);
    const [, setError] = useState<string | null>(null);
    const [collectionConfigVersion, setCollectionConfigVersion] = useState<number>(0);
    const [profiles, setProfiles] = useState<EditableDbProfile[]>([]);
    const [openProfiles, setOpenProfiles] = useState<Record<string, boolean>>({});
    const [deleteTarget, setDeleteTarget] = useState<{
        index: number;
        name: string;
    } | null>(null);

    const loadProfiles = useCallback(async (keepOpenNames?: Set<string>) => {
        try {
            setLoading(true);
            const response = await API.getAgentConfigPart({ part: "db" });

            if (!response.success) {
                const message = response.error?.message || "Failed to load database profiles";
                toast.error(message);
                setError(message);
                return;
            }

            const configParts = response.configParts ?? [];

            const maxConfigVersion = configParts.reduce(
                (max, item) => Math.max(max, Number(item?.configVersion ?? 0)),
                0,
            );

            setCollectionConfigVersion(maxConfigVersion);
            const nextProfiles = configParts.map(itemToEditable);
            setProfiles(nextProfiles);
            setOpenProfiles(reopenByName(nextProfiles, keepOpenNames));
            setError(null);
        } catch (e) {
            const message = errorText(e, "Failed to load database profiles");
            toast.error(message);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadProfiles();
    }, [loadProfiles]);

    function removeLocalProfile(index: number) {
        const uiId = profiles[index]?.uiId;
        if (uiId) {
            setOpenProfiles((previous) => {
                const next = { ...previous };
                delete next[uiId];
                return next;
            });
        }
        setProfiles((previous) => previous.filter((_, i) => i !== index));
    }

    function updateProfileField<K extends keyof EditableDbProfile>(
        index: number,
        field: K,
        value: EditableDbProfile[K],
    ) {
        setProfiles((previous) =>
            previous.map((profile, i) => (i === index ? { ...profile, [field]: value } : profile)),
        );
    }

    function updateConnectArgsText(index: number, text: string) {
        setProfiles((previous) =>
            previous.map((profile, i) => {
                if (i !== index) return profile;

                try {
                    const obj = text.trim() ? JSON.parse(text) : {};
                    return {
                        ...profile,
                        connectArgsText: text,
                        connectArgsError: undefined,
                        connectionPool: {
                            ...(profile.connectionPool ?? makeDefaultPool()),
                            connectArgs: obj,
                        },
                    };
                } catch {
                    return {
                        ...profile,
                        connectArgsText: text,
                        connectArgsError: "Invalid JSON",
                    };
                }
            }),
        );
    }

    async function handleUpsert(index: number): Promise<boolean> {
        const profile = profiles[index];
        if (!profile) return false;

        if (!profile.name.trim()) {
            toast.error("Profile name is required");
            return false;
        }

        if (!(profile.connectionString ?? "").trim()) {
            toast.error("Connection string is required");
            return false;
        }

        const text = textFieldsError(EXPR_TEXT, [
            { label: "The connection string", value: profile.connectionString },
            { label: "The pool key", value: profile.poolKey },
        ]);
        if (text) {
            toast.error(text);
            return false;
        }

        if (profile.connectArgsError) {
            toast.error("Connect args must be valid JSON");
            return false;
        }

        try {
            updateProfileField(index, "isSaving", true);
            const response = await API.upsertAgentConfigPart({
                configValue: editableToProfile(profile),
                configVersion: profile.configVersion ?? collectionConfigVersion ?? 0,
            });

            if (!response.success) {
                toast.error(response.error?.message || "Failed to save database profile");
                return false;
            }

            toast.success("Database profile saved");
            await loadProfiles(openNameSet(profiles, openProfiles));
            if (profile.isNew) {
                UI.updatePayload({ name: profile.name.trim(), isNew: false });
            }
            return true;
        } catch (e) {
            toast.error(errorText(e, "Failed to save database profile"));
            return false;
        } finally {
            updateProfileField(index, "isSaving", false);
        }
    }

    async function handleConfirmDelete() {
        if (!deleteTarget) return;
        await handleDelete(deleteTarget.index);
        setDeleteTarget(null);
        releaseGuard();
        UI.goBack("DbConfig");
    }

    async function handleDelete(index: number) {
        const profile = profiles[index];
        if (!profile) return;

        if (profile.isNew || !profile.name.trim()) {
            removeLocalProfile(index);
            return;
        }

        try {
            updateProfileField(index, "isDeleting", true);
            const response = await API.deleteAgentConfigPart({
                part: "db",
                name: profile.name.trim(),
                configVersion: profile.configVersion ?? collectionConfigVersion ?? 0,
            });

            if (!response.success) {
                toast.error(response.error?.message || "Failed to delete database profile");
                return;
            }

            toast.success("Database profile deleted");
            await loadProfiles(openNameSet(profiles, openProfiles));
        } catch (e) {
            toast.error(errorText(e, "Failed to delete database profile"));
        } finally {
            updateProfileField(index, "isDeleting", false);
        }
    }

    useEffect(() => {
        if (loading || !payload?.isNew) return;
        if (profiles.some((x) => x.isNew)) return;
        addProfile();
    }, [loading, payload?.isNew, profiles]);

    const index = payload?.name
        ? profiles.findIndex((p) => (p.name ?? "") === payload.name)
        : profiles.findIndex((p) => p.isNew);
    const profile = index >= 0 ? profiles[index] : undefined;

    const snapshotOf = (p: (typeof profiles)[number]) =>
        JSON.stringify({
            ...p,
            uiId: undefined,
            isNew: undefined,
            usedBy: undefined,
            isSaving: undefined,
            isDeleting: undefined,
            configVersion: undefined,
            lastUpdatedByEmail: undefined,
            lastUpdatedByName: undefined,
            source: undefined,
        });
    const savedSnapshotRef = useRef<string | null>(null);
    const collRef = useRef(profiles);
    collRef.current = profiles;
    const key = profile ? `${profile.uiId}:${index}` : "";
    const lastKeyRef = useRef("");
    if (profile && key !== lastKeyRef.current) {
        lastKeyRef.current = key;
        savedSnapshotRef.current = profile.isNew ? null : snapshotOf(profile);
    }
    const dirty =
        !!profile &&
        (savedSnapshotRef.current === null || snapshotOf(profile) !== savedSnapshotRef.current);

    const { dialog: unsavedDialog, release: releaseGuard } = useUnsavedChanges({
        what: "profile",
        isDirty: () => {
            const current = collRef.current[index];
            if (!current) return false;
            if (savedSnapshotRef.current === null) return true;
            return snapshotOf(current) !== savedSnapshotRef.current;
        },
        onSave: async () => (index >= 0 ? handleUpsert(index) : false),
    });

    if (loading) {
        return (
            <Card className="w-full shadow-sm">
                <CardHeader>
                    <ModuleCardTitle title="Database profile" help="db-profile-detail" />
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
            </Card>
        );
    }

    if (!profile) {
        return (
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <ModuleCardTitle title="Database profile" help="db-profile-detail" />
                    <BackButton fallback="DbConfig" />
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    That profile no longer exists.
                </CardContent>
            </Card>
        );
    }

    const isUsed = profile.usedBy.length > 0;
    const pool = profile.connectionPool ?? makeDefaultPool();

    return (
        <>
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                        <ModuleCardTitle
                            title={profile.name || "New database profile"}
                            help="db-profile-detail"
                        />
                        {profile.isNew ? (
                            <div className="space-y-1 pt-1">
                                <HoverTip tip={uiText("validate.profileNameChars")}>
                                    <Input
                                        autoFocus
                                        value={profile.name}
                                        onChange={(e) =>
                                            updateProfileField(index, "name", e.target.value)
                                        }
                                        placeholder="Profile name"
                                        maxLength={MAX_LENGTHS.PROFILE_NAME.max}
                                        className="h-8 w-full max-w-sm"
                                    />
                                </HoverTip>
                            </div>
                        ) : null}
                        {isUsed ? (
                            <UsedByAgents names={profile.usedBy} onOpen={openAgentView} />
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                        <BackButton fallback="DbConfig" />
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="space-y-4 px-6 pb-4">
                        <Card className="rounded-2xl border bg-card shadow-none">
                            <CardHeader>
                                <CardTitle>Connection</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <FieldLabel
                                        help={fh("connectionString")}
                                        htmlFor={`profile-${index}-connection-string`}
                                    >
                                        Connection string
                                    </FieldLabel>
                                    <HoverTip
                                        tip={
                                            dynamic.field("connectionString")
                                                ? dynamicFieldTitle()
                                                : undefined
                                        }
                                    >
                                        <WrappingInput
                                            id={`profile-${index}-connection-string`}
                                            value={profile.connectionString ?? ""}
                                            onValueChange={(value) =>
                                                updateProfileField(index, "connectionString", value)
                                            }
                                            className={
                                                dynamic.field("connectionString")
                                                    ? DYNAMIC_FIELD_INPUT_CLASS
                                                    : undefined
                                            }
                                            disabled={profile.isSaving || profile.isDeleting}
                                        />
                                    </HoverTip>
                                </div>

                                <div className="grid gap-2">
                                    <FieldLabel
                                        help={fh("poolKey")}
                                        htmlFor={`profile-${index}-pool-key`}
                                    >
                                        Pool key
                                    </FieldLabel>
                                    <HoverTip
                                        tip={
                                            dynamic.field("poolKey")
                                                ? dynamicFieldTitle()
                                                : undefined
                                        }
                                    >
                                        <WrappingInput
                                            id={`profile-${index}-pool-key`}
                                            value={profile.poolKey ?? ""}
                                            onValueChange={(value) =>
                                                updateProfileField(index, "poolKey", value)
                                            }
                                            placeholder={uiText("placeholder.sharedPool")}
                                            className={
                                                dynamic.field("poolKey")
                                                    ? DYNAMIC_FIELD_INPUT_CLASS
                                                    : undefined
                                            }
                                            disabled={profile.isSaving || profile.isDeleting}
                                        />
                                    </HoverTip>
                                </div>

                                <PoolEditor
                                    idPrefix={`profile-${index}`}
                                    pool={pool}
                                    setPool={(next) =>
                                        updateProfileField(index, "connectionPool", next)
                                    }
                                    connectArgsText={profile.connectArgsText}
                                    setConnectArgsText={(value) =>
                                        updateConnectArgsText(index, value)
                                    }
                                    connectArgsError={profile.connectArgsError}
                                    disabled={profile.isSaving || profile.isDeleting}
                                />

                                <ProfileDoc
                                    id={`db-doc-${index}`}
                                    value={profile.doc ?? ""}
                                    help={fh("doc")}
                                    disabled={profile.isSaving || profile.isDeleting}
                                    onChange={(v) => updateProfileField(index, "doc", v)}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>

                <ActionBar
                    onUpdate={() => void handleUpsert(index)}
                    dirty={dirty}
                    busy={!!profile.isSaving}
                    disabled={!!profile.isDeleting}
                    start={
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget({ index, name: profile.name ?? "" })}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                            <span className="order-last basis-full text-xs text-muted-foreground sm:order-none sm:basis-auto">
                                {isUsed
                                    ? uiText("delete.dbInUse")
                                    : uiText("delete.cannotBeUndone")}
                            </span>
                        </>
                    }
                />
            </Card>

            <AlertDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete profile</AlertDialogTitle>
                        <AlertDialogDescription>
                            Any agents using{" "}
                            <span className="font-semibold">{deleteTarget?.name}</span> will fail
                            immediately. Are you sure?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {unsavedDialog}
        </>
    );
}
