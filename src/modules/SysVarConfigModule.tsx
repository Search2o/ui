import { useState, useEffect } from "react";
import * as API from "@/orval/search2o";
import type { ConfigPartResponseModel, SysVar, SysVariables } from "@/orval/search2o.schemas";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";
import { Check } from "lucide-react";
import { ActionBar } from "@/shared/ActionBar";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { UpdatedBy } from "@/shared/UpdatedBy";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp } from "@/shared/fieldHelp";
import { uiText } from "@/shared/uiText";
import {
    OPTIONAL_SYS_VARIABLES,
    alwaysAvailableSysVariables,
    sysVariableHelp,
} from "@/shared/sysVariables";

const help = sysVariableHelp;

function VariableRow({ name, children }: { name: string; children: React.ReactNode }) {
    return (
        <>
            {children}
            <span className="min-w-0">
                <span className="block font-mono text-xs">sys.{name}</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                    {help(name)}
                </span>
            </span>
        </>
    );
}

function withNames(text: string, names: SysVariables[] | null): string {
    const list = (names ?? []).map((n) => `sys.${n}`);
    const joined =
        list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
    return text.replace(/%names%/g, joined);
}

export default function SysVarConfigModule() {
    const [loaded, setLoaded] = useState<ConfigPartResponseModel | null>(null);
    const [configPart, setConfigPart] = useState<SysVar | null>(null);
    const fh = useFieldHelp("SysVar");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [removing, setRemoving] = useState<SysVariables[] | null>(null);

    const dirty =
        configPart !== null &&
        (configPart.sysVariables ?? []).join() !==
            ((loaded?.configValue as SysVar | undefined)?.sysVariables ?? []).join();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const resp = await API.getSystemConfigPart({ part: "sysvar" });
                if (!resp.success) {
                    toast.error(resp.error?.message || "Failed to load the system variables.");
                    return;
                }
                if (!cancelled) {
                    setLoaded(resp);
                    setConfigPart(resp.configValue as SysVar);
                }
            } catch {
                toast.error("Failed to load the system variables.");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const removed = (): SysVariables[] => {
        const before = new Set((loaded?.configValue as SysVar | undefined)?.sysVariables ?? []);
        const after = new Set(configPart?.sysVariables ?? []);
        return OPTIONAL_SYS_VARIABLES.filter((v) => before.has(v) && !after.has(v));
    };

    const onUpdate = () => {
        const gone = removed();
        if (gone.length > 0) setRemoving(gone);
        else void save();
    };

    const save = async (): Promise<boolean> => {
        if (!loaded || !configPart) return false;
        setRemoving(null);
        setIsSaving(true);
        try {
            const nextConfigPart: SysVar = { ...configPart, type: "sysvar" };

            const resp = await API.updateSystemConfigPart({
                configValue: nextConfigPart,
                configVersion: loaded.configVersion,
            });

            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to update the system variables.");
                return false;
            }

            toast.success(`System variables updated. ${uiText("config.appliesToNewRuns")}`);

            setLoaded({
                ...loaded,
                configValue: nextConfigPart,
                configVersion: resp.configVersion,
            });
            setConfigPart(nextConfigPart);
            return true;
        } catch {
            toast.error("Failed to update the system variables.");
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const toggle = (name: SysVariables, checked: boolean) =>
        setConfigPart((prev) => {
            if (!prev) return prev;
            const current = new Set(prev.sysVariables ?? []);
            if (checked) current.add(name);
            else current.delete(name);
            return { ...prev, sysVariables: OPTIONAL_SYS_VARIABLES.filter((v) => current.has(v)) };
        });

    const { dialog: unsavedDialog } = useUnsavedChanges({
        isDirty: () => dirty,
        onSave: !isLoading && removed().length === 0 ? save : undefined,
        what: "page",
    });

    return (
        <Card className="w-full">
            <CardHeader>
                <ModuleCardTitle title="System variables" />
                <UpdatedBy obj={loaded} />
            </CardHeader>

            <CardContent className="space-y-6">
                <div className="grid max-w-3xl gap-2">
                    <FieldLabel help={fh("sysVariables")}>Optional</FieldLabel>
                    <div className="grid gap-2 pt-1 sm:grid-cols-2">
                        {OPTIONAL_SYS_VARIABLES.map((name) => (
                            <label
                                key={name}
                                className="flex items-start gap-2.5 rounded-lg border bg-background p-2.5 text-sm"
                            >
                                <VariableRow name={name}>
                                    <Checkbox
                                        className="mt-0.5"
                                        checked={(configPart?.sysVariables ?? []).includes(name)}
                                        disabled={isLoading}
                                        onCheckedChange={(checked) =>
                                            toggle(name, checked === true)
                                        }
                                    />
                                </VariableRow>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="grid max-w-3xl gap-2">
                    <FieldLabel>Always available</FieldLabel>
                    <div className="grid gap-2 pt-1 sm:grid-cols-2">
                        {alwaysAvailableSysVariables().map((name) => (
                            <div
                                key={name}
                                className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-2.5 text-sm"
                            >
                                <VariableRow name={name}>
                                    <Check
                                        aria-hidden
                                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                                    />
                                </VariableRow>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>

            {unsavedDialog}
            <ActionBar onUpdate={onUpdate} dirty={dirty} busy={isSaving} disabled={isLoading} />

            <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {withNames(uiText("sysVariables.removeTitle"), removing)}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {withNames(uiText("sysVariables.removeBody"), removing)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{uiText("sysVariables.removeKeep")}</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => void save()}>
                            {uiText("sysVariables.removeConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
