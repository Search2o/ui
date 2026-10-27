import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/shared/FieldLabel";
import { AgentPromptFields, type AgentPromptFieldsHandle } from "@/shared/AgentPromptFields";
import {
    newPromptRow,
    promptRowError,
    type PromptField,
    type PromptRow,
} from "@/shared/agentPrompts";
import { PROMPT_NAME } from "@/shared/schemaRules";
import { uiText } from "@/shared/uiText";

export type DraftPromptsHandle = {
    reveal: (name: string, field?: PromptField) => boolean;
    add: () => void;
};

export const DraftPrompts = forwardRef<
    DraftPromptsHandle,
    {
        value: PromptRow[];
        onChange: (next: PromptRow[]) => void;
        disabled?: boolean;
    }
>(function DraftPrompts({ value, onChange, disabled }, ref) {
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const fieldRefs = useRef<Record<string, AgentPromptFieldsHandle | null>>({});
    const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const nameRefs = useRef<Record<string, HTMLInputElement | null>>({});

    useImperativeHandle(ref, () => ({
        reveal(name, field) {
            const row = value.find((r) => r.name.trim() === name);
            if (!row) return false;
            setOpen((prev) => ({ ...prev, [row.uiId]: true }));
            requestAnimationFrame(() => {
                if (field) fieldRefs.current[row.uiId]?.focus(field);
                else rowRefs.current[row.uiId]?.scrollIntoView({ block: "center" });
            });
            return true;
        },
        add() {
            const row = newPromptRow(value);
            onChange([...value, row]);
            setOpen((prev) => ({ ...prev, [row.uiId]: true }));
            requestAnimationFrame(() => {
                nameRefs.current[row.uiId]?.focus();
                nameRefs.current[row.uiId]?.select();
            });
        },
    }));

    const update = (uiId: string, patch: Partial<PromptRow>) =>
        onChange(value.map((r) => (r.uiId === uiId ? { ...r, ...patch } : r)));

    if (value.length === 0) {
        return (
            <p className="px-4 py-3 text-xs text-muted-foreground">
                {uiText("empty.draftPrompts")}
            </p>
        );
    }

    return (
        <div className="divide-y">
            {value.map((row) => {
                const isOpen = !!open[row.uiId];
                const idPrefix = `draft-${row.uiId}`;
                const problem = promptRowError(row);
                const shownName = row.name.trim();
                return (
                    <div
                        key={row.uiId}
                        ref={(el) => {
                            rowRefs.current[row.uiId] = el;
                        }}
                    >
                        <div className="flex items-center gap-1 pr-2 pl-1">
                            <button
                                type="button"
                                aria-expanded={isOpen}
                                aria-controls={`${idPrefix}-body`}
                                onClick={() =>
                                    setOpen((prev) => ({ ...prev, [row.uiId]: !isOpen }))
                                }
                                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <ChevronRight
                                    aria-hidden
                                    className={
                                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
                                        (isOpen ? "rotate-90" : "")
                                    }
                                />
                                <span
                                    className={
                                        "shrink-0 font-mono text-sm" +
                                        (shownName ? "" : " italic text-muted-foreground")
                                    }
                                >
                                    {shownName || "unnamed"}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {row.scope}
                                </span>
                                {row.doc.trim() ? (
                                    <span className="hidden min-w-0 truncate text-xs text-muted-foreground md:inline">
                                        — {row.doc.trim()}
                                    </span>
                                ) : null}
                            </button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                aria-label={`Delete prompt ${shownName}`}
                                disabled={disabled}
                                onClick={() => onChange(value.filter((r) => r.uiId !== row.uiId))}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        {problem ? (
                            <p className="px-10 pb-2 text-xs text-destructive">{problem}</p>
                        ) : null}
                        <div
                            id={`${idPrefix}-body`}
                            hidden={!isOpen}
                            className="space-y-4 px-4 pt-1 pb-4"
                        >
                            <div className="grid gap-2 sm:max-w-xs">
                                <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
                                <Input
                                    ref={(el) => {
                                        nameRefs.current[row.uiId] = el;
                                    }}
                                    id={`${idPrefix}-name`}
                                    value={row.name}
                                    onChange={(e) => update(row.uiId, { name: e.target.value })}
                                    maxLength={PROMPT_NAME.maxLength}
                                    spellCheck={false}
                                    disabled={disabled}
                                    aria-invalid={problem !== null}
                                    className="font-mono"
                                />
                            </div>
                            <AgentPromptFields
                                ref={(h) => {
                                    fieldRefs.current[row.uiId] = h;
                                }}
                                idPrefix={idPrefix}
                                value={row}
                                onChange={(patch) => update(row.uiId, patch)}
                                disabled={disabled}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
});
