import { useState, useEffect, useRef } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import {
    AgentServerRoute,
    type AgentServerModel,
    type AgentServerModelLogs,
    type AgentServerModelUiConfig,
    type AgentServerModels,
    type AgentServerModelsServers,
    type ConfigPartResponseModel,
} from "@/orval/search2o.schemas";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AGENT_SERVER_ROUTES, routeHelp, routesMissingForUi } from "@/shared/agentServerRoutes";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import { UiConfigHelp } from "@/shared/UiConfigHelp";
import { ApiConnectionPoolFields } from "@/shared/ApiConnectionPoolFields";
import {
    connectionToFields,
    fieldsToConnection,
    type ConnectionFields,
} from "@/shared/apiConnectionPool";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useUnsavedWork } from "@/shared/sessionExpiry";
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { ActionBar } from "@/shared/ActionBar";
import { useSavedBaseline } from "@/shared/savedBaseline";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { UpdatedBy } from "@/shared/UpdatedBy";
import { uiText } from "@/shared/uiText";

const DEFAULT_SERVER = "default";

type ServerForm = {
    id: string;
    name: string;
    isDefault: boolean;
    model: AgentServerModel;
    logsText: string;
    uiConfigText: string;
    cloudPool: ConnectionFields;
};

const UI_CONFIG_PLACEHOLDER = JSON.stringify(
    {
        apiTimeoutSeconds: 90,
        toastDurationSeconds: 10,
        search: { tag: "", searchBehavior: "executeTopMatch", followupBehavior: "executeTopMatch" },
    },
    null,
    2,
);

function parseJsonObject(
    text: string,
    what: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
    const trimmed = text.trim();
    if (!trimmed) return { ok: true, value: {} };
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        return { ok: false, error: `${what} must be valid JSON.` };
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: `${what} must be a JSON object.` };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
}

function toForm(id: string, name: string, m: AgentServerModel, isDefault: boolean): ServerForm {
    return {
        id,
        name,
        isDefault,
        model: {
            ...m,
            uiPath: m.uiPath ?? "./ui",
            connectPageUrl: m.connectPageUrl ?? "",
            allowCrossOrigin: m.allowCrossOrigin ?? [],
            docsUrl: m.docsUrl ?? "/docs",
            redocUrl: m.redocUrl ?? "/redoc",
            openapiUrl: m.openapiUrl ?? "/openapi.json",
        },
        logsText: JSON.stringify(m.logs ?? {}, null, 2),
        uiConfigText:
            m.uiConfig && Object.keys(m.uiConfig).length > 0
                ? JSON.stringify(m.uiConfig, null, 2)
                : "",
        cloudPool: connectionToFields(m.cloudPool),
    };
}

function RoutesField(props: {
    idPrefix: string;
    routes: AgentServerRoute[] | null | undefined;
    servesUi: boolean;
    label: string;
    help: string | undefined;
    disabled: boolean;
    onChange: (routes: AgentServerRoute[] | null) => void;
}) {
    const { idPrefix, routes, servesUi, label, help, disabled, onChange } = props;
    const only = routes != null;
    const missing = routesMissingForUi(routes);

    const toggle = (route: AgentServerRoute, on: boolean) => {
        const next = AGENT_SERVER_ROUTES.filter((r) =>
            r === route ? on : (routes ?? []).includes(r),
        );
        onChange(next.length > 0 ? next : null);
    };

    return (
        <div className="space-y-3">
            <FieldLabel help={help} className="w-fit">
                {label}
            </FieldLabel>
            <RadioGroup
                value={only ? "only" : "every"}
                onValueChange={(v) => onChange(v === "only" ? [...AGENT_SERVER_ROUTES] : null)}
                disabled={disabled}
                className="flex flex-wrap gap-6"
            >
                <div className="flex items-center gap-2">
                    <RadioGroupItem id={`${idPrefix}-routes-every`} value="every" />
                    <Label htmlFor={`${idPrefix}-routes-every`}>
                        {uiText("servers.routesEvery")}
                    </Label>
                </div>
                <div className="flex items-center gap-2">
                    <RadioGroupItem id={`${idPrefix}-routes-only`} value="only" />
                    <Label htmlFor={`${idPrefix}-routes-only`}>
                        {uiText("servers.routesOnly")}
                    </Label>
                </div>
            </RadioGroup>

            {only ? (
                <div className="grid gap-x-6 gap-y-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
                    {AGENT_SERVER_ROUTES.map((route) => {
                        const id = `${idPrefix}-route-${route}`;
                        return (
                            <div key={route} className="flex items-center gap-2">
                                <Checkbox
                                    id={id}
                                    checked={routes.includes(route)}
                                    onCheckedChange={(c) => toggle(route, c === true)}
                                    disabled={disabled}
                                />
                                <HoverTip tip={routeHelp(route)}>
                                    <Label htmlFor={id} className="w-fit font-mono">
                                        {route}
                                    </Label>
                                </HoverTip>
                            </div>
                        );
                    })}
                </div>
            ) : null}

            {servesUi && missing.length > 0 ? (
                <p role="note" className="text-sm text-amber-700 dark:text-amber-400">
                    {uiText("servers.routesUiNeeds")}
                </p>
            ) : null}
        </div>
    );
}

