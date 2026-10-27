import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FieldLabel } from "@/shared/FieldLabel";
import { useApiConnectionPoolNames } from "@/shared/apiConnectionPoolNames";

export function ConnectionPoolNameField({
    id,
    value,
    onChange,
    help,
    disabled,
    label = "Connection pool",
    className,
}: {
    id: string;
    value: string;
    onChange: (next: string) => void;
    help?: string;
    disabled?: boolean;
    label?: string;
    className?: string;
}) {
    const { names, error } = useApiConnectionPoolNames();

    const current = value?.trim();
    const missing = Boolean(current) && names.length > 0 && !names.includes(current);
    const options = missing ? [current, ...names] : names;

    return (
        <div className={cn("grid min-w-0 gap-2", className)}>
            <FieldLabel help={help} htmlFor={id}>
                {label}
            </FieldLabel>
            <Select value={current ?? ""} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger
                    id={id}
                    className="w-full min-w-0 *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate"
                >
                    <SelectValue placeholder="Select a pool" />
                </SelectTrigger>
                <SelectContent>
                    {options.map((name) => (
                        <SelectItem key={name} value={name}>
                            {name}
                            {missing && name === current ? " — not defined" : ""}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {missing ? (
                <p className="text-xs text-destructive">
                    No pool named “{current}” exists any more. Pick another, or recreate it under
                    System → API connection pools.
                </p>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
    );
}
