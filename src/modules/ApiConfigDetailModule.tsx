import { useCallback, useEffect, useState, useRef } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import type { ApiServerModel, AgentConfigPartRowModel, PathAdd } from "@/orval/search2o.schemas";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";
import { ActionBar } from "@/shared/ActionBar";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { ProfileDoc } from "@/shared/ProfileDoc";
import { openNameSet, reopenByName, makeUiId } from "@/shared/collectionUi";
import { DYNAMIC_FIELD_INPUT_CLASS } from "@/shared/dynamicField";
import { WrappingInput } from "@/shared/WrappingInput";
import { dynamicFieldTitle, useDynamicFields } from "@/shared/dynamicSchema";
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
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";
import { UsedByAgents } from "@/shared/UsedByAgents";

import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import { KeyValueRows } from "@/shared/KeyValueRows";
import {
    rowsFromValueMap,
    rowsToValueMap,
    rowValueFields,
    type KeyValueRow,
} from "@/shared/keyValueMap";
import { ConnectionPoolNameField } from "@/shared/apiConnectionPools";
import { DEFAULT_POOL_NAME } from "@/shared/apiConnectionPoolNames";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import { EXPR_TEXT, MAX_LENGTHS, textFieldsError } from "@/shared/schemaRules";

const COMMAND_CAN_OVERRIDE = "Command can override";

interface EditableApi extends Omit<ApiServerModel, "headers" | "queryParams"> {
    uiId: string;
    source: ApiServerModel;
    headersRows: KeyValueRow[];
    queryParamRows: KeyValueRow[];
    lastUpdatedByEmail?: string;
    lastUpdatedByName?: string;
    configVersion?: number;
    usedBy: string[];
    isNew?: boolean;
    isSaving?: boolean;
    isDeleting?: boolean;
}

function apiToEditable(item: AgentConfigPartRowModel): EditableApi {
    const api = item.configValue as ApiServerModel;
    return {
        uiId: makeUiId(api.name),
        source: api,
        name: api.name,
        url: api.url,
        doc: api.doc ?? "",
        headersRows: rowsFromValueMap(api.headers),
        queryParamRows: rowsFromValueMap(api.queryParams),
        addPath: api.addPath ?? "can",
        canAddHeaders: api.canAddHeaders ?? false,
        canAddQueryParams: api.canAddQueryParams ?? false,
        connectionPoolName: api.connectionPoolName || DEFAULT_POOL_NAME,
        lastUpdatedByEmail: item.lastUpdatedByEmail,
        lastUpdatedByName: item.lastUpdatedByName,
        configVersion: item.configVersion,
        usedBy: item.usedBy ?? [],
    };
}

function editableToApi(api: EditableApi): ApiServerModel {
    return {
        ...api.source,
        name: api.name.trim(),
        type: "api",
        url: api.url,
        addPath: api.addPath ?? "can",
        headers: rowsToValueMap(api.headersRows),
        canAddHeaders: api.canAddHeaders ?? false,
        queryParams: rowsToValueMap(api.queryParamRows),
        canAddQueryParams: api.canAddQueryParams ?? false,
        connectionPoolName: api.connectionPoolName || DEFAULT_POOL_NAME,
        doc: api.doc ?? "",
    };
}

