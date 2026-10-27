import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import type { AgentConfigPartRowModel, LlmModel, DynamicDict } from "@/orval/search2o.schemas";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Trash2, Info } from "lucide-react";
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
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import { KeyValueRows } from "@/shared/KeyValueRows";
import {
    rowsFromTextMap,
    rowsSnapshot,
    rowsToTextMap,
    rowValueFields,
    type KeyValueRow,
} from "@/shared/keyValueMap";
import {
    PRICE_FIELDS,
    pricingToText,
    textToPricing,
    type PriceField,
    type PriceText,
} from "@/shared/llmPricing";
import { ConnectionPoolNameField } from "@/shared/apiConnectionPools";
import { DEFAULT_POOL_NAME } from "@/shared/apiConnectionPoolNames";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import { EXPR_TEXT, MAX_LENGTHS, textFieldsError } from "@/shared/schemaRules";

type EditableLlmModel = Partial<Omit<LlmModel, "name">>;

type EditableProfile = {
    uiId: string;
    name: string;
    model: EditableLlmModel;
    additionalParamsText: string;
    headersRows: KeyValueRow[];
    queryParamRows: KeyValueRow[];
    priceText: PriceText;
    jsonError: string | null;
    usedBy: string[];
    isNew?: boolean;
    isSaving?: boolean;
    isDeleting?: boolean;
    configVersion?: number;
    lastUpdatedByEmail?: string | null;
    lastUpdatedByName?: string | null;
};

const DEFAULT_ADDITIONAL_PARAMS_TEXT = `{
  "temperature": 0.2,
  "top_p": 0.9
}`;

function safePrettyJson(value: unknown) {
    if (value == null) return DEFAULT_ADDITIONAL_PARAMS_TEXT;

    if (typeof value === "string") {
        const s = value.trim();
        if (!s) return DEFAULT_ADDITIONAL_PARAMS_TEXT;
        try {
            const parsed = JSON.parse(s);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return JSON.stringify(parsed, null, 2);
            }
        } catch {}
        return s;
    }

    try {
        if (typeof value === "object" && value && !Array.isArray(value)) {
            return JSON.stringify(value, null, 2);
        }
        return DEFAULT_ADDITIONAL_PARAMS_TEXT;
    } catch {
        return DEFAULT_ADDITIONAL_PARAMS_TEXT;
    }
}

function parseJsonObject(
    text: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
    const trimmed = text.trim();
    if (!trimmed) return { ok: true, value: {} };

    try {
        const parsed = JSON.parse(trimmed);
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
            return { ok: false, error: 'additionalParams must be a JSON object (e.g. {"k":"v"}).' };
        }
        return { ok: true, value: parsed as Record<string, unknown> };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON." };
    }
}

function editableFromItem(item: AgentConfigPartRowModel): EditableProfile {
    const model = item.configValue as LlmModel;
    const additionalParamsText = safePrettyJson(model.additionalParams ?? {});
    const parsed = parseJsonObject(additionalParamsText);

    return {
        uiId: makeUiId(model.name),
        name: model.name,
        model: {
            ...model,
        },
        additionalParamsText,
        headersRows: rowsFromTextMap(model.headers),
        queryParamRows: rowsFromTextMap(model.queryParams),
        priceText: pricingToText(model.pricing),
        jsonError: parsed.ok ? null : parsed.error,
        usedBy: item.usedBy ?? [],
        configVersion: item.configVersion,
        lastUpdatedByEmail: item.lastUpdatedByEmail,
        lastUpdatedByName: item.lastUpdatedByName,
    };
}

function makeNewProfile(): EditableProfile {
    return {
        uiId: makeUiId("llm"),
        name: "",
        model: {
            adapter: undefined,
            url: undefined,
            maxTokens: undefined,
            maxTools: undefined,
            additionalParams: undefined,
            headers: undefined,
            queryParams: undefined,
            model: "",
            pricing: undefined,
            retries: undefined,
            connectionPoolName: DEFAULT_POOL_NAME,
        },
        additionalParamsText: DEFAULT_ADDITIONAL_PARAMS_TEXT,
        headersRows: [],
        queryParamRows: [],
        priceText: pricingToText(undefined),
        jsonError: null,
        usedBy: [],
        isNew: true,
    };
}

