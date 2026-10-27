import { useState, useEffect } from "react";
import * as API from "@/orval/search2o";
import type { ConfigPartResponseModel, EvalAllowlistModel } from "@/orval/search2o.schemas";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";
import { AlertTriangle } from "lucide-react";
import { ActionBar } from "@/shared/ActionBar";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { UpdatedBy } from "@/shared/UpdatedBy";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp } from "@/shared/fieldHelp";
import { uiText } from "@/shared/uiText";
import { LineMarkedTextarea } from "@/shared/LineMarkedTextarea";
import { errorsByLine } from "@/shared/lineErrors";

const entriesOf = (text: string) =>
    text
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

export default function AllowlistConfigModule() {
    const [res, setRes] = useState<ConfigPartResponseModel | null>(null);
    const [model, setModel] = useState<ConfigPartResponseModel | null>(null);
    const [configPart, setConfigPart] = useState<EvalAllowlistModel | null>(null);
    const [text, setText] = useState("");
    const fh = useFieldHelp("EvalAllowlistModel");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

    const dirty =
        configPart !== null &&
        entriesOf(text).join("\n") !== (configPart.allowlist ?? []).join("\n");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const resp = await API.getSystemConfigPart({ part: "allowlist" });
                if (!resp.success) {
                    toast.error(resp.error?.message || "Failed to load allowlist config");
                    return;
                }
                if (!cancelled) {
                    const cp = resp.configValue as EvalAllowlistModel;
                    setRes(resp);
                    setModel(resp);
                    setConfigPart(cp);
                    setText((cp.allowlist || []).join("\n"));
                }
            } catch {
                toast.error("Failed to load allowlist config");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const marks = errorsByLine(text, lineErrors);
    const hasErrors = marks.some(Boolean);

    const onUpdate = async (): Promise<boolean> => {
        if (!model || !configPart) return false;
        setIsSaving(true);
        try {
            const allowlistList = entriesOf(text);

            const nextConfigPart: EvalAllowlistModel = {
                ...configPart,
                type: "allowlist",
                allowlist: allowlistList,
            };

            const resp = await API.updateSystemConfigPart({
                configValue: nextConfigPart,
                configVersion: model.configVersion,
            });

            if (!resp.success) {
                const perLine = resp.errors ?? {};
                setLineErrors(perLine);
                toast.error(
                    Object.keys(perLine).length > 0
                        ? uiText("allowlist.errors")
                        : resp.error?.message || "Failed to update allowlist",
                );
                return false;
            }

            setLineErrors({});
            toast.success(`Allowlist updated. ${uiText("config.appliesToNewRuns")}`);

            setModel({ ...model, configValue: nextConfigPart, configVersion: resp.configVersion });
            setConfigPart(nextConfigPart);
            setText(nextConfigPart.allowlist?.join("\n") || "");
            return true;
        } catch {
            toast.error("Failed to update allowlist");
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const { dialog: unsavedDialog } = useUnsavedChanges({
        isDirty: () => dirty,
        onSave: !isLoading ? onUpdate : undefined,
        what: "page",
    });

    return (
        <Card className="w-full">
            <CardHeader>
                <ModuleCardTitle title="Allowlist" />
                <UpdatedBy obj={res} />
            </CardHeader>

            <CardContent className="space-y-6">
                <Alert className="max-w-3xl border-destructive/50 bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertTitle className="text-destructive line-clamp-none">
                        Anything you add here can be called from any expression inside an agent,
                        including by any developer while validating a draft.
                    </AlertTitle>
                </Alert>

                <div className="space-y-2">
                    <FieldLabel help={fh("allowlist")} htmlFor="allowlist">
                        Functions and objects
                    </FieldLabel>
                    <LineMarkedTextarea
                        id="allowlist"
                        value={text}
                        onChange={setText}
                        lineErrors={marks}
                        placeholder={"builtins.len\nmath.sqrt\ndatetime.datetime"}
                        className="max-h-[60vh] min-h-64"
                        wrapperClassName="max-w-3xl"
                        disabled={isLoading}
                        aria-invalid={hasErrors ? true : undefined}
                    />
                </div>
            </CardContent>

            {unsavedDialog}
            <ActionBar onUpdate={onUpdate} dirty={dirty} busy={isSaving} disabled={isLoading} />
        </Card>
    );
}
