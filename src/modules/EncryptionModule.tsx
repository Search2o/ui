import { useState, useEffect } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import type {
    ConfigPartResponseModel,
    EncryptionKey,
    EncryptionModel,
    EncryptionSource,
} from "@/orval/search2o.schemas";
import { toast } from "sonner";
import { useUnsavedWork } from "@/shared/sessionExpiry";

import { Card, CardContent } from "@/components/ui/card";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp } from "@/shared/fieldHelp";
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
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2, ChevronDown, ChevronRight, KeyRound, Webhook } from "lucide-react";
import * as UI from "@/shared/uistate";
import { UpdatedBy } from "@/shared/UpdatedBy";
import { uiText } from "@/shared/uiText";

type EncryptionKeyRow = EncryptionKey & {
    id: string;
};

const createKeyRow = (patch?: Partial<EncryptionKeyRow>): EncryptionKeyRow => ({
    id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
    keyName: "",
    createdAt: Date.now(),
    ...patch,
});

const keysToRows = (keys: EncryptionKey[] | undefined | null): EncryptionKeyRow[] =>
    Array.isArray(keys) ? keys.map((key) => createKeyRow(key)) : [];

const rowsToKeys = (rows: EncryptionKeyRow[]): EncryptionKey[] =>
    rows.map(({ keyName, createdAt }) => ({
        keyName: keyName.trim(),
        createdAt,
    }));

const formatCreatedAt = (value: number) => {
    if (!value) return "—";
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const dt = new Date(ms);
    return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleString();
};

