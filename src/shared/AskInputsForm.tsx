import { useEffect, useMemo, useState } from "react";
import { CircleCheck } from "lucide-react";
import type { AskInputModel } from "@/orval/search2o.schemas";
import {
    blockKey,
    flattenAskBlocks,
    initialAnswers,
    nestAnswers,
    type AskAnswers,
    type AskBlockAnswers,
    type AskBlocks,
} from "@/shared/askBlocks";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export type { AskAnswers, AskBlockAnswers, AskBlocks } from "@/shared/askBlocks";

export function AskInputsForm({
    askInput,
    agentName,
    disabled = false,
    onSubmit,
}: {
    askInput: AskBlocks;
    agentName?: string | null;
    disabled?: boolean;
    onSubmit: (answers: AskBlockAnswers) => void;
}) {
    const blocks = useMemo(() => flattenAskBlocks(askInput), [askInput]);
    const [values, setValues] = useState<Record<string, AskAnswers>>(() => initialAnswers(blocks));

    useEffect(() => {
        setValues(initialAnswers(blocks));
    }, [blocks]);

    const setValue = (key: string, name: string, value: string | string[]) =>
        setValues((prev) => ({ ...prev, [key]: { ...prev[key], [name]: value } }));

    const toggleMany = (key: string, name: string, option: string, checked: boolean) =>
        setValues((prev) => {
            const current = new Set((prev[key]?.[name] ?? []) as string[]);
            if (checked) current.add(option);
            else current.delete(option);
            return { ...prev, [key]: { ...prev[key], [name]: [...current] } };
        });

    const several = blocks.length > 1;

    return (
        <div className="rounded-xl border border-primary/40 bg-primary/5 px-3 py-3 shadow-sm">
            {agentName ? (
                <div className="text-xs text-muted-foreground">
                    Waiting on you: <span className="font-mono">{agentName}</span>
                </div>
            ) : null}

            <fieldset disabled={disabled} className="space-y-5">
                {blocks.map((b, index) => {
                    const key = blockKey(b.path);
                    const inputs = b.block.inputs ?? [];
                    return (
                        <section
                            key={key}
                            aria-label={several ? `Question ${index + 1}` : undefined}
                            className={several && index > 0 ? "border-t pt-4" : undefined}
                        >
                            {several ? (
                                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    Question {index + 1} of {blocks.length}
                                </div>
                            ) : null}
                            <div className="text-sm font-medium">
                                {b.block.message || "Please provide these inputs"}
                            </div>

                            <div className="mt-4 space-y-4">
                                {inputs
                                    .filter((input) => !input.hidden)
                                    .map((input) => (
                                        <AskField
                                            key={input.name}
                                            id={`ask-${key}-${input.name}`}
                                            input={input}
                                            value={values[key]?.[input.name]}
                                            disabled={disabled}
                                            onChange={(v) => setValue(key, input.name, v)}
                                            onToggle={(option, checked) =>
                                                toggleMany(key, input.name, option, checked)
                                            }
                                        />
                                    ))}
                            </div>
                        </section>
                    );
                })}
            </fieldset>

            <div className="mt-4 flex justify-end">
                <Button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSubmit(nestAnswers(blocks, values))}
                >
                    <CircleCheck className="h-4 w-4" />
                    Submit
                </Button>
            </div>
        </div>
    );
}

function AskField({
    id,
    input,
    value,
    disabled,
    onChange,
    onToggle,
}: {
    id: string;
    input: AskInputModel;
    value: string | string[] | undefined;
    disabled: boolean;
    onChange: (value: string) => void;
    onToggle: (option: string, checked: boolean) => void;
}) {
    const label = input.label || input.name;
    const description = input.description ?? "";
    const options = input.options ?? [];
    const describeAbove = input.type === "chooseOne" || input.type === "chooseMany";

    return (
        <div className="space-y-2">
            <div className="space-y-1">
                <Label className="text-sm" htmlFor={id}>
                    {label}
                </Label>
                {describeAbove && description ? (
                    <div className="text-xs text-muted-foreground">{description}</div>
                ) : null}
            </div>

            {input.type === "chooseOne" ? (
                <Select
                    value={(value as string) ?? ""}
                    onValueChange={onChange}
                    disabled={disabled}
                >
                    <SelectTrigger id={id} className="w-full">
                        <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((option) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : input.type === "chooseMany" ? (
                <div className="space-y-2 rounded-xl border bg-background/40 p-3">
                    {options.map((option) => (
                        <label key={option} className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={Array.isArray(value) ? value.includes(option) : false}
                                onCheckedChange={(checked) => onToggle(option, checked === true)}
                            />
                            <span className="break-words">{option}</span>
                        </label>
                    ))}
                </div>
            ) : input.type === "text" ? (
                <Textarea
                    id={id}
                    name={`agent-input-${input.name}`}
                    autoComplete="off"
                    value={(value as string) ?? ""}
                    placeholder={description || undefined}
                    onChange={(e) => onChange(e.target.value)}
                />
            ) : (
                <Input
                    id={id}
                    type={input.type === "password" ? "password" : "text"}
                    name={`agent-input-${input.name}`}
                    autoComplete={input.type === "password" ? "new-password" : "off"}
                    value={(value as string) ?? ""}
                    placeholder={description || undefined}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}
        </div>
    );
}
