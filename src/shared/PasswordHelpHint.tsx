import { cn } from "@/lib/utils";
import { usePasswordHelp } from "@/shared/passwordHelp";

export function PasswordHelpHint({ className }: { className?: string }) {
    const help = usePasswordHelp();
    if (!help) return null;

    return <p className={cn("text-xs text-muted-foreground", className)}>{help}</p>;
}