function ServerEditor(props: {
    server: ServerForm;
    open: boolean;
    disabled: boolean;
    onToggle: (open: boolean) => void;
    patch: (patch: Partial<ServerForm>) => void;
    patchModel: (patch: Partial<AgentServerModel>) => void;
    onCopy: () => void;
    onDelete: () => void;
}) {
    const fh = useFieldHelp("AgentServerModel");
    const ft = useFieldTitle("AgentServerModel");
    const { server, open, disabled, onToggle, patch, patchModel, onCopy, onDelete } = props;
    const isDefault = server.isDefault;
    const idPrefix = server.id;
    const model = server.model;

    return (
        <Collapsible open={open} onOpenChange={onToggle} className="rounded-2xl border bg-card">
            <div className="flex items-start justify-between gap-4 p-4">
                <CollapsibleTrigger asChild>
                    <button type="button" className="flex-1 min-w-0 text-left">
                        <div className="flex items-start gap-2 min-w-0">
                            <span className="mt-0.5 text-muted-foreground">
                                {open ? (
                                    <ChevronDown className="h-4 w-4" />
                                ) : (
                                    <ChevronRight className="h-4 w-4" />
                                )}
                            </span>
                            <div className="min-w-0">
                                <div className="font-medium truncate">
                                    {server.name.trim() || "(unnamed server)"}
                                    {isDefault ? (
                                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
                                            default
                                        </span>
                                    ) : null}
                                </div>
                                <div className="text-xs text-muted-foreground leading-relaxed">
                                    Agent server configuration.
                                </div>
                            </div>
                        </div>
                    </button>
                </CollapsibleTrigger>
                <div className="flex items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCopy();
                                }}
                                disabled={disabled}
                                aria-label={`Copy ${server.name}`}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy into a new configuration</TooltipContent>
                    </Tooltip>

                    {isDefault ? null : (
                        <HoverTip tip="Delete this server configuration">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                disabled={disabled}
                                aria-label={`Delete ${server.name}`}
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </HoverTip>
                    )}
                </div>
            </div>

            <CollapsibleContent>
                <div className="space-y-6 px-4 pb-4">
                    <div className="space-y-2">
                        <HoverTip
                            tip={
                                isDefault
                                    ? uiText("help.defaultServerConfig")
                                    : `To use this configuration, start the agent server with a license key ending in /${server.name.trim() || "<name>"}. A key with no suffix uses the default configuration.`
                            }
                        >
                            <Label htmlFor={`${idPrefix}-name`} className="w-fit">
                                Configuration name
                            </Label>
                        </HoverTip>
                        <Input
                            id={`${idPrefix}-name`}
                            value={server.name}
                            onChange={(e) => patch({ name: e.target.value })}
                            disabled={disabled || isDefault}
                            readOnly={isDefault}
                        />
                    </div>

                    <RoutesField
                        idPrefix={idPrefix}
                        routes={model.routes}
                        servesUi={Boolean(model.uiPath?.trim())}
                        label={ft("routes", "Routes")}
                        help={fh("routes")}
                        disabled={disabled}
                        onChange={(routes) => patchModel({ routes })}
                    />

                    <div className="space-y-2">
                        <FieldLabel help={fh("uiPath")} htmlFor={`${idPrefix}-uiPath`}>
                            UI mount paths
                        </FieldLabel>
                        <Input
                            id={`${idPrefix}-uiPath`}
                            value={model.uiPath ?? "./ui"}
                            onChange={(e) => patchModel({ uiPath: e.target.value })}
                            placeholder="./ui"
                            disabled={disabled}
                        />
                    </div>

                    <div className="space-y-2">
                        <FieldLabel
                            help={fh("connectPageUrl")}
                            htmlFor={`${idPrefix}-connectPageUrl`}
                        >
                            Connect page URL
                        </FieldLabel>
                        <Input
                            id={`${idPrefix}-connectPageUrl`}
                            value={model.connectPageUrl ?? ""}
                            onChange={(e) => patchModel({ connectPageUrl: e.target.value })}
                            placeholder={uiText("placeholder.bundledUi")}
                            disabled={disabled}
                        />
                    </div>

                    <div className="space-y-2">
                        <FieldLabel
                            help={fh("allowCrossOrigin")}
                            htmlFor={`${idPrefix}-allowCrossOrigin`}
                        >
                            Allowed cross-origin URLs (CORS)
                        </FieldLabel>
                        <Textarea
                            id={`${idPrefix}-allowCrossOrigin`}
                            placeholder={"e.g. https://ui.example.com"}
                            value={(model.allowCrossOrigin ?? []).join("\n")}
                            onChange={(e) => {
                                const lines = e.target.value
                                    .split("\n")
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                patchModel({ allowCrossOrigin: lines });
                            }}
                            className="min-h-[80px]"
                            disabled={disabled}
                        />
                    </div>

                    <div className="space-y-2">
                        <FieldLabel help={fh("docsUrl")} htmlFor={`${idPrefix}-docsUrl`}>
                            Docs URL
                        </FieldLabel>
                        <Input
                            id={`${idPrefix}-docsUrl`}
                            value={model.docsUrl ?? ""}
                            onChange={(e) => patchModel({ docsUrl: e.target.value || null })}
                            placeholder="/docs"
                            disabled={disabled}
                        />
                    </div>

                    <div className="space-y-2">
                        <FieldLabel help={fh("redocUrl")} htmlFor={`${idPrefix}-redocUrl`}>
                            ReDoc URL
                        </FieldLabel>
                        <Input
                            id={`${idPrefix}-redocUrl`}
                            value={model.redocUrl ?? ""}
                            onChange={(e) => patchModel({ redocUrl: e.target.value || null })}
                            placeholder="/redoc"
                            disabled={disabled}
                        />
                    </div>

                    <div className="space-y-2">
                        <FieldLabel help={fh("openapiUrl")} htmlFor={`${idPrefix}-openapiUrl`}>
                            OpenAPI URL
                        </FieldLabel>
                        <Input
                            id={`${idPrefix}-openapiUrl`}
                            value={model.openapiUrl ?? ""}
                            onChange={(e) => patchModel({ openapiUrl: e.target.value || null })}
                            placeholder="/openapi.json"
                            disabled={disabled}
                        />
                    </div>

                    <div className="space-y-2">
                        <FieldLabel help={fh("logs")} htmlFor={`${idPrefix}-logs`}>
                            Logging
                        </FieldLabel>
                        <Textarea
                            id={`${idPrefix}-logs`}
                            value={server.logsText}
                            onChange={(e) => patch({ logsText: e.target.value })}
                            className="min-h-64"
                            disabled={disabled}
                        />
                    </div>

                    <div className="space-y-2">
                        <FieldLabel
                            help={<UiConfigHelp />}
                            helpSide="right"
                            className="w-fit"
                            helpClassName="max-w-2xl max-h-(--radix-tooltip-content-available-height) overflow-y-auto"
                            htmlFor={`${idPrefix}-uiConfig`}
                        >
                            {ft("uiConfig", "UI configuration")}
                        </FieldLabel>
                        <Textarea
                            id={`${idPrefix}-uiConfig`}
                            value={server.uiConfigText}
                            onChange={(e) => patch({ uiConfigText: e.target.value })}
                            className="min-h-64"
                            placeholder={UI_CONFIG_PLACEHOLDER}
                            disabled={disabled}
                        />
                    </div>

                    <div className="space-y-4 rounded-xl border p-4">
                        <FieldLabel help={fh("cloudPool")} className="w-fit text-sm font-medium">
                            {ft("cloudPool", "Cloud connection pool")}
                        </FieldLabel>
                        <ApiConnectionPoolFields
                            idPrefix={`${idPrefix}-cloudPool`}
                            fields={server.cloudPool}
                            onChange={(changes) =>
                                patch({ cloudPool: { ...server.cloudPool, ...changes } })
                            }
                            disabled={disabled}
                        />
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

