import { forwardRef, useImperativeHandle, useRef } from "react";
import type { PromptScope } from "@/orval/search2o.schemas";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import {
    PROMPT_SCOPES,
    promptScopeHint,
    promptScopeLabel,
    type PromptField,
    type PromptRow,
} from "@/shared/agentPrompts";

export type AgentPromptFieldsHandle = {
    focus: (field: PromptField) => void;
};

export const AgentPromptFields = forwardRef<
    AgentPromptFieldsHandle,
    {
        idPrefix: string;
        value: PromptRow;
        onChange: (patch: Partial<PromptRow>) => void;
        disabled?: boolean;
    }
>(function AgentPromptFields({ idPrefix, value, onChange, disabled }, ref) {
    const fh = useFieldHelp("AgentPromptModel");
    const ft = useFieldTitle("AgentPromptModel");
    const systemRef = useRef<HTMLTextAreaElement>(null);
    const userRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
        focus(field) {
            const el = field === "system" ? systemRef.current : userRef.current;
            el?.scrollIntoView({ block: "center" });
            el?.focus();
        },
    }));

    return (
        <div className="space-y-4">
            <div className="grid gap-2 sm:max-w-xs">
                <FieldLabel help={fh("scope")} htmlFor={`${idPrefix}-scope`}>
                    {ft("scope", "Scope")}
                </FieldLabel>
                <Select
                    value={value.scope}
                    onValueChange={(v) => onChange({ scope: v as PromptScope })}
                    disabled={disabled}
                >
                    <SelectTrigger id={`${idPrefix}-scope`} className="w-full min-w-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PROMPT_SCOPES.map((scope) => (
                            <SelectItem key={scope} value={scope}>
                                {promptScopeLabel(scope)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{promptScopeHint(value.scope)}</p>
            </div>

            <div className="grid gap-2">
                <FieldLabel help={fh("system")} htmlFor={`${idPrefix}-system`}>
                    {ft("system", "System prompt")}
                </FieldLabel>
                <Textarea
                    ref={systemRef}
                    id={`${idPrefix}-system`}
                    value={value.system}
                    onChange={(e) => onChange({ system: e.target.value })}
                    disabled={disabled}
                    spellCheck={false}
                    className="min-h-[120px] font-mono text-xs"
                />
            </div>

            <div className="grid gap-2">
                <FieldLabel help={fh("user")} htmlFor={`${idPrefix}-user`}>
                    {ft("user", "User prompt")}
                </FieldLabel>
                <Textarea
                    ref={userRef}
                    id={`${idPrefix}-user`}
                    value={value.user}
                    onChange={(e) => onChange({ user: e.target.value })}
                    disabled={disabled}
                    spellCheck={false}
                    className="min-h-[160px] font-mono text-xs"
                />
            </div>

            <div className="grid gap-2">
                <FieldLabel help={fh("doc")} htmlFor={`${idPrefix}-doc`}>
                    {ft("doc", "Documentation")}{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Textarea
                    id={`${idPrefix}-doc`}
                    rows={2}
                    value={value.doc}
                    onChange={(e) => onChange({ doc: e.target.value })}
                    disabled={disabled}
                    className="max-w-3xl"
                />
            </div>
        </div>
    );
});
