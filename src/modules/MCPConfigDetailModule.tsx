import { useCallback, useEffect, useState, useRef } from "react";
import * as API from "@/orval/search2o";
import type { AgentConfigPartRowModel, McpServerModel } from "@/orval/search2o.schemas";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoverTip } from "@/shared/HoverTip";
import { Separator } from "@/components/ui/separator";
import { Trash2 } from "lucide-react";
import { ActionBar } from "@/shared/ActionBar";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { ProfileDoc } from "@/shared/ProfileDoc";
import { openNameSet, reopenByName, makeUiId } from "@/shared/collectionUi";
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
    makeKeyValueRow,
    rowsFromTextMap,
    rowsToTextMap,
    rowValueFields,
    type KeyValueRow,
} from "@/shared/keyValueMap";
import { DYNAMIC_FIELD_INPUT_CLASS } from "@/shared/dynamicField";
import { WrappingInput } from "@/shared/WrappingInput";
import { dynamicFieldTitle, useDynamicFields } from "@/shared/dynamicSchema";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import {
    EXPR_TEXT,
    MCP_SERVER_NAME,
    matchesRule,
    MAX_LENGTHS,
    textFieldsError,
} from "@/shared/schemaRules";

interface EditableServer extends Omit<McpServerModel, "headers" | "retryableErrorCodes"> {
    uiId: string;
    source: McpServerModel;
    headersRows: KeyValueRow[];
    retryableErrorCodesText: string;
    lastUpdatedByEmail?: string;
    lastUpdatedByName?: string;
    configVersion?: number;
    usedBy: string[];
    isNew?: boolean;
    isSaving?: boolean;
    isDeleting?: boolean;
}

function errorCodesToText(codes: number[] | undefined): string {
    return (codes ?? []).join(", ");
}

function textToErrorCodes(text: string): number[] {
    return text
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .map(Number)
        .filter((value) => Number.isInteger(value));
}

function serverToEditable(item: AgentConfigPartRowModel): EditableServer {
    const server = item.configValue as McpServerModel;
    return {
        uiId: makeUiId(server.name),
        source: server,
        name: server.name,
        url: server.url,
        doc: server.doc ?? "",
        headersRows: rowsFromTextMap(server.headers),
        retryableErrorCodesText: errorCodesToText(server.retryableErrorCodes),
        lastUpdatedByEmail: item.lastUpdatedByEmail,
        lastUpdatedByName: item.lastUpdatedByName,
        configVersion: item.configVersion,
        usedBy: item.usedBy ?? [],
    };
}

function editableToServer(server: EditableServer): McpServerModel {
    return {
        ...server.source,
        name: server.name.trim(),
        type: "mcp",
        url: server.url,
        headers: rowsToTextMap(server.headersRows),
        retryableErrorCodes: textToErrorCodes(server.retryableErrorCodesText),
        doc: server.doc ?? "",
    };
}

function getMcpNameValidationError(name: string): string | null {
    const trimmedName = name.trim();

    if (!trimmedName) {
        return "Server name is required";
    }

    if (trimmedName.length > MAX_LENGTHS.MCP_SERVER_NAME.max) {
        return `An MCP server name can be at most ${MAX_LENGTHS.MCP_SERVER_NAME.max} characters.`;
    }

    if (!matchesRule(MCP_SERVER_NAME, trimmedName)) {
        return uiText("validate.mcpNameChars");
    }

    return null;
}