export default function AgentServerConfigModule() {
    const [res, setRes] = useState<ConfigPartResponseModel | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [version, setVersion] = useState<number>(0);
    const [servers, setServers] = useState<ServerForm[]>([]);
    const [openServers, setOpenServers] = useState<Record<string, boolean>>({});
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const idCounter = useRef(0);
    const nextId = () => `srv-${idCounter.current++}`;

    const { dirty, markSaved } = useSavedBaseline(servers);
    useUnsavedWork(() => dirty);

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            try {
                const resp = await API.getSystemConfigPart({ part: "servers" });

                if (!resp.success) {
                    toast.error(
                        resp.error?.message || "Failed to load the agent server configuration",
                    );
                    return;
                }
                if (!mounted) return;
                setRes(resp);
                setVersion(resp.configVersion);

                const models = resp.configValue as AgentServerModels;
                const entries = Object.entries(models.servers ?? {});
                entries.sort(([a], [b]) => {
                    if (a === DEFAULT_SERVER) return -1;
                    if (b === DEFAULT_SERVER) return 1;
                    return 0;
                });

                const forms = entries.map(([name, m]) =>
                    toForm(nextId(), name, m, name === DEFAULT_SERVER),
                );
                setServers(forms);
                markSaved(forms);
                setOpenServers({});
            } catch (_err) {
                toast.error("Failed to load the agent server configuration");
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [markSaved]);

    const patchServer = (id: string, patch: Partial<ServerForm>) =>
        setServers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

    const patchServerModel = (id: string, patch: Partial<AgentServerModel>) =>
        setServers((prev) =>
            prev.map((s) => (s.id === id ? { ...s, model: { ...s.model, ...patch } } : s)),
        );

    const uniqueName = (base: string) => {
        const existing = new Set(servers.map((s) => s.name));
        if (!existing.has(base)) return base;
        let i = 2;
        while (existing.has(`${base}-${i}`)) i++;
        return `${base}-${i}`;
    };

    const addServer = () => {
        const existing = new Set(servers.map((s) => s.name));
        let i = 1;
        while (existing.has(`server-${i}`)) i++;
        const form = toForm(nextId(), `server-${i}`, {}, false);
        setServers((prev) => [...prev, form]);
        setOpenServers((prev) => ({ ...prev, [form.id]: true }));
    };

    const copyServer = (id: string) => {
        const source = servers.find((s) => s.id === id);
        if (!source) return;
        const clone: ServerForm = {
            ...source,
            id: nextId(),
            isDefault: false,
            name: uniqueName(`${source.name.trim() || "server"}-copy`),
            model: { ...source.model },
            cloudPool: { ...source.cloudPool },
        };
        setServers((prev) => [...prev, clone]);
        setOpenServers((prev) => ({ ...prev, [clone.id]: true }));
    };

    const deleteServer = (id: string) => setServers((prev) => prev.filter((s) => s.id !== id));

    const onSave = async () => {
        if (servers.length === 0) return;

        const names = servers.map((s) => s.name.trim());
        if (names.some((n) => !n)) {
            toast.error(uiText("validate.serverNameRequired"));
            return;
        }
        const dupes = names.filter((n, idx) => names.indexOf(n) !== idx);
        if (dupes.length) {
            toast.error(`Duplicate server configuration name: "${dupes[0]}".`);
            return;
        }
        if (!names.includes(DEFAULT_SERVER)) {
            toast.error(`A "${DEFAULT_SERVER}" server configuration is required.`);
            return;
        }

        const serversObj: AgentServerModelsServers = {};
        for (const s of servers) {
            const logs = parseJsonObject(s.logsText, `Logs for "${s.name.trim()}"`);
            if (!logs.ok) {
                toast.error(logs.error);
                return;
            }
            const uiConfig = parseJsonObject(
                s.uiConfigText,
                `The UI configuration for "${s.name.trim()}"`,
            );
            if (!uiConfig.ok) {
                toast.error(uiConfig.error);
                return;
            }

            const pool = fieldsToConnection(s.cloudPool, s.model.cloudPool ?? {});
            if (!pool.ok) {
                toast.error(
                    `${pool.badField} for the cloud pool of "${s.name.trim()}" must be 0 or more.`,
                );
                return;
            }

            serversObj[s.name.trim()] = {
                ...s.model,
                logs: logs.value as AgentServerModelLogs,
                uiConfig: uiConfig.value as AgentServerModelUiConfig,
                cloudPool: pool.pool,
            };
        }

        setSaving(true);
        try {
            const value: AgentServerModels = {
                type: "servers",
                servers: serversObj,
            };

            const resp = await API.updateSystemConfigPart({
                configValue: value,
                configVersion: version,
            });

            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to update agent server configuration");
                return;
            }

            toast.success(uiText("config.serversUpdated"));
            setVersion(resp.configVersion);
            markSaved(servers);
        } catch (_e) {
            toast.error("Failed to update the agent server configuration");
        } finally {
            setSaving(false);
        }
    };

    const disabled = loading || saving;
    const deleteTarget = servers.find((s) => s.id === deleteTargetId) ?? null;

    return (
        <TooltipProvider>
            <Card className="w-full mx-auto shadow-sm">
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                            <ModuleCardTitle title="Agent server configuration" />
                            <UpdatedBy obj={res} />
                        </div>
                        <Button
                            type="button"
                            onClick={addServer}
                            className="gap-2"
                            variant="outline"
                            disabled={disabled}
                        >
                            <Plus className="h-4 w-4" />
                            Add server configuration
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loading ? (
                        <div className="text-sm text-muted-foreground">
                            Loading agent server settings…
                        </div>
                    ) : servers.length === 0 ? (
                        <div className="text-sm text-destructive">
                            Unable to load configuration.
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground">
                                Each configuration below is selected by the license key the agent
                                server starts with. A license key with no suffix uses{" "}
                                <code>default</code>; a key ending in <code>/&lt;name&gt;</code>{" "}
                                uses the matching configuration.
                            </p>

                            {servers.map((s) => (
                                <ServerEditor
                                    key={s.id}
                                    server={s}
                                    open={openServers[s.id] ?? false}
                                    disabled={disabled}
                                    onToggle={(open) =>
                                        setOpenServers((prev) => ({ ...prev, [s.id]: open }))
                                    }
                                    patch={(patch) => patchServer(s.id, patch)}
                                    patchModel={(patch) => patchServerModel(s.id, patch)}
                                    onCopy={() => copyServer(s.id)}
                                    onDelete={() => setDeleteTargetId(s.id)}
                                />
                            ))}
                        </>
                    )}
                </CardContent>
                <ActionBar
                    onUpdate={onSave}
                    dirty={dirty}
                    busy={saving}
                    disabled={loading || servers.length === 0}
                />
            </Card>

            <AlertDialog
                open={deleteTargetId !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTargetId(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete server configuration</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete{" "}
                            <span className="font-semibold">
                                {deleteTarget?.name.trim() || "this configuration"}
                            </span>
                            ? The change takes effect when you click Update.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                const id = deleteTargetId;
                                setDeleteTargetId(null);
                                if (id) deleteServer(id);
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </TooltipProvider>
    );
}