export default function ApiConfigDetailModule() {
    function addApi() {
        const uiId = makeUiId("api");
        setApis((previous) => [
            {
                uiId,
                source: { name: "", type: "api", url: "", connectionPoolName: DEFAULT_POOL_NAME },
                name: "",
                url: "",
                headersRows: [],
                queryParamRows: [],
                addPath: "can",
                canAddHeaders: false,
                canAddQueryParams: false,
                connectionPoolName: DEFAULT_POOL_NAME,
                isNew: true,
                usedBy: [],
            },
            ...previous,
        ]);
        setOpenApis((previous) => ({ ...previous, [uiId]: true }));
    }

    const payload = UI.useModulePayload<{ name?: string; isNew?: boolean }>();
    const fh = useFieldHelp(
        "ApiServerModel",
        "ApiConnectionPoolModel",
        "TimeoutModel",
        "ValueModel",
    );
    const ft = useFieldTitle("ApiServerModel", "ValueModel");
    const dynamic = useDynamicFields("ApiServerModel");
    const [loading, setLoading] = useState(true);
    const [, setError] = useState<string | null>(null);
    const [collectionConfigVersion, setCollectionConfigVersion] = useState<number>(0);
    const [apis, setApis] = useState<EditableApi[]>([]);
    const [openApis, setOpenApis] = useState<Record<string, boolean>>({});
    const [deleteTarget, setDeleteTarget] = useState<{
        index: number;
        name: string;
    } | null>(null);

    const loadApis = useCallback(async (keepOpenNames?: Set<string>) => {
        try {
            setLoading(true);
            const response = await API.getAgentConfigPart({ part: "api" });

            if (!response.success) {
                const message = response.error?.message || "Failed to load API connections";
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
            const nextApis = configParts.map(apiToEditable);
            setApis(nextApis);
            setOpenApis(reopenByName(nextApis, keepOpenNames));
            setError(null);
        } catch (e) {
            const message = errorText(e, "Failed to load API connections");
            toast.error(message);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadApis();
    }, [loadApis]);

    function removeLocalApi(index: number) {
        const uiId = apis[index]?.uiId;
        if (uiId) {
            setOpenApis((previous) => {
                const next = { ...previous };
                delete next[uiId];
                return next;
            });
        }
        setApis((previous) => previous.filter((_, i) => i !== index));
    }

    function updateApiField<K extends keyof EditableApi>(
        index: number,
        field: K,
        value: EditableApi[K],
    ) {
        setApis((previous) =>
            previous.map((api, i) => (i === index ? { ...api, [field]: value } : api)),
        );
    }

    function openAgentView(agentName: string) {
        UI.openSubModule("AgentView", {
            agentName,
        });
    }

    async function handleUpsert(index: number): Promise<boolean> {
        const api = apis[index];
        if (!api) return false;

        if (!api.name.trim()) {
            toast.error("API name is required");
            return false;
        }

        const text = textFieldsError(EXPR_TEXT, [
            { label: "The URL", value: api.url },
            ...rowValueFields(api.headersRows, "Header"),
            ...rowValueFields(api.queryParamRows, "Query parameter"),
        ]);
        if (text) {
            toast.error(text);
            return false;
        }

        try {
            updateApiField(index, "isSaving", true);
            const response = await API.upsertAgentConfigPart({
                configValue: editableToApi(api),
                configVersion: api.configVersion ?? collectionConfigVersion ?? 0,
            });

            if (!response.success) {
                toast.error(response.error?.message || "Failed to save API connection");
                return false;
            }

            toast.success("API connection saved");
            await loadApis(openNameSet(apis, openApis));
            if (api.isNew) {
                UI.updatePayload({ name: api.name.trim(), isNew: false });
            }
            return true;
        } catch (e) {
            toast.error(errorText(e, "Failed to save API connection"));
            return false;
        } finally {
            updateApiField(index, "isSaving", false);
        }
    }

    async function handleConfirmDelete() {
        if (!deleteTarget) return;
        await handleDelete(deleteTarget.index);
        setDeleteTarget(null);
        releaseGuard();
        UI.goBack("ApiConfig");
    }

    async function handleDelete(index: number) {
        const api = apis[index];
        if (!api) return;

        if (api.isNew || !api.name.trim()) {
            removeLocalApi(index);
            return;
        }

        try {
            updateApiField(index, "isDeleting", true);
            const response = await API.deleteAgentConfigPart({
                part: "api",
                name: api.name.trim(),
                configVersion: api.configVersion ?? collectionConfigVersion ?? 0,
            });

            if (!response.success) {
                toast.error(response.error?.message || "Failed to delete API connection");
                return;
            }

            toast.success("API connection deleted");
            await loadApis(openNameSet(apis, openApis));
        } catch (e) {
            toast.error(errorText(e, "Failed to delete API connection"));
        } finally {
            updateApiField(index, "isDeleting", false);
        }
    }

    useEffect(() => {
        if (loading || !payload?.isNew) return;
        if (apis.some((x) => x.isNew)) return;
        addApi();
    }, [loading, payload?.isNew, apis]);

    const index = payload?.name
        ? apis.findIndex((p) => (p.name ?? "") === payload.name)
        : apis.findIndex((p) => p.isNew);
    const api = index >= 0 ? apis[index] : undefined;

    const snapshotOf = (p: (typeof apis)[number]) =>
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
    const collRef = useRef(apis);
    collRef.current = apis;
    const key = api ? `${api.uiId}:${index}` : "";
    const lastKeyRef = useRef("");
    if (api && key !== lastKeyRef.current) {
        lastKeyRef.current = key;
        savedSnapshotRef.current = api.isNew ? null : snapshotOf(api);
    }
    const dirty =
        !!api &&
        (savedSnapshotRef.current === null || snapshotOf(api) !== savedSnapshotRef.current);

    const { dialog: unsavedDialog, release: releaseGuard } = useUnsavedChanges({
        what: "API profile",
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
                    <ModuleCardTitle title="API profile" help="api-profile-detail" />
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
            </Card>
        );
    }

    if (!api) {
        return (
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <ModuleCardTitle title="API profile" help="api-profile-detail" />
                    <BackButton fallback="ApiConfig" />
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    That API no longer exists.
                </CardContent>
            </Card>
        );
    }

    const isUsed = api.usedBy.length > 0;

    return (
        <>
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                        <ModuleCardTitle
                            title={api.name || "New api profile"}
                            help="api-profile-detail"
                        />
                        {api.isNew ? (
                            <div className="space-y-1 pt-1">
                                <HoverTip tip={uiText("validate.profileNameChars")}>
                                    <Input
                                        autoFocus
                                        value={api.name}
                                        onChange={(e) =>
                                            updateApiField(index, "name", e.target.value)
                                        }
                                        placeholder="Profile name"
                                        maxLength={MAX_LENGTHS.PROFILE_NAME.max}
                                        className="h-8 w-full max-w-sm"
                                    />
                                </HoverTip>
                            </div>
                        ) : null}
                        {isUsed ? <UsedByAgents names={api.usedBy} onOpen={openAgentView} /> : null}
                    </div>
                    <div className="flex items-center gap-2">
                        <BackButton fallback="ApiConfig" />
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="max-w-4xl space-y-6 px-6 pb-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2 md:col-span-2">
                                <FieldLabel help={fh("url")} htmlFor={`api-url-${index}`}>
                                    {ft("url", "Server URL")}
                                </FieldLabel>
                                <HoverTip
                                    tip={dynamic.field("url") ? dynamicFieldTitle() : undefined}
                                >
                                    <WrappingInput
                                        id={`api-url-${index}`}
                                        value={api.url}
                                        onValueChange={(value) =>
                                            updateApiField(index, "url", value)
                                        }
                                        placeholder="https://api.example.com"
                                        className={
                                            dynamic.field("url")
                                                ? DYNAMIC_FIELD_INPUT_CLASS
                                                : undefined
                                        }
                                        disabled={api.isSaving || api.isDeleting}
                                    />
                                </HoverTip>
                            </div>

                            <div className="grid min-w-0 gap-2">
                                <FieldLabel help={fh("addPath")} htmlFor={`api-add-path-${index}`}>
                                    Path
                                </FieldLabel>
                                <Select
                                    value={api.addPath ?? "can"}
                                    onValueChange={(value) =>
                                        updateApiField(index, "addPath", value as PathAdd)
                                    }
                                    disabled={api.isSaving || api.isDeleting}
                                >
                                    <SelectTrigger
                                        id={`api-add-path-${index}`}
                                        className="w-full min-w-0 *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="can">
                                            {uiText("api.addPath.can")}
                                        </SelectItem>
                                        <SelectItem value="cannot">
                                            {uiText("api.addPath.cannot")}
                                        </SelectItem>
                                        <SelectItem value="must">
                                            {uiText("api.addPath.must")}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <ConnectionPoolNameField
                                id={`api-pool-${index}`}
                                help={fh("connectionPoolName")}
                                value={api.connectionPoolName ?? DEFAULT_POOL_NAME}
                                onChange={(next) =>
                                    updateApiField(index, "connectionPoolName", next)
                                }
                                disabled={api.isSaving || api.isDeleting}
                            />
                        </div>

                        <Separator />

                        <KeyValueRows
                            idPrefix={`api-headers-${index}`}
                            label={ft("headers", "Server headers")}
                            help={fh("headers")}
                            rows={api.headersRows}
                            onChange={(rows) => updateApiField(index, "headersRows", rows)}
                            addLabel="Add header"
                            emptyText="No headers are sent with every call."
                            keyHeading="Header"
                            valueHeading="Value"
                            keyPlaceholder="Authorization"
                            valuePlaceholder="Header value"
                            valueTip={
                                dynamic.entryValue("headers") ? dynamicFieldTitle() : undefined
                            }
                            valueClassName={
                                dynamic.entryValue("headers")
                                    ? DYNAMIC_FIELD_INPUT_CLASS
                                    : undefined
                            }
                            overrideLabel={COMMAND_CAN_OVERRIDE}
                            overrideHelp={fh("override")}
                            disabled={api.isSaving || api.isDeleting}
                            footer={
                                <FieldLabel
                                    help={fh("canAddHeaders")}
                                    className="flex w-fit items-center gap-2 font-normal"
                                >
                                    <Checkbox
                                        checked={api.canAddHeaders ?? false}
                                        onCheckedChange={(checked) =>
                                            updateApiField(index, "canAddHeaders", checked === true)
                                        }
                                        disabled={api.isSaving || api.isDeleting}
                                    />
                                    {uiText("api.canAddHeaders")}
                                </FieldLabel>
                            }
                        />

                        <Separator />

                        <KeyValueRows
                            idPrefix={`api-params-${index}`}
                            label={ft("queryParams", "Query parameters")}
                            help={fh("queryParams")}
                            rows={api.queryParamRows}
                            onChange={(rows) => updateApiField(index, "queryParamRows", rows)}
                            addLabel="Add query parameter"
                            emptyText="No query parameters are sent with every call."
                            keyHeading="Parameter"
                            valueHeading="Value"
                            keyPlaceholder="api_version"
                            valuePlaceholder="Parameter value"
                            valueTip={
                                dynamic.entryValue("queryParams") ? dynamicFieldTitle() : undefined
                            }
                            valueClassName={
                                dynamic.entryValue("queryParams")
                                    ? DYNAMIC_FIELD_INPUT_CLASS
                                    : undefined
                            }
                            overrideLabel={COMMAND_CAN_OVERRIDE}
                            overrideHelp={fh("override")}
                            disabled={api.isSaving || api.isDeleting}
                            footer={
                                <FieldLabel
                                    help={fh("canAddQueryParams")}
                                    className="flex w-fit items-center gap-2 font-normal"
                                >
                                    <Checkbox
                                        checked={api.canAddQueryParams ?? false}
                                        onCheckedChange={(checked) =>
                                            updateApiField(
                                                index,
                                                "canAddQueryParams",
                                                checked === true,
                                            )
                                        }
                                        disabled={api.isSaving || api.isDeleting}
                                    />
                                    {uiText("api.canAddQueryParams")}
                                </FieldLabel>
                            }
                        />

                        <Separator />

                        <ProfileDoc
                            id={`api-doc-${index}`}
                            value={api.doc ?? ""}
                            help={fh("doc")}
                            disabled={api.isSaving || api.isDeleting}
                            onChange={(v) => updateApiField(index, "doc", v)}
                        />
                    </div>
                </CardContent>

                <ActionBar
                    onUpdate={() => void handleUpsert(index)}
                    dirty={dirty}
                    busy={!!api.isSaving}
                    disabled={!!api.isDeleting}
                    start={
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget({ index, name: api.name ?? "" })}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                            <span className="order-last basis-full text-xs text-muted-foreground sm:order-none sm:basis-auto">
                                {isUsed
                                    ? uiText("delete.apiInUse")
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
                        <AlertDialogTitle>Delete api</AlertDialogTitle>
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