export function EncryptionSection() {
    const fh = useFieldHelp("EncryptionModel", "EncryptionKey");
    const [res, setRes] = useState<ConfigPartResponseModel | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [version, setVersion] = useState<number | undefined>(undefined);

    const [configPart, setConfigPart] = useState<EncryptionModel>({});
    const [keyRows, setKeyRows] = useState<EncryptionKeyRow[]>([]);
    const [showPreviousKeys, setShowPreviousKeys] = useState(false);

    useUnsavedWork(
        () =>
            JSON.stringify(configPart) !== JSON.stringify(res?.configValue) ||
            JSON.stringify(keyRows) !==
                JSON.stringify(keysToRows((res?.configValue as EncryptionModel | undefined)?.keys)),
    );

    useEffect(() => {
        let isMounted = true;

        (async () => {
            try {
                const resp = await API.getSystemConfigPart({ part: "encryption" });
                if (!resp.success) {
                    toast.error(resp.error?.message ?? "Failed to load encryption configuration");
                    return;
                }
                if (!isMounted) return;

                const loadedConfigPart = resp.configValue as EncryptionModel;

                setRes(resp);
                setConfigPart(loadedConfigPart);
                setVersion(resp.configVersion);
                setKeyRows(keysToRows(loadedConfigPart.keys));

                if (resp.configError) {
                    toast.error(resp.configError);
                }
            } catch {
                toast.error("Unable to load encryption configuration");
            } finally {
                if (isMounted) setLoading(false);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, []);

    const onChangeEncryptionSource = (value: EncryptionSource) => {
        setConfigPart((prev) => ({
            ...prev,
            encryptionSource: value,
        }));
    };

    const updateKeyRow = (id: string, patch: Partial<EncryptionKeyRow>) => {
        setKeyRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    };

    const addKeyRow = () => {
        setKeyRows((prev) => [
            ...prev,
            createKeyRow({
                createdAt: Date.now(),
            }),
        ]);
        setShowPreviousKeys(true);
    };

    const removeKeyRow = (id: string) => {
        setKeyRows((prev) => prev.filter((row) => row.id !== id));
    };

    const currentKey = keyRows.length > 0 ? keyRows[keyRows.length - 1] : null;
    const previousKeys = keyRows.slice(0, -1).reverse();

    const update = async () => {
        if (version === undefined) return;
        setSaving(true);

        try {
            const value: EncryptionModel = { ...configPart, type: "encryption" };

            if (value.encryptionSource === "client") {
                const trimmedRows = keyRows.filter((row) => row.keyName.trim() !== "");

                if (trimmedRows.length === 0) {
                    toast.error(uiText("validate.encryptionKeyRequired"));
                    return;
                }

                const duplicateNames = new Set<string>();
                const seenNames = new Set<string>();

                for (const row of trimmedRows) {
                    const trimmedName = row.keyName.trim();
                    if (!trimmedName) {
                        toast.error(uiText("validate.encryptionKeyName"));
                        return;
                    }
                    if (seenNames.has(trimmedName)) {
                        duplicateNames.add(trimmedName);
                    }
                    seenNames.add(trimmedName);
                }

                if (duplicateNames.size > 0) {
                    toast.error(
                        `Duplicate encryption key names are not allowed: ${Array.from(duplicateNames).join(", ")}`,
                    );
                    return;
                }

                value.keys = rowsToKeys(trimmedRows);
            }

            const resp = await API.updateSystemConfigPart({
                configValue: value,
                configVersion: version,
            });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to update encryption configuration");
                return;
            }

            setVersion(resp.configVersion);
            setConfigPart(value);
            setKeyRows(keysToRows(value.keys));

            toast.success(uiText("config.encryptionUpdated"));
        } catch {
            toast.error("Unable to update encryption configuration");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="space-y-4">
            <div className="space-y-1">
                <h3 className="text-sm font-semibold">Encryption</h3>
                <UpdatedBy obj={res} />
            </div>

            <div className="max-w-3xl space-y-6">
                <div className="grid gap-2">
                    <FieldLabel help={fh("encryptionSource")} htmlFor="encryptionSource">
                        Encryption source
                    </FieldLabel>
                    <Select
                        value={configPart.encryptionSource ?? "cloud"}
                        onValueChange={(v) => onChangeEncryptionSource(v as EncryptionSource)}
                        disabled={loading}
                    >
                        <SelectTrigger id="encryptionSource" className="w-full">
                            <SelectValue placeholder="Select encryption source" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cloud">Cloud</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {configPart.encryptionSource === "client" && (
                    <>
                        <Separator />

                        <div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => UI.openModule("HooksConfig")}
                            >
                                <Webhook className="h-4 w-4" />
                                {uiText("encryption.openKeyHook")}
                            </Button>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <HoverTip tip="The most recent key is treated as the current key. Older key IDs are retained for reference, as they would be required to decrypt data that was encrypted using them.">
                                        <div className="w-fit text-sm font-medium">
                                            Encryption keys
                                        </div>
                                    </HoverTip>
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={addKeyRow}
                                    disabled={loading}
                                >
                                    <Plus className="h-4 w-4" />
                                    Add key
                                </Button>
                            </div>

                            {currentKey ? (
                                <Card className="border-border/70 bg-card/50 shadow-sm">
                                    <CardContent className="space-y-4 pt-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <KeyRound className="h-4 w-4 text-muted-foreground" />
                                                <div className="text-sm font-medium">
                                                    Current key
                                                </div>
                                            </div>
                                            <Badge variant="secondary">Current</Badge>
                                        </div>

                                        <div className="grid gap-2">
                                            <FieldLabel
                                                help={fh("keyName")}
                                                htmlFor={`key-${currentKey.id}`}
                                            >
                                                Key name
                                            </FieldLabel>
                                            <Input
                                                id={`key-${currentKey.id}`}
                                                value={currentKey.keyName}
                                                onChange={(e) =>
                                                    updateKeyRow(currentKey.id, {
                                                        keyName: e.target.value,
                                                    })
                                                }
                                                placeholder="client-key-v1"
                                                disabled={loading}
                                                autoComplete="off"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                            <span>
                                                Created: {formatCreatedAt(currentKey.createdAt)}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeKeyRow(currentKey.id)}
                                                disabled={loading}
                                                aria-label="Remove current key"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="rounded-xl border border-dashed border-muted-foreground/30 px-4 py-6 text-sm text-muted-foreground">
                                    {uiText("empty.encryptionKeys")}
                                </div>
                            )}

                            {previousKeys.length > 0 && (
                                <div className="space-y-3">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="px-0 hover:bg-transparent"
                                        onClick={() => setShowPreviousKeys((prev) => !prev)}
                                        disabled={loading}
                                    >
                                        {showPreviousKeys ? (
                                            <ChevronDown className="mr-1 h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="mr-1 h-4 w-4" />
                                        )}
                                        {showPreviousKeys
                                            ? "Hide previous keys"
                                            : `Show previous keys (${previousKeys.length})`}
                                    </Button>

                                    {showPreviousKeys && (
                                        <div className="space-y-3">
                                            {previousKeys.map((row, idx) => (
                                                <Card
                                                    key={row.id}
                                                    className="border-border/60 bg-background/60 shadow-sm"
                                                >
                                                    <CardContent className="space-y-4 pt-5">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="text-sm font-medium">
                                                                Previous key{" "}
                                                                {previousKeys.length - idx}
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => removeKeyRow(row.id)}
                                                                disabled={loading}
                                                                aria-label={`Remove previous key ${previousKeys.length - idx}`}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>

                                                        <div className="grid gap-2">
                                                            <FieldLabel
                                                                help={fh("keyName")}
                                                                htmlFor={`key-${row.id}`}
                                                            >
                                                                Key name
                                                            </FieldLabel>
                                                            <Input
                                                                id={`key-${row.id}`}
                                                                value={row.keyName}
                                                                onChange={(e) =>
                                                                    updateKeyRow(row.id, {
                                                                        keyName: e.target.value,
                                                                    })
                                                                }
                                                                placeholder="client-key-v0"
                                                                disabled={loading}
                                                                autoComplete="off"
                                                            />
                                                        </div>

                                                        <div className="text-xs text-muted-foreground">
                                                            Created:{" "}
                                                            {formatCreatedAt(row.createdAt)}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
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
