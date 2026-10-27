import { useState, useEffect } from "react";
import * as API from "@/orval/search2o";
import type {
    CompileOptions,
    ConfigPartResponseModel,
    OperatorMappingAction,
} from "@/orval/search2o.schemas";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp } from "@/shared/fieldHelp";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";
import { ActionBar } from "@/shared/ActionBar";
import { useSavedBaseline } from "@/shared/savedBaseline";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { UpdatedBy } from "@/shared/UpdatedBy";
import { uiText } from "@/shared/uiText";
import { OPERATOR_ROWS, type OperatorKey, ruleOf } from "@/shared/operators";

type OperatorMode = "allow" | "deny" | "rewrite";

const MODES: { value: OperatorMode; label: string }[] = [
    { value: "allow", label: "Allow" },
    { value: "deny", label: "Deny" },
    { value: "rewrite", label: "Rewrite" },
];

function modeOf(rule: OperatorMappingAction): OperatorMode {
    if (rule.allow === false) return "deny";
    return rule.rewrite ? "rewrite" : "allow";
}

function ruleForMode(mode: OperatorMode, rewrite: string): OperatorMappingAction {
    if (mode === "deny") return { allow: false, rewrite: "" };
    if (mode === "allow") return { allow: true, rewrite: "" };
    return { allow: true, rewrite };
}

