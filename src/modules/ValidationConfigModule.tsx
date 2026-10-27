import { useState, useEffect } from "react";
import * as API from "@/orval/search2o";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp } from "@/shared/fieldHelp";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { AgentValidationModel, ConfigPartResponseModel } from "@/orval/search2o.schemas";
import { ActionBar } from "@/shared/ActionBar";
import { useSavedBaseline } from "@/shared/savedBaseline";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { UpdatedBy } from "@/shared/UpdatedBy";
import { uiText } from "@/shared/uiText";

function SectionHeading({ title, hint }: { title: string; hint: string }) {
    return (
        <div className="space-y-0.5">
            <div className="text-xs font-semibold tracking-wide text-muted-foreground">{title}</div>
            <div className="text-xs text-muted-foreground/80">{hint}</div>
        </div>
    );
}

export default function ValidationConfigModule() {
    const fh = useFieldHelp("AgentValidationModel");
    const [res, setRes] = useState<ConfigPartResponseModel | null>(null);
    const [loading, setLoading] = useState(true);
    const [model, setModel] = useState<ConfigPartResponseModel | null>(null);
    const [configPart, setConfigPart] = useState<AgentValidationModel>();

    const { dirty, markSaved } = useSavedBaseline(configPart);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void (async () => {
            setLoading(true);
            try {
                const res = await API.getSystemConfigPart({ part: "validation" });
                if (!res.success) {
                    toast.error(res.error?.message ?? "Failed to load validation config.");
                    setLoading(false);
                    return;
                }
                setRes(res);
                setModel(res);
                setConfigPart(res.configValue as AgentValidationModel);
                markSaved(res.configValue as AgentValidationModel);
            } catch {
                toast.error("Failed to load validation config.");
            } finally {
                setLoading(false);
            }
        })();
    }, [markSaved]);

    async function onUpdate(): Promise<boolean> {
        if (!model || !configPart) return false;

        setSaving(true);
        try {
            const res = await API.updateSystemConfigPart({
                configValue: { ...configPart, type: "validation" },
                configVersion: model.configVersion,
            });

            if (!res.success) {
                toast.error(res.error?.message ?? "Update failed.");
                return false;
            }
            setModel({ ...model, configVersion: res.configVersion });
            markSaved(configPart);
            toast.success(
                `Agent runtime validation checks updated. ${uiText("config.appliesToNewRuns")}`,
            );
            return true;
        } catch {
            toast.error("Update failed.");
            return false;
        } finally {
            setSaving(false);
        }
    }

    const disabled = loading || !configPart;

    const { dialog: unsavedDialog } = useUnsavedChanges({
        isDirty: () => dirty,
        onSave: !disabled ? onUpdate : undefined,
        what: "page",
    });

    return (
        <Card className="w-full shadow-sm">
            <CardHeader>
                <ModuleCardTitle title="Agent runtime" />
                <UpdatedBy obj={res} />
            </CardHeader>
            <CardContent className="space-y-6">
                <SectionHeading title="Limits" hint={uiText("help.limitsSection")} />

                <div className="grid max-w-3xl gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <FieldLabel help={fh("maxIterationLoops")} htmlFor="maxIterations">
                            Max iterations in for and while loops
                        </FieldLabel>
                        <Input
                            id="maxIterations"
                            type="number"
                            className="w-28 shrink-0"
                            min={0}
                            step={1}
                            disabled={disabled}
                            value={configPart?.maxIterationLoops ?? ""}
                            onChange={(e) =>
                                setConfigPart((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              maxIterationLoops:
                                                  e.target.value === ""
                                                      ? undefined
                                                      : Math.max(
                                                            0,
                                                            Number.parseInt(e.target.value, 10) ||
                                                                0,
                                                        ),
                                          }
                                        : prev,
                                )
                            }
                        />
                    </div>
                </div>

                <div className="grid max-w-3xl gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <FieldLabel help={fh("dbMaxRows")} htmlFor="dbMaxRows">
                            Max database rows per query
                        </FieldLabel>
                        <Input
                            id="dbMaxRows"
                            type="number"
                            className="w-28 shrink-0"
                            min={0}
                            step={1}
                            disabled={disabled}
                            value={configPart?.dbMaxRows ?? ""}
                            onChange={(e) =>
                                setConfigPart((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              dbMaxRows:
                                                  e.target.value === ""
                                                      ? undefined
                                                      : Math.max(
                                                            0,
                                                            Number.parseInt(e.target.value, 10) ||
                                                                0,
                                                        ),
                                          }
                                        : prev,
                                )
                            }
                        />
                    </div>
                </div>

                <div className="grid max-w-3xl gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <FieldLabel help={fh("agentMaxLength")} htmlFor="agentMaxLength">
                            Max agent length (characters)
                        </FieldLabel>
                        <Input
                            id="agentMaxLength"
                            type="number"
                            className="w-28 shrink-0"
                            min={0}
                            step={1}
                            disabled={disabled}
                            value={configPart?.agentMaxLength ?? ""}
                            onChange={(e) =>
                                setConfigPart((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              agentMaxLength:
                                                  e.target.value === ""
                                                      ? undefined
                                                      : Math.max(
                                                            0,
                                                            Number.parseInt(e.target.value, 10) ||
                                                                0,
                                                        ),
                                          }
                                        : prev,
                                )
                            }
                        />
                    </div>
                </div>

                <Separator />

                <SectionHeading
                    title="Execution behaviour"
                    hint={uiText("help.executionSection")}
                />

                <div className="grid max-w-3xl gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <FieldLabel help={fh("yieldLoopsAfter")} htmlFor="yieldLoopsAfter">
                            Check runtime after this many loop iterations
                        </FieldLabel>
                        <Input
                            id="yieldLoopsAfter"
                            type="number"
                            className="w-28 shrink-0"
                            min={1}
                            step={1}
                            disabled={disabled}
                            value={configPart?.yieldLoopsAfter ?? ""}
                            onChange={(e) =>
                                setConfigPart((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              yieldLoopsAfter:
                                                  e.target.value === ""
                                                      ? undefined
                                                      : Math.max(
                                                            1,
                                                            Number.parseInt(e.target.value, 10) ||
                                                                0,
                                                        ),
                                          }
                                        : prev,
                                )
                            }
                        />
                    </div>
                </div>

                <div className="grid max-w-3xl gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <FieldLabel help={fh("streamHeartbeat")} htmlFor="streamHeartbeat">
                            Stream heartbeat (sec)
                        </FieldLabel>
                        <Input
                            id="streamHeartbeat"
                            type="number"
                            className="w-28 shrink-0"
                            min={1}
                            step={1}
                            disabled={disabled}
                            value={configPart?.streamHeartbeat ?? ""}
                            onChange={(e) =>
                                setConfigPart((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              streamHeartbeat:
                                                  e.target.value === ""
                                                      ? undefined
                                                      : Math.max(
                                                            1,
                                                            Number.parseInt(e.target.value, 10) ||
                                                                1,
                                                        ),
                                          }
                                        : prev,
                                )
                            }
                        />
                    </div>
                </div>
            </CardContent>
            {unsavedDialog}
            <ActionBar
                onUpdate={() => void onUpdate()}
                dirty={dirty}
                busy={saving}
                disabled={disabled}
            />
        </Card>
    );
}
