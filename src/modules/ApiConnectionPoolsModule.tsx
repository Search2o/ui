import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import type {
    ApiConnectionPoolModel,
    ApiConnectionPoolsModel,
    ApiConnectionPoolsModelPools,
    ConfigPartResponseModel,
} from "@/orval/search2o.schemas";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { ActionBar } from "@/shared/ActionBar";
import { useSavedBaseline } from "@/shared/savedBaseline";

import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { UpdatedBy } from "@/shared/UpdatedBy";
import {
    ApiConnectionPoolCertificates,
    ApiConnectionPoolFields,
} from "@/shared/ApiConnectionPoolFields";
import { fieldsToPool, poolToFields, type PoolFields } from "@/shared/apiConnectionPool";
import { HoverTip } from "@/shared/HoverTip";
import {
    DEFAULT_POOL_NAME,
    POOL_NAME_RULE,
    invalidateApiConnectionPoolNames,
    poolNameError,
} from "@/shared/apiConnectionPoolNames";
import { uiText } from "@/shared/uiText";

type PoolForm = PoolFields & {
    id: string;
    name: string;
    isDefault: boolean;
    source: ApiConnectionPoolModel;
};

function makeId() {
    return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

function toForm(name: string, pool: ApiConnectionPoolModel): PoolForm {
    return {
        ...poolToFields(pool),
        id: makeId(),
        name,
        isDefault: name === DEFAULT_POOL_NAME,
        source: pool,
    };
}

function newPoolForm(name: string): PoolForm {
    return { ...poolToFields(null), id: makeId(), name, isDefault: false, source: {} };
}

function uniqueName(existing: PoolForm[]): string {
    const taken = new Set(existing.map((p) => p.name.trim()));
    for (let n = 1; ; n++) {
        const candidate = `pool_${n}`;
        if (!taken.has(candidate)) return candidate;
    }
}

export default function ApiConnectionPoolsModule() {
    const [res, setRes] = useState<ConfigPartResponseModel | null>(null);
    const [pools, setPools] = useState<PoolForm[]>([]);
    const { dirty, markSaved } = useSavedBaseline(pools);
    const [version, setVersion] = useState<number | undefined>(undefined);
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const resp = await API.getSystemConfigPart({ part: "apiConnectionPools" });
            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to load API connection pools");
                return;
            }
            const value = resp.configValue as ApiConnectionPoolsModel;
            const entries = Object.entries(value.pools ?? {}) as [string, ApiConnectionPoolModel][];
            entries.sort(([a], [b]) =>
                a === DEFAULT_POOL_NAME ? -1 : b === DEFAULT_POOL_NAME ? 1 : a.localeCompare(b),
            );
            setRes(resp);
            setVersion(resp.configVersion);
            const forms = entries.map(([name, pool]) => toForm(name, pool));
            setPools(forms);
            markSaved(forms);
            setOpen({});
        } catch {
            toast.error("Failed to load API connection pools");
        } finally {
            setLoading(false);
        }
    }, [markSaved]);

    useEffect(() => {
        void load();
    }, [load]);

    const patch = (id: string, changes: Partial<PoolForm>) =>
        setPools((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));

    const addPool = () => {
        const pool = newPoolForm(uniqueName(pools));
        setPools((prev) => [...prev, pool]);
        setOpen((prev) => ({ ...prev, [pool.id]: true }));
    };

    const deletePool = (id: string) => setPools((prev) => prev.filter((p) => p.id !== id));

    const onUpdate = async (): Promise<boolean> => {
        if (version === undefined) return false;

        const names = pools.map((p) => p.name.trim());
        for (const pool of pools) {
            const problem = poolNameError(pool.name);
            if (problem) {
                toast.error(pool.name.trim() ? `“${pool.name.trim()}”: ${problem}` : problem);
                return false;
            }
        }
        const duplicate = names.find((n, i) => names.indexOf(n) !== i);
        if (duplicate) {
            toast.error(`More than one pool is named "${duplicate}".`);
            return false;
        }
        if (!names.includes(DEFAULT_POOL_NAME)) {
            toast.error(`A pool named "${DEFAULT_POOL_NAME}" is required.`);
            return false;
        }

        const built: ApiConnectionPoolsModelPools = {};
        for (const form of pools) {
            const result = fieldsToPool(form, form.source);
            if (!result.ok) {
                toast.error(`${result.badField} for "${form.name.trim()}" must be 0 or more.`);
                return false;
            }
            built[form.name.trim()] = result.pool;
        }

        setSaving(true);
        try {
            const value: ApiConnectionPoolsModel = {
                type: "apiConnectionPools",
                pools: built,
            };
            const resp = await API.updateSystemConfigPart({
                configValue: value,
                configVersion: version,
            });
            if (!resp.success) {
                toast.error(resp.error?.message || "Update failed.");
                return false;
            }
            setVersion(resp.configVersion);
            markSaved(pools);
            invalidateApiConnectionPoolNames();

            toast.success(uiText("config.poolsUpdated"));
            return true;
        } catch {
            toast.error("Update failed.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    const disabled = loading || saving || version === undefined;
    const deleteTarget = pools.find((p) => p.id === deleteTargetId) ?? null;

    const { dialog: unsavedDialog } = useUnsavedChanges({
        isDirty: () => dirty,
        onSave: !(loading || version === undefined) ? onUpdate : undefined,
        what: "page",
    });

    return (
        <Card className="w-full shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                    <ModuleCardTitle title="API connection pools" />
                    <UpdatedBy obj={res} />
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={addPool}
                    disabled={disabled}
                >
                    <Plus className="h-4 w-4" />
                    Add pool
                </Button>
            </CardHeader>

            <CardContent className="space-y-3 pt-4">
                <p className="max-w-3xl text-sm text-muted-foreground">
                    Connection pools shared by the whole deployment. LLM profiles and API profiles
                    choose one by name. The pool named “{DEFAULT_POOL_NAME}” is what they fall back
                    to and cannot be removed.
                </p>

                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                    pools.map((pool) => {
                        const isOpen = Boolean(open[pool.id]);
                        return (
                            <Collapsible
                                key={pool.id}
                                open={isOpen}
                                onOpenChange={(next) =>
                                    setOpen((prev) => ({ ...prev, [pool.id]: next }))
                                }
                                className="rounded-lg border bg-card"
                            >
                                <div className="flex items-center justify-between gap-3 px-3 py-2">
                                    <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left">
                                        {isOpen ? (
                                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        )}
                                        <span className="text-sm font-medium">
                                            {pool.name.trim() || "(unnamed pool)"}
                                        </span>
                                        {pool.isDefault ? (
                                            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                                default
                                            </span>
                                        ) : null}
                                    </CollapsibleTrigger>

                                    {!pool.isDefault ? (
                                        <HoverTip tip="Remove this pool">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Remove ${pool.name}`}
                                                className="text-muted-foreground hover:text-foreground"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteTargetId(pool.id);
                                                }}
                                                disabled={disabled}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </HoverTip>
                                    ) : null}
                                </div>

                                <CollapsibleContent>
                                    <div className="space-y-6 border-t px-4 py-4">
                                        <div className="grid max-w-sm gap-2">
                                            <HoverTip
                                                tip={
                                                    pool.isDefault
                                                        ? uiText("help.fallbackPool")
                                                        : `${POOL_NAME_RULE} Renaming counts as removing the old name, so it is refused while anything still uses this pool.`
                                                }
                                            >
                                                <Label htmlFor={`${pool.id}-name`}>Pool name</Label>
                                            </HoverTip>
                                            <Input
                                                id={`${pool.id}-name`}
                                                value={pool.name}
                                                onChange={(e) =>
                                                    patch(pool.id, { name: e.target.value })
                                                }
                                                disabled={disabled || pool.isDefault}
                                            />
                                        </div>

                                        <ApiConnectionPoolFields
                                            idPrefix={pool.id}
                                            fields={pool}
                                            onChange={(changes) => patch(pool.id, changes)}
                                            disabled={disabled}
                                        />

                                        <ApiConnectionPoolCertificates
                                            idPrefix={pool.id}
                                            fields={pool}
                                            onChange={(changes) => patch(pool.id, changes)}
                                            warning={uiText("pools.certificateWarning")}
                                            disabled={disabled}
                                        />
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        );
                    })
                )}
            </CardContent>

            {unsavedDialog}
            <ActionBar
                onUpdate={onUpdate}
                dirty={dirty}
                busy={saving}
                disabled={loading || version === undefined}
            />

            <AlertDialog
                open={deleteTarget !== null}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove “{deleteTarget?.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The pool is removed when you press Update. If any LLM profile or API
                            profile still uses it, the server refuses the change and names what is
                            using it — repoint those first and try again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteTarget) deletePool(deleteTarget.id);
                                setDeleteTargetId(null);
                            }}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