export default function OperatorsConfigModule() {
    const fh = useFieldHelp("CompileOptions", "OperatorMappingModel", "OperatorMappingAction");
    const [res, setRes] = useState<ConfigPartResponseModel | null>(null);
    const [model, setModel] = useState<ConfigPartResponseModel | null>(null);
    const [configPart, setConfigPart] = useState<CompileOptions | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [modes, setModes] = useState<Partial<Record<OperatorKey, OperatorMode>>>({});

    const { dirty, markSaved } = useSavedBaseline(configPart ? { configPart, modes } : null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const res = await API.getSystemConfigPart({ part: "operators" });

                if (!res.success) {
                    toast.error(res.error?.message || "Failed to load the compile rules");
                    return;
                }

                if (!cancelled) {
                    const cp = res.configValue as CompileOptions;
                    setRes(res);
                    setModel(res);
                    const operators = cp.operators ?? {};
                    const loadedModes = Object.fromEntries(
                        OPERATOR_ROWS.map((r) => [r.key, modeOf(ruleOf(operators, r.key))]),
                    );
                    const loaded: CompileOptions = {
                        ...cp,
                        operators,
                        maxComprehensionDepth: cp.maxComprehensionDepth ?? 4,
                        maxGeneratorsInComprehension: cp.maxGeneratorsInComprehension ?? 3,
                    };
                    setModes(loadedModes);
                    setConfigPart(loaded);
                    markSaved({ configPart: loaded, modes: loadedModes });
                }
            } catch {
                toast.error("Failed to load the compile rules");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [markSaved]);

    const setRule = (key: OperatorKey, rule: OperatorMappingAction) =>
        setConfigPart((prev) => {
            const current = prev ?? {};
            return { ...current, operators: { ...(current.operators ?? {}), [key]: rule } };
        });

    const handleModeChange = (key: OperatorKey, mode: OperatorMode) => {
        setModes((prev) => ({ ...prev, [key]: mode }));
        setRule(key, ruleForMode(mode, ruleOf(configPart?.operators ?? {}, key).rewrite ?? ""));
    };

    const handleRewriteChange = (key: OperatorKey, rewrite: string) =>
        setRule(key, ruleForMode("rewrite", rewrite));

    const handleNumberChange = (
        key: "maxComprehensionDepth" | "maxGeneratorsInComprehension",
        value: string,
    ) => {
        const n = Number(value);
        setConfigPart((prev) => ({
            ...(prev ?? {}),
            [key]: Number.isFinite(n) ? n : 0,
        }));
    };

    const onUpdate = async (): Promise<boolean> => {
        if (!model || !configPart) return false;

        setIsSaving(true);
        try {
            const nextConfigPart: CompileOptions = {
                ...configPart,
                type: "operators",
                operators: { ...(configPart.operators ?? {}) },
                maxComprehensionDepth: configPart.maxComprehensionDepth ?? 4,
                maxGeneratorsInComprehension: configPart.maxGeneratorsInComprehension ?? 3,
            };

            const res = await API.updateSystemConfigPart({
                configValue: nextConfigPart,
                configVersion: model.configVersion,
            });

            if (!res.success) {
                toast.error(res.error?.message || "Failed to update the compile rules");
                return false;
            }

            toast.success(uiText("config.compileUpdated"));

            setModel({
                ...model,
                configValue: nextConfigPart,
                configVersion: res.configVersion,
            });

            setConfigPart(nextConfigPart);
            markSaved({ configPart: nextConfigPart, modes });
            return true;
        } catch {
            toast.error("Failed to update the compile rules");
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const operators = configPart?.operators ?? {};

    const needsName = OPERATOR_ROWS.filter(
        (row) =>
            (modes[row.key] ?? modeOf(ruleOf(operators, row.key))) === "rewrite" &&
            !(ruleOf(operators, row.key).rewrite ?? "").trim(),
    );

    const { dialog: unsavedDialog } = useUnsavedChanges({
        isDirty: () => dirty,
        onSave: !(isLoading || needsName.length > 0) ? onUpdate : undefined,
        what: "page",
    });

    return (
        <Card className="w-full">
            <CardHeader>
                <ModuleCardTitle title="Compile rules" />
                <UpdatedBy obj={res} />
            </CardHeader>

            <CardContent className="space-y-8">
                <div className="space-y-4">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-medium">Python expressions</h3>
                        </div>

                        <div className="grid gap-4 max-w-2xl">
                            <div className="grid gap-2">
                                <FieldLabel
                                    help={fh("maxComprehensionDepth")}
                                    htmlFor="maxComprehensionDepth"
                                >
                                    Max comprehension depth
                                </FieldLabel>
                                <Input
                                    id="maxComprehensionDepth"
                                    type="number"
                                    min={0}
                                    max={999}
                                    className="w-24"
                                    value={configPart?.maxComprehensionDepth ?? 4}
                                    onChange={(e) =>
                                        handleNumberChange("maxComprehensionDepth", e.target.value)
                                    }
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="grid gap-2">
                                <FieldLabel
                                    help={fh("maxGeneratorsInComprehension")}
                                    htmlFor="maxGeneratorsInComprehension"
                                >
                                    Max generators per comprehension
                                </FieldLabel>
                                <Input
                                    id="maxGeneratorsInComprehension"
                                    type="number"
                                    min={0}
                                    max={999}
                                    className="w-24"
                                    value={configPart?.maxGeneratorsInComprehension ?? 3}
                                    onChange={(e) =>
                                        handleNumberChange(
                                            "maxGeneratorsInComprehension",
                                            e.target.value,
                                        )
                                    }
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <div>
                        <FieldLabel help={fh("operators")}>
                            <h3 className="text-sm font-medium">Operators</h3>
                        </FieldLabel>
                    </div>

                    <div className="grid max-w-2xl gap-3">
                        {OPERATOR_ROWS.map((row) => {
                            const rule = ruleOf(operators, row.key);
                            const mode = modes[row.key] ?? modeOf(rule);
                            return (
                                <div
                                    key={row.key}
                                    className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2"
                                >
                                    <Label className="w-48 font-normal">{row.label}</Label>
                                    <RadioGroup
                                        className="flex items-center gap-4"
                                        aria-label={row.label}
                                        value={mode}
                                        disabled={isLoading}
                                        onValueChange={(v) =>
                                            handleModeChange(row.key, v as OperatorMode)
                                        }
                                    >
                                        {MODES.map((m) => (
                                            <div
                                                key={m.value}
                                                className="flex items-center gap-1.5"
                                            >
                                                <RadioGroupItem
                                                    value={m.value}
                                                    id={`${row.key}-${m.value}`}
                                                />
                                                <FieldLabel
                                                    htmlFor={`${row.key}-${m.value}`}
                                                    className="font-normal"
                                                    help={
                                                        m.value === "rewrite"
                                                            ? fh("rewrite")
                                                            : undefined
                                                    }
                                                >
                                                    {m.label}
                                                </FieldLabel>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                    <div className="w-56">
                                        {mode === "rewrite" && (
                                            <Input
                                                aria-label={`Rewrite ${row.label} to`}
                                                className="w-full"
                                                value={rule.rewrite ?? ""}
                                                placeholder={uiText("compile.rewriteTo")}
                                                disabled={isLoading}
                                                aria-invalid={!(rule.rewrite ?? "").trim()}
                                                onChange={(e) =>
                                                    handleRewriteChange(row.key, e.target.value)
                                                }
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CardContent>

            {unsavedDialog}
            <ActionBar
                onUpdate={onUpdate}
                dirty={dirty}
                busy={isSaving}
                disabled={isLoading || needsName.length > 0}
                message={
                    needsName.length > 0 ? (
                        <span className="text-destructive">
                            {uiText("compile.rewriteNeedsName")}
                        </span>
                    ) : undefined
                }
            />
        </Card>
    );
}