export default function LlmProfileDetailModule() {
    const payload = UI.useModulePayload<{ name?: string; isNew?: boolean }>();
    const fh = useFieldHelp("LlmModel", "ApiConnectionPoolModel", "TimeoutModel");
    const ft = useFieldTitle("LlmModel");
    const dynamic = useDynamicFields("LlmModel");
    const [booting, setBooting] = useState(true);
    const [profiles, setProfiles] = useState<EditableProfile[]>([]);
    const profilesRef = useRef<EditableProfile[]>([]);
    profilesRef.current = profiles;
    const [collectionConfigVersion, setCollectionConfigVersion] = useState<number>(0);
    const [deleteTargetUiId, setDeleteTargetUiId] = useState<string | null>(null);
    const [showAllUsedBy, setShowAllUsedBy] = useState(false);

    const savedSnapshotRef = useRef<string | null>(null);
    const snapshotOf = (p: EditableProfile) =>
        JSON.stringify({
            name: p.name,
            model: p.model,
            additionalParamsText: p.additionalParamsText,
            headersRows: rowsSnapshot(p.headersRows),
            queryParamRows: rowsSnapshot(p.queryParamRows),
            priceText: PRICE_FIELDS.map((f) => p.priceText[f.key]),
        });
    const [adapters, setAdapters] = useState<Record<string, string>>({});
    const [adaptersLoaded, setAdaptersLoaded] = useState(false);
    const [openByUiId, setOpenByUiId] = useState<Record<string, boolean>>({});

    const adapterEntries = useMemo(
        () => Object.entries(adapters ?? {}).sort(([a], [b]) => a.localeCompare(b)),
        [adapters],
    );

    const loadProfiles = useCallback(async (keepOpenNames?: Set<string>) => {
        try {
            setBooting(true);
            const resp = await API.getAgentConfigPart({ part: "llm" });
            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to load LLM profiles");
                return;
            }

            const items = resp.configParts ?? [];
            const maxVersion = items.reduce(
                (max, item) => Math.max(max, Number(item?.configVersion ?? 0)),
                0,
            );

            setCollectionConfigVersion(maxVersion);
            const nextProfiles = items
                .map(editableFromItem)
                .sort((a, b) => a.name.localeCompare(b.name));
            setProfiles(nextProfiles);
            setOpenByUiId(reopenByName(nextProfiles, keepOpenNames));

            const adaptersResp = await API.getLlmAdapters({});
            if (!adaptersResp.success) {
                toast.error(adaptersResp.error?.message || "Failed to load LLM adapters");
            } else {
                setAdapters(adaptersResp.adapters ?? {});
                setAdaptersLoaded(true);
            }
        } catch {
            toast.error("Failed to load LLM profiles");
        } finally {
            setBooting(false);
        }
    }, []);

    useEffect(() => {
        void loadProfiles();
    }, [loadProfiles]);

    useEffect(() => {
        if (booting || !payload?.isNew) return;
        setProfiles((prev) => (prev.some((p) => p.isNew) ? prev : [...prev, makeNewProfile()]));
    }, [booting, payload?.isNew]);

    function removeLocalProfile(uiId: string) {
        setProfiles((previous) => previous.filter((profile) => profile.uiId !== uiId));
        setOpenByUiId((previous) => {
            const next = { ...previous };
            delete next[uiId];
            return next;
        });
    }

    function updateProfile(uiId: string, updater: (profile: EditableProfile) => EditableProfile) {
        setProfiles((previous) =>
            previous.map((profile) => (profile.uiId === uiId ? updater(profile) : profile)),
        );
    }

    function updateModel(uiId: string, patch: EditableLlmModel) {
        updateProfile(uiId, (profile) => ({
            ...profile,
            model: {
                ...profile.model,
                ...patch,
            },
        }));
    }

    type NumericField = keyof Pick<EditableLlmModel, "maxTokens" | "maxTools" | "retries">;

    function updateNumeric(uiId: string, field: NumericField, raw: string) {
        const trimmed = raw.trim();
        if (!trimmed) {
            updateModel(uiId, { [field]: undefined } as EditableLlmModel);
            return;
        }
        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isNaN(parsed)) return;
        updateModel(uiId, { [field]: parsed } as EditableLlmModel);
    }

    function setModelAdditionalParamsText(uiId: string, text: string) {
        updateProfile(uiId, (profile) => {
            const parsed = parseJsonObject(text);
            return {
                ...profile,
                additionalParamsText: text,
                jsonError: parsed.ok ? null : parsed.error,
            };
        });
    }

    function setRows(uiId: string, field: "headersRows" | "queryParamRows", rows: KeyValueRow[]) {
        updateProfile(uiId, (profile) => ({ ...profile, [field]: rows }));
    }

    function setPrice(uiId: string, field: PriceField, value: string) {
        updateProfile(uiId, (profile) => ({
            ...profile,
            priceText: { ...profile.priceText, [field]: value },
        }));
    }

    function openAgentView(agentName: string) {
        UI.openSubModule("AgentView", {
            agentName,
        });
    }

    function materializeProfile(profile: EditableProfile): LlmModel | null {
        const trimmedName = profile.name.trim();
        const trimmedAdapter = (profile.model.adapter ?? "").trim();
        const trimmedModel = (profile.model.model ?? "").trim();

        if (!trimmedName) {
            toast.error(uiText("validate.profileNameRequired"));
            return null;
        }
        if (!trimmedAdapter) {
            toast.error(`Please select an adapter for "${trimmedName}".`);
            return null;
        }
        if (!trimmedModel) {
            toast.error(`Please enter a model for "${trimmedName}".`);
            return null;
        }

        const text = textFieldsError(EXPR_TEXT, [
            { label: "The URL", value: (profile.model.url ?? "").trim() },
            ...rowValueFields(profile.headersRows, "Header"),
            ...rowValueFields(profile.queryParamRows, "Query parameter"),
        ]);
        if (text) {
            toast.error(text);
            return null;
        }

        const parsed = parseJsonObject(profile.additionalParamsText);
        if (!parsed.ok) {
            toast.error(`Fix additionalParams JSON for "${trimmedName}" before saving.`);
            return null;
        }

        const pricing = textToPricing(profile.priceText);
        if (!pricing.ok) {
            toast.error(pricing.error);
            return null;
        }

        return {
            ...profile.model,
            name: trimmedName,
            type: "llm",
            adapter: trimmedAdapter,
            url: (profile.model.url ?? "").trim() || undefined,
            model: trimmedModel,
            additionalParams: Object.keys(parsed.value).length
                ? (parsed.value as DynamicDict)
                : undefined,
            headers: rowsToTextMap(profile.headersRows),
            queryParams: rowsToTextMap(profile.queryParamRows),
            pricing: pricing.value,
        };
    }

    async function handleUpsert(uiId: string): Promise<boolean> {
        const profile = profiles.find((item) => item.uiId === uiId);
        if (!profile) return false;

        const payload = materializeProfile(profile);
        if (!payload) return false;

        try {
            updateProfile(uiId, (current) => ({ ...current, isSaving: true }));
            const response = await API.upsertAgentConfigPart({
                configValue: payload,
                configVersion: profile.configVersion ?? collectionConfigVersion ?? 0,
            });

            if (!response.success) {
                toast.error(response.error?.message || "Failed to save LLM profile");
                return false;
            }

            toast.success(`LLM profile saved. ${uiText("config.appliesToNewRuns")}`);
            await loadProfiles(openNameSet(profiles, openByUiId));
            if (profile.isNew) {
                UI.updatePayload({ name: profile.name.trim(), isNew: false });
            }
            return true;
        } catch (e) {
            toast.error(errorText(e, "Failed to save LLM profile"));
            return false;
        } finally {
            updateProfile(uiId, (current) => ({ ...current, isSaving: false }));
        }
    }

    async function handleDelete(uiId: string) {
        const profile = profiles.find((item) => item.uiId === uiId);
        if (!profile) return;

        if (profile.isNew || !profile.name.trim()) {
            removeLocalProfile(uiId);
            return;
        }

        try {
            updateProfile(uiId, (current) => ({ ...current, isDeleting: true }));
            const response = await API.deleteAgentConfigPart({
                part: "llm",
                name: profile.name.trim(),
                configVersion: profile.configVersion ?? collectionConfigVersion ?? 0,
            });

            if (!response.success) {
                toast.error(response.error?.message || "Failed to delete LLM profile");
                return;
            }

            toast.success("LLM profile deleted");
            await loadProfiles(openNameSet(profiles, openByUiId));
        } catch (e) {
            toast.error(errorText(e, "Failed to delete LLM profile"));
        } finally {
            updateProfile(uiId, (current) => ({ ...current, isDeleting: false }));
        }
    }

    const profile =
        profiles.find((p) => (payload?.name ? p.name === payload.name : p.isNew)) ?? profiles[0];

    const loadedKey = profile ? `${profile.uiId}:${profile.configVersion ?? ""}` : "";
    const lastKeyRef = useRef("");
    if (profile && loadedKey !== lastKeyRef.current) {
        lastKeyRef.current = loadedKey;
        savedSnapshotRef.current = profile.isNew ? null : snapshotOf(profile);
    }
    const dirty =
        !!profile &&
        (savedSnapshotRef.current === null || snapshotOf(profile) !== savedSnapshotRef.current);

    const { dialog: unsavedDialog, release: releaseGuard } = useUnsavedChanges({
        what: "profile",
        isDirty: () => {
            const current = profilesRef.current.find((p) => p.uiId === profile?.uiId);
            if (!current) return false;
            if (savedSnapshotRef.current === null) return true;
            return snapshotOf(current) !== savedSnapshotRef.current;
        },
        onSave: async () => (profile ? handleUpsert(profile.uiId) : false),
    });

    if (booting) {
        return (
            <Card className="w-full shadow-sm">
                <CardHeader>
                    <ModuleCardTitle title="LLM profile" help="llm-profile-detail" />
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
            </Card>
        );
    }

    if (!profile) {
        return (
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <ModuleCardTitle title="LLM profile" help="llm-profile-detail" />
                    <BackButton fallback="LlmProfile" />
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    That profile no longer exists.
                </CardContent>
            </Card>
        );
    }

    const model = profile.model;
    const disabled = !!profile.isSaving || !!profile.isDeleting;
    const deleteDisabled = disabled || profile.usedBy.length > 0;

    return (
        <TooltipProvider delayDuration={200}>
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                        <ModuleCardTitle
                            title={profile.name || "New LLM profile"}
                            help="llm-profile-detail"
                        />
                        <div className="text-xs text-muted-foreground">
                            {[model.adapter, model.model].filter(Boolean).join(" · ") ||
                                "No adapter selected"}
                        </div>
                        {profile.isNew ? (
                            <div className="space-y-1 pt-1">
                                <HoverTip tip={uiText("validate.profileNameChars")}>
                                    <Input
                                        autoFocus
                                        value={profile.name}
                                        onChange={(e) =>
                                            updateProfile(profile.uiId, (current) => ({
                                                ...current,
                                                name: e.target.value,
                                            }))
                                        }
                                        placeholder="Profile name"
                                        maxLength={MAX_LENGTHS.PROFILE_NAME.max}
                                        className="h-8 w-full max-w-sm"
                                    />
                                </HoverTip>
                            </div>
                        ) : null}
                        {profile.usedBy.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                                <span>
                                    Used by {profile.usedBy.length} agent
                                    {profile.usedBy.length === 1 ? "" : "s"}:
                                </span>
                                {(showAllUsedBy ? profile.usedBy : profile.usedBy.slice(0, 6)).map(
                                    (agentName) => (
                                        <button
                                            key={agentName}
                                            type="button"
                                            className="rounded border px-1.5 py-0.5 hover:bg-accent"
                                            onClick={() => openAgentView(agentName)}
                                        >
                                            {agentName}
                                        </button>
                                    ),
                                )}
                                {profile.usedBy.length > 6 ? (
                                    <button
                                        type="button"
                                        className="rounded px-1 py-0.5 hover:bg-accent hover:text-foreground"
                                        onClick={() => setShowAllUsedBy((v) => !v)}
                                    >
                                        {showAllUsedBy
                                            ? "Show fewer"
                                            : `+${profile.usedBy.length - 6} more`}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    <BackButton fallback="LlmProfile" />
                </CardHeader>

                <CardContent className="p-0">
                    <div className="space-y-6 px-6 py-4">
                        <div className="space-y-3">
                            <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                                Model &amp; server
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                <div className="space-y-1.5">
                                    <div className="relative">
                                        <FieldLabel
                                            help={fh("adapter")}
                                            className="leading-none pr-8"
                                        >
                                            Adapter
                                        </FieldLabel>
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground"
                                                        aria-label="List the LLM adapters defined in the system"
                                                    >
                                                        <Info className="h-4 w-4" aria-hidden />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[420px]">
                                                    <div className="space-y-2">
                                                        <div className="text-sm font-medium">
                                                            LLM adapters
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            List of LLM adapters defined in the
                                                            system. Refer to documentation on how to
                                                            add your own adapter.
                                                        </p>
                                                        <div className="max-h-56 overflow-auto rounded-md border p-2">
                                                            {adapterEntries.length === 0 ? (
                                                                <div className="text-sm text-muted-foreground">
                                                                    No adapters found.
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {adapterEntries.map(
                                                                        ([k, desc]) => (
                                                                            <div
                                                                                key={k}
                                                                                className="text-sm"
                                                                            >
                                                                                <div className="font-mono text-xs">
                                                                                    {k}
                                                                                </div>
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    {desc}
                                                                                </div>
                                                                            </div>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>

                                    <Select
                                        value={model.adapter ?? ""}
                                        onValueChange={(value) =>
                                            updateModel(profile.uiId, { adapter: value })
                                        }
                                        disabled={disabled}
                                    >
                                        <SelectTrigger className="w-full" aria-label="Adapter">
                                            <SelectValue placeholder="Select an adapter" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {adapterEntries.map(([k]) => (
                                                <SelectItem key={k} value={k}>
                                                    {k}
                                                </SelectItem>
                                            ))}
                                            {model.adapter && !(model.adapter in adapters) ? (
                                                <SelectItem value={model.adapter}>
                                                    {adaptersLoaded
                                                        ? `${model.adapter} (not available)`
                                                        : model.adapter}
                                                </SelectItem>
                                            ) : null}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <FieldLabel help={fh("model")}>Model</FieldLabel>
                                    <Input
                                        value={model.model ?? ""}
                                        onChange={(e) =>
                                            updateModel(profile.uiId, {
                                                model: e.target.value,
                                            })
                                        }
                                        placeholder={uiText("placeholder.mustBeSpecified")}
                                        disabled={disabled}
                                    />
                                </div>

                                <div className="space-y-1.5 md:col-span-full">
                                    <FieldLabel help={fh("url")}>
                                        {ft("url", "Server URL")}
                                    </FieldLabel>
                                    <HoverTip
                                        tip={dynamic.field("url") ? dynamicFieldTitle() : undefined}
                                    >
                                        <WrappingInput
                                            value={model.url ?? ""}
                                            onValueChange={(value) =>
                                                updateModel(profile.uiId, {
                                                    url: value,
                                                })
                                            }
                                            placeholder="https://api.example.com"
                                            className={
                                                dynamic.field("url")
                                                    ? DYNAMIC_FIELD_INPUT_CLASS
                                                    : undefined
                                            }
                                            disabled={disabled}
                                        />
                                    </HoverTip>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                                Request
                            </div>

                            <KeyValueRows
                                idPrefix={`llm-headers-${profile.uiId}`}
                                label={ft("headers", "HTTP headers")}
                                help={fh("headers")}
                                rows={profile.headersRows}
                                onChange={(rows) => setRows(profile.uiId, "headersRows", rows)}
                                addLabel="Add header"
                                emptyText="No headers are sent with every call."
                                keyHeading="Header"
                                valueHeading="Value"
                                keyPlaceholder="Header-Name"
                                valuePlaceholder={'e.g. { f"Bearer {secrets[key]}" }'}
                                valueTip={
                                    dynamic.entryValue("headers") ? dynamicFieldTitle() : undefined
                                }
                                valueClassName={
                                    dynamic.entryValue("headers")
                                        ? DYNAMIC_FIELD_INPUT_CLASS
                                        : undefined
                                }
                                disabled={disabled}
                            />

                            <KeyValueRows
                                idPrefix={`llm-params-${profile.uiId}`}
                                label={ft("queryParams", "Query parameters")}
                                help={fh("queryParams")}
                                rows={profile.queryParamRows}
                                onChange={(rows) => setRows(profile.uiId, "queryParamRows", rows)}
                                addLabel="Add query parameter"
                                emptyText="No query parameters are sent with every call."
                                keyHeading="Parameter"
                                valueHeading="Value"
                                keyPlaceholder="api_version"
                                valuePlaceholder="Parameter value"
                                valueTip={
                                    dynamic.entryValue("queryParams")
                                        ? dynamicFieldTitle()
                                        : undefined
                                }
                                valueClassName={
                                    dynamic.entryValue("queryParams")
                                        ? DYNAMIC_FIELD_INPUT_CLASS
                                        : undefined
                                }
                                disabled={disabled}
                            />

                            <div className="space-y-2">
                                <FieldLabel help={fh("additionalParams")}>
                                    {ft("additionalParams", "Additional parameters")}
                                </FieldLabel>

                                <HoverTip
                                    tip={
                                        dynamic.field("additionalParams")
                                            ? dynamicFieldTitle()
                                            : undefined
                                    }
                                >
                                    <Textarea
                                        value={profile.additionalParamsText}
                                        onChange={(e) =>
                                            setModelAdditionalParamsText(
                                                profile.uiId,
                                                e.target.value,
                                            )
                                        }
                                        rows={7}
                                        className={
                                            profile.jsonError
                                                ? "border-destructive focus-visible:ring-destructive/30"
                                                : dynamic.field("additionalParams")
                                                  ? DYNAMIC_FIELD_INPUT_CLASS
                                                  : ""
                                        }
                                        placeholder='{"temperature": 0.2, "top_p": 0.9}'
                                        disabled={disabled}
                                    />
                                </HoverTip>
                                {profile.jsonError ? (
                                    <p className="text-xs text-destructive">
                                        {profile.jsonError} Save is disabled until this is fixed.
                                    </p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        Valid JSON object.
                                    </p>
                                )}
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                                Limits &amp; retries
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                <div className="space-y-1.5">
                                    <FieldLabel help={fh("maxTokens")}>Max tokens</FieldLabel>
                                    <Input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={
                                            model.maxTokens == null || Number.isNaN(model.maxTokens)
                                                ? ""
                                                : String(model.maxTokens)
                                        }
                                        onChange={(e) =>
                                            updateNumeric(profile.uiId, "maxTokens", e.target.value)
                                        }
                                        placeholder={uiText("placeholder.optional")}
                                        disabled={disabled}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <FieldLabel help={fh("maxTools")}>Max tools</FieldLabel>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={
                                            model.maxTools == null || Number.isNaN(model.maxTools)
                                                ? ""
                                                : String(model.maxTools)
                                        }
                                        onChange={(e) =>
                                            updateNumeric(profile.uiId, "maxTools", e.target.value)
                                        }
                                        placeholder={uiText("placeholder.optional")}
                                        disabled={disabled}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <FieldLabel help={fh("retries")}>Retries</FieldLabel>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={
                                            model.retries == null || Number.isNaN(model.retries)
                                                ? ""
                                                : String(model.retries)
                                        }
                                        onChange={(e) =>
                                            updateNumeric(profile.uiId, "retries", e.target.value)
                                        }
                                        placeholder={uiText("placeholder.optional")}
                                        disabled={disabled}
                                    />
                                </div>

                                <ConnectionPoolNameField
                                    id={`llm-pool-${profile.uiId}`}
                                    className="gap-1.5"
                                    help={fh("connectionPoolName")}
                                    value={model.connectionPoolName ?? DEFAULT_POOL_NAME}
                                    onChange={(next) =>
                                        updateModel(profile.uiId, { connectionPoolName: next })
                                    }
                                    disabled={disabled}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <FieldLabel help={fh("toolErrorPrompt")}>
                                    Tool error prompt
                                </FieldLabel>
                                <Textarea
                                    value={model.toolErrorPrompt ?? ""}
                                    onChange={(e) =>
                                        updateModel(profile.uiId, {
                                            toolErrorPrompt: e.target.value,
                                        })
                                    }
                                    rows={3}
                                    placeholder={uiText("help.llmSystemPrompt")}
                                    disabled={disabled}
                                />
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                                Pricing
                            </div>

                            <div className="space-y-2">
                                <HoverTip tip={uiText("help.llmPricing")}>
                                    <FieldLabel help={fh("pricing")}>
                                        Price per million tokens
                                    </FieldLabel>
                                </HoverTip>

                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {PRICE_FIELDS.map((field) => (
                                        <div key={field.key} className="space-y-1.5">
                                            <span className="text-xs text-muted-foreground">
                                                {field.label}
                                            </span>
                                            <Input
                                                aria-label={`${field.label} price`}
                                                className="tabular-nums"
                                                inputMode="decimal"
                                                value={profile.priceText[field.key]}
                                                onChange={(e) =>
                                                    setPrice(
                                                        profile.uiId,
                                                        field.key,
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="0"
                                                disabled={disabled}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <ProfileDoc
                            id={`llm-doc-${profile.uiId}`}
                            value={profile.model.doc ?? ""}
                            help={fh("doc")}
                            onChange={(v) => updateModel(profile.uiId, { doc: v })}
                        />
                    </div>
                </CardContent>

                <ActionBar
                    onUpdate={() => void handleUpsert(profile.uiId)}
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
                                disabled={deleteDisabled}
                                onClick={() => setDeleteTargetUiId(profile.uiId)}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                            <span className="order-last basis-full text-xs text-muted-foreground sm:order-none sm:basis-auto">
                                {profile.usedBy.length > 0
                                    ? uiText("delete.llmInUse")
                                    : uiText("delete.profileCannotBeUndone")}
                            </span>
                        </>
                    }
                />
            </Card>

            <AlertDialog
                open={deleteTargetUiId !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTargetUiId(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete LLM profile</AlertDialogTitle>
                        <AlertDialogDescription>
                            If there are agents using{" "}
                            <span className="font-semibold">{profile.name || "this profile"}</span>,
                            they will fail. Are you sure?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                const uiId = deleteTargetUiId;
                                setDeleteTargetUiId(null);
                                if (uiId) {
                                    void handleDelete(uiId).then(() => {
                                        releaseGuard();
                                        UI.goBack("LlmProfile");
                                    });
                                }
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {unsavedDialog}
        </TooltipProvider>
    );
}
