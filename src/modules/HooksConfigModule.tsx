import { useState, useEffect } from "react";
import * as API from "@/orval/search2o";
import type {
    AgentConfigPart,
    ConfigPartResponseModel,
    HooksModel,
} from "@/orval/search2o.schemas";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";
import { ActionBar } from "@/shared/ActionBar";
import { useSavedBaseline } from "@/shared/savedBaseline";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { UpdatedBy } from "@/shared/UpdatedBy";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import { uiText } from "@/shared/uiText";
import { IMPORT_PATH } from "@/shared/schemaRules";
import {
    HOOK_GROUPS,
    VALIDATOR_PARTS,
    examplePath,
    formToHooks,
    hasInvalidPaths,
    hooksToForm,
    invalidPaths,
    type HookKey,
    type HooksForm,
} from "@/shared/hooksForm";

const FALLBACK_LABELS: Record<HookKey, string> = {
    onStart: "On server start",
    onEnd: "On server stop",
    onAgentStart: "On agent start",
    onAgentEnd: "On agent end",
    onAgentError: "On agent error",
    onAgentPublish: "On agent publish",
    onAgentDelete: "On agent delete",
    save: "Save conversation state",
    restore: "Restore conversation state",
    deleteConversation: "Delete conversation state",
    vault: "Secrets vault",
    encryptionKey: "Encryption key",
    beforeLlmCall: "Before an LLM call",
    afterLlmCall: "After an LLM call",
    beforeApiCall: "Before an API call",
};

const PART_LABELS: Partial<Record<AgentConfigPart, string>> = {
    llm: "LLM profiles",
    api: "API profiles",
    mcp: "MCP servers",
    db: "Database profiles",
};

export default function HooksConfigModule() {
    const fh = useFieldHelp("HooksModel");
    const ft = useFieldTitle("HooksModel");
    const [loaded, setLoaded] = useState<ConfigPartResponseModel | null>(null);
    const [form, setForm] = useState<HooksForm | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const { dirty, markSaved } = useSavedBaseline(form);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const resp = await API.getSystemConfigPart({ part: "hooks" });
                if (!resp.success) {
                    toast.error(resp.error?.message || "Failed to load the hooks.");
                    return;
                }
                if (cancelled) return;
                const next = hooksToForm(resp.configValue as HooksModel);
                setLoaded(resp);
                setForm(next);
                markSaved(next);
            } catch {
                toast.error("Failed to load the hooks.");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [markSaved]);

    const onUpdate = async (): Promise<boolean> => {
        if (!loaded || !form || hasInvalidPaths(form)) return false;
        setIsSaving(true);
        try {
            const nextConfigPart = formToHooks(form);
            const resp = await API.updateSystemConfigPart({
                configValue: nextConfigPart,
                configVersion: loaded.configVersion,
            });
            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to update the hooks.");
                return false;
            }
            toast.success(uiText("config.hooksUpdated"));
            setLoaded({
                ...loaded,
                configValue: nextConfigPart,
                configVersion: resp.configVersion,
            });
            const saved = hooksToForm(nextConfigPart);
            setForm(saved);
            markSaved(saved);
            return true;
        } catch {
            toast.error("Failed to update the hooks.");
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const setHook = (key: HookKey, value: string) =>
        setForm((prev) => (prev ? { ...prev, hooks: { ...prev.hooks, [key]: value } } : prev));
    const setValidator = (part: AgentConfigPart, value: string) =>
        setForm((prev) =>
            prev ? { ...prev, validators: { ...prev.validators, [part]: value } } : prev,
        );

    const invalid = form ? invalidPaths(form) : { hooks: [], adapters: [], validators: [] };
    const anyInvalid = form ? hasInvalidPaths(form) : false;

    const pathInput = (
        id: string,
        example: string,
        value: string,
        bad: boolean,
        onChange: (v: string) => void,
    ) => (
        <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={examplePath(example)}
            maxLength={IMPORT_PATH.maxLength}
            aria-invalid={bad || undefined}
            className="font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
            disabled={isLoading}
        />
    );

    const { dialog: unsavedDialog } = useUnsavedChanges({
        isDirty: () => dirty,
        onSave: !(isLoading || anyInvalid) ? onUpdate : undefined,
        what: "page",
    });

    return (
        <Card className="w-full">
            <CardHeader>
                <ModuleCardTitle title="Hooks" />
                <UpdatedBy obj={loaded} />
            </CardHeader>

            <CardContent className="space-y-8">
                {HOOK_GROUPS.map((group) => (
                    <section key={group.title} className="space-y-3">
                        <div className="text-sm font-medium">{group.title}</div>
                        <div className="grid max-w-4xl gap-4 md:grid-cols-2">
                            {group.keys.map((key) => (
                                <div key={key} className="grid gap-2">
                                    <FieldLabel help={fh(key)} htmlFor={`hook-${key}`}>
                                        {ft(key, FALLBACK_LABELS[key])}
                                    </FieldLabel>
                                    {pathInput(
                                        `hook-${key}`,
                                        key,
                                        form?.hooks[key] ?? "",
                                        invalid.hooks.includes(key),
                                        (v) => setHook(key, v),
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                <section className="space-y-3">
                    <div className="grid max-w-4xl gap-2">
                        <FieldLabel help={fh("llmAdapters")} htmlFor="hook-llmAdapters">
                            {ft("llmAdapters", "LLM adapters")}
                        </FieldLabel>
                        <Textarea
                            id="hook-llmAdapters"
                            value={form?.llmAdapters ?? ""}
                            onChange={(e) =>
                                setForm((prev) =>
                                    prev ? { ...prev, llmAdapters: e.target.value } : prev,
                                )
                            }
                            placeholder={"mycompany.llm.MyVendorAdapter\none import path per line"}
                            aria-invalid={invalid.adapters.length > 0 || undefined}
                            className="min-h-24 font-mono text-xs"
                            spellCheck={false}
                            disabled={isLoading}
                        />
                    </div>
                </section>

                <section className="space-y-3">
                    <FieldLabel help={fh("agentConfigValidators")}>
                        {ft("agentConfigValidators", "Agent configuration validators")}
                    </FieldLabel>
                    <div className="grid max-w-4xl gap-4 md:grid-cols-2">
                        {VALIDATOR_PARTS.map((part) => (
                            <div key={part} className="grid gap-2">
                                <FieldLabel htmlFor={`validator-${part}`}>
                                    {PART_LABELS[part] ?? part}
                                </FieldLabel>
                                {pathInput(
                                    `validator-${part}`,
                                    `validate_${part}`,
                                    form?.validators[part] ?? "",
                                    invalid.validators.includes(part),
                                    (v) => setValidator(part, v),
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </CardContent>

            {unsavedDialog}
            <ActionBar
                onUpdate={onUpdate}
                dirty={dirty}
                busy={isSaving}
                disabled={isLoading || anyInvalid}
                message={anyInvalid ? uiText("validate.importPath") : undefined}
            />
        </Card>
    );
}