export default function MCPConfigDetailModule() {
    function addServer() {
        const uiId = makeUiId("mcp");
        setServers((previous) => [
            {
                uiId,
                source: { name: "", type: "mcp", url: "" },
                name: "",
                url: "",
                headersRows: [{ ...makeKeyValueRow(), key: "Authorization" }],
                retryableErrorCodesText: "",
                error: undefined,
                usedBy: [],
                isNew: true,
            },
            ...previous,
        ]);
        setOpenServers((previous) => ({ ...previous, [uiId]: true }));
    }

    const payload = UI.useModulePayload<{ name?: string; isNew?: boolean }>();
    const fh = useFieldHelp("McpServerModel");
    const ft = useFieldTitle("McpServerModel");
    const dynamic = useDynamicFields("McpServerModel");
    const [loading, setLoading] = useState(true);
    const [, setError] = useState<string | null>(null);
    const [collectionConfigVersion, setCollectionConfigVersion] = useState<number>(0);
    const [servers, setServers] = useState<EditableServer[]>([]);
    const [openServers, setOpenServers] = useState<Record<string, boolean>>({});
    const [deleteTarget, setDeleteTarget] = useState<{
        index: number;
        name: string;
    } | null>(null);

    const loadServers = useCallback(async (keepOpenNames?: Set<string>) => {
        try {
            setLoading(true);
            const response = await API.getAgentConfigPart({ part: "mcp" });

            if (!response.success) {
                const message = response.error?.message || "Failed to load MCP servers";
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
            const nextServers = configParts.map(serverToEditable);
            setServers(nextServers);
            setOpenServers(reopenByName(nextServers, keepOpenNames));
            setError(null);
        } catch (e) {
            const message = errorText(e, "Failed to load MCP servers");
            toast.error(message);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadServers();
    }, [loadServers]);

    function openAgentView(agentName: string) {
        UI.openSubModule("AgentView", {
            agentName,
        });
    }

    function removeLocalServer(index: number) {
        const uiId = servers[index]?.uiId;
        if (uiId) {
            setOpenServers((previous) => {
                const next = { ...previous };
                delete next[uiId];
                return next;
            });
        }
        setServers((previous) => previous.filter((_, i) => i !== index));
    }

    function updateServerField<K extends keyof EditableServer>(
        index: number,
        field: K,
        value: EditableServer[K],
    ) {
        setServers((previous) =>
            previous.map((server, i) => (i === index ? { ...server, [field]: value } : server)),
        );
    }

    async function handleUpsert(index: number): Promise<boolean> {
        const server = servers[index];
        if (!server) return false;

        const nameValidationError = getMcpNameValidationError(server.name);
        if (nameValidationError) {
            toast.error(nameValidationError);
            return false;
        }

        const text = textFieldsError(EXPR_TEXT, [
            { label: "The URL", value: server.url },
            ...rowValueFields(server.headersRows, "Header"),
        ]);
        if (text) {
            toast.error(text);
            return false;
        }

        try {
            updateServerField(index, "isSaving", true);
            const response = await API.upsertAgentConfigPart({
                configValue: editableToServer(server),
                configVersion: server.configVersion ?? collectionConfigVersion ?? 0,
            });

            if (!response.success) {
                toast.error(response.error?.message || "Failed to save MCP server");
                return false;
            }

            toast.success("MCP server saved");
            await loadServers(openNameSet(servers, openServers));
            if (server.isNew) {
                UI.updatePayload({ name: server.name.trim(), isNew: false });
            }
            return true;
        } catch (e) {
            toast.error(errorText(e, "Failed to save MCP server"));
            return false;
        } finally {
            updateServerField(index, "isSaving", false);
        }
    }

    async function handleConfirmDelete() {
        if (!deleteTarget) return;
        await handleDelete(deleteTarget.index);
        setDeleteTarget(null);
        releaseGuard();
        UI.goBack("MCPConfig");
    }

    async function handleDelete(index: number) {
        const server = servers[index];
        if (!server) return;

        if (server.isNew || !server.name.trim()) {
            removeLocalServer(index);
            return;
        }

        try {
            updateServerField(index, "isDeleting", true);
            const response = await API.deleteAgentConfigPart({
                part: "mcp",
                name: server.name.trim(),
                configVersion: server.configVersion ?? collectionConfigVersion ?? 0,
            });

            if (!response.success) {
                toast.error(response.error?.message || "Failed to delete MCP server");
                return;
            }

            toast.success("MCP server deleted");
            await loadServers(openNameSet(servers, openServers));
        } catch (e) {
            toast.error(errorText(e, "Failed to delete MCP server"));
        } finally {
            updateServerField(index, "isDeleting", false);
        }
    }

    useEffect(() => {
        if (loading || !payload?.isNew) return;
        if (servers.some((x) => x.isNew)) return;
        addServer();
    }, [loading, payload?.isNew, servers]);

    const index = payload?.name
        ? servers.findIndex((p) => (p.name ?? "") === payload.name)
        : servers.findIndex((p) => p.isNew);
    const server = index >= 0 ? servers[index] : undefined;

    const snapshotOf = (p: (typeof servers)[number]) =>
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
    const collRef = useRef(servers);
    collRef.current = servers;
    const key = server ? `${server.uiId}:${index}` : "";
    const lastKeyRef = useRef("");
    if (server && key !== lastKeyRef.current) {
        lastKeyRef.current = key;
        savedSnapshotRef.current = server.isNew ? null : snapshotOf(server);
    }
    const dirty =
        !!server &&
        (savedSnapshotRef.current === null || snapshotOf(server) !== savedSnapshotRef.current);

    const { dialog: unsavedDialog, release: releaseGuard } = useUnsavedChanges({
        what: "server",
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
                    <ModuleCardTitle title="MCP server" help="mcp-server-detail" />
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
            </Card>
        );
    }

    if (!server) {
        return (
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <ModuleCardTitle title="MCP server" help="mcp-server-detail" />
                    <BackButton fallback="MCPConfig" />
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    That server no longer exists.
                </CardContent>
            </Card>
        );
    }

    const isUsed = server.usedBy.length > 0;

    return (
        <>
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                        <ModuleCardTitle
                            title={server.name || "New mcp server"}
                            help="mcp-server-detail"
                        />
                        {server.isNew ? (
                            <div className="space-y-1 pt-1">
                                <HoverTip tip={uiText("validate.mcpNameChars")}>
                                    <Input
                                        autoFocus
                                        value={server.name}
                                        onChange={(e) =>
                                            updateServerField(index, "name", e.target.value)
                                        }
                                        placeholder="Server name"
                                        maxLength={MAX_LENGTHS.MCP_SERVER_NAME.max}
                                        className="h-8 w-full max-w-sm"
                                    />
                                </HoverTip>
                            </div>
                        ) : null}
                        {isUsed ? (
                            <UsedByAgents names={server.usedBy} onOpen={openAgentView} />
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                        <BackButton fallback="MCPConfig" />
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="space-y-4 px-6 pb-4">
                        <div className="grid gap-2">
                            <FieldLabel help={fh("url")} htmlFor={`url-${index}`}>
                                Server URL
                            </FieldLabel>
                            <HoverTip tip={dynamic.field("url") ? dynamicFieldTitle() : undefined}>
                                <WrappingInput
                                    id={`url-${index}`}
                                    value={server.url}
                                    onValueChange={(value) =>
                                        updateServerField(index, "url", value)
                                    }
                                    placeholder="https://mcp.example.com"
                                    className={
                                        dynamic.field("url") ? DYNAMIC_FIELD_INPUT_CLASS : undefined
                                    }
                                    disabled={server.isSaving || server.isDeleting}
                                />
                            </HoverTip>
                        </div>

                        <div className="grid gap-2">
                            <FieldLabel
                                help={fh("retryableErrorCodes")}
                                htmlFor={`retry-codes-${index}`}
                            >
                                Retryable error codes
                            </FieldLabel>
                            <Input
                                id={`retry-codes-${index}`}
                                value={server.retryableErrorCodesText}
                                onChange={(e) =>
                                    updateServerField(
                                        index,
                                        "retryableErrorCodesText",
                                        e.target.value,
                                    )
                                }
                                placeholder="-32602, -32700"
                                disabled={server.isSaving || server.isDeleting}
                            />
                        </div>

                        <Separator />

                        <KeyValueRows
                            idPrefix={`mcp-headers-${index}`}
                            label={ft("headers", "Server headers")}
                            help={fh("headers")}
                            rows={server.headersRows}
                            onChange={(rows) => updateServerField(index, "headersRows", rows)}
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
                            disabled={server.isSaving || server.isDeleting}
                        />

                        <ProfileDoc
                            id={`mcp-doc-${index}`}
                            value={server.doc ?? ""}
                            help={fh("doc")}
                            disabled={server.isSaving || server.isDeleting}
                            onChange={(v) => updateServerField(index, "doc", v)}
                        />
                    </div>
                </CardContent>

                <ActionBar
                    onUpdate={() => void handleUpsert(index)}
                    dirty={dirty}
                    busy={!!server.isSaving}
                    disabled={!!server.isDeleting}
                    start={
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget({ index, name: server.name ?? "" })}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                            <span className="order-last basis-full text-xs text-muted-foreground sm:order-none sm:basis-auto">
                                {isUsed
                                    ? uiText("delete.mcpInUse")
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
                        <AlertDialogTitle>Delete server</AlertDialogTitle>
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
