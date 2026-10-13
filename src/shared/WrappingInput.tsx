import type { ChangeEvent, ComponentProps } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function WrappingInput({
    className,
    onValueChange,
    ...props
}: Omit<ComponentProps<"textarea">, "onChange" | "rows"> & {
    onValueChange: (value: string) => void;
}) {
    return (
        <Textarea
            rows={1}
            className={cn("min-h-9 min-w-0 resize-none break-all py-1.5", className)}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                onValueChange(e.target.value.replace(/[\r\n]+/g, ""))
            }
            {...props}
        />
    );
}
