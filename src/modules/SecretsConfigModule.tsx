import { useState, useEffect } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import type {
    AgentSecretsModel,
    ConfigPartResponseModel,
    SecretConversionOptions,
    SecretSource,
    SecretTransformModel,
} from "@/orval/search2o.schemas";
import { toast } from "sonner";
import { useUnsavedWork } from "@/shared/sessionExpiry";
import * as UI from "@/shared/uistate";

import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Save, Webhook } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { UpdatedBy } from "@/shared/UpdatedBy";
import { uiText } from "@/shared/uiText";

const DEFAULT_TRANSFORM: SecretTransformModel = {
    match: "[^a-zA-Z0-9]",
    replace: "_",
    convertTo: "none",
};
export function SecretsSection() {
    const fh = useFieldHelp("AgentSecretsModel", "SecretTransformModel");
    const ft = useFieldTitle("AgentSecretsModel");
    const [res, setRes] = useState<ConfigPartResponseModel | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [version, setVersion] = useState<number | undefined>(undefined);
    const [configPart, setConfigPart] = useState<AgentSecretsModel>({});

    useUnsavedWork(() => JSON.stringify(configPart) !== JSON.stringify(res?.configValue));

    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const resp = await API.getSystemConfigPart({ part: "secrets" });
                if (!resp.success) {
                    toast.error(resp.error?.message ?? "Failed to load secrets configuration");
                    return;
                }
                if (!isMounted) return;

                setRes(resp);
                setConfigPart(resp.configValue as AgentSecretsModel);
                setVersion(resp.configVersion);

                if (resp.configError) {
                    toast.error(resp.configError);
                }
            } catch {
                toast.error("Unable to load secrets configuration");
            } finally {
                if (isMounted) setLoading(false);
            }
        })();
        return () => {
            isMounted = false;
        };
    }, []);

    const onChangeReadFrom = (val: SecretSource) =>
        setConfigPart((prev) => ({ ...prev, secretSource: val }));

    const onChangeTransform = (patch: Partial<SecretTransformModel>) =>
        setConfigPart((prev) => ({ ...prev, transform: { ...prev.transform, ...patch } }));

    const transformOn = configPart.transform != null;
    const setTransformOn = (on: boolean) =>
        setConfigPart((prev) => ({ ...prev, transform: on ? DEFAULT_TRANSFORM : null }));

    const onChangeCacheMinutes = (raw: string) =>
        setConfigPart((prev) => ({ ...prev, cacheMinutes: raw === "" ? undefined : Number(raw) }));

    const update = async () => {
        if (version === undefined) return;
        setSaving(true);
        try {
            const value: AgentSecretsModel = { ...configPart, type: "secrets" };

            const resp = await API.updateSystemConfigPart({
                configValue: value,
                configVersion: version,
            });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to update secrets configuration");
                return;
            }

            setVersion(resp.configVersion);
            setConfigPart(value);
            setRes((prev) => (prev ? { ...prev, configValue: value } : prev));

            toast.success(uiText("config.secretsUpdated"));
        } catch {
            toast.error("Unable to update secrets configuration");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="space-y-4">
            <div className="space-y-1">
                <h3 className="text-sm font-semibold">Secrets</h3>
                <UpdatedBy obj={res} />
            </div>
            <div className="max-w-3xl space-y-6">
                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <FieldLabel help={fh("secretSource")} htmlFor="readFrom">
                            Secrets source
                        </FieldLabel>
                    </div>
                    <Select
                        value={configPart.secretSource}
                        onValueChange={(v) => onChangeReadFrom(v as SecretSource)}
                        disabled={loading}
                    >
                        <SelectTrigger id="readFrom" className="w-full">
                            <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="env">Environment variable</SelectItem>
                            <SelectItem value="file">File</SelectItem>
                            <SelectItem value="vault">Vault</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-2">
                    <FieldLabel help={fh("cacheMinutes")} htmlFor="cacheMinutes">
                        {ft("cacheMinutes", "Cache duration (minutes)")}
                    </FieldLabel>
                    <Input
                        id="cacheMinutes"
                        type="number"
                        step={1}
                        className="max-w-48"
                        value={configPart.cacheMinutes ?? ""}
                        onChange={(e) => onChangeCacheMinutes(e.target.value)}
                        disabled={loading}
                    />
                </div>

                <Separator />

                {configPart.secretSource === "vault" ? (
                    <div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => UI.openModule("HooksConfig")}
                        >
                            <Webhook className="h-4 w-4" />
                            {uiText("secrets.openVaultHook")}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                            <HoverTip tip={fh("transform") ?? uiText("help.secretTransform")}>
                                <div className="text-sm font-medium">
                                    {ft("transform", "Name transform")}
                                </div>
                            </HoverTip>
                            <label className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">
                                    {transformOn ? "On" : "Off"}
                                </span>
                                <Switch
                                    checked={transformOn}
                                    onCheckedChange={setTransformOn}
                                    disabled={loading}
                                    aria-label={ft("transform", "Name transform")}
                                />
                            </label>
                        </div>

                        {transformOn ? (
                            <>
                                <div className="grid gap-2">
                                    <FieldLabel help={fh("match")} htmlFor="transformMatch">
                                        Match regex
                                    </FieldLabel>
                                    <Input
                                        id="transformMatch"
                                        value={configPart?.transform?.match ?? ""}
                                        onChange={(e) =>
                                            onChangeTransform({ match: e.target.value })
                                        }
                                        placeholder="[^a-zA-Z0-9]"
                                        disabled={loading}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <FieldLabel help={fh("replace")} htmlFor="transformReplace">
                                        Replacement
                                    </FieldLabel>
                                    <Input
                                        id="transformReplace"
                                        value={configPart?.transform?.replace ?? ""}
                                        onChange={(e) =>
                                            onChangeTransform({ replace: e.target.value })
                                        }
                                        placeholder="_"
                                        disabled={loading}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <FieldLabel help={fh("convertTo")} htmlFor="transformConvertTo">
                                        Case conversion
                                    </FieldLabel>
                                    <Select
                                        value={configPart?.transform?.convertTo ?? "none"}
                                        onValueChange={(v) =>
                                            onChangeTransform({
                                                convertTo: v as SecretConversionOptions,
                                            })
                                        }
                                        disabled={loading}
                                    >
                                        <SelectTrigger id="transformConvertTo" className="w-full">
                                            <SelectValue placeholder="Select conversion" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="upper">Uppercase</SelectItem>
                                            <SelectItem value="lower">Lowercase</SelectItem>
                                            <SelectItem value="none">No conversion</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        ) : null}
                    </div>
                )}
            </div>
            <div className="flex justify-end">
                <Button onClick={update} disabled={loading || saving} variant="outline">
                    <Save className="h-4 w-4" />
                    {saving ? "Updating…" : "Update"}
                </Button>
            </div>
        </section>
    );
}
