import { useState, type ComponentProps } from "react";
import { HoverTip } from "@/shared/HoverTip";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
    className,
    disabled,
    ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative">
            <Input
                {...props}
                type={visible ? "text" : "password"}
                disabled={disabled}
                className={cn("pr-10", className)}
            />
            <HoverTip tip={visible ? "Hide password" : "Show password"}>
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    disabled={disabled}
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </HoverTip>
        </div>
    );
}
