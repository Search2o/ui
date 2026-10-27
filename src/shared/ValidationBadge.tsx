import type { ReactNode } from "react";
import { CircleCheck, CircleDashed, Loader2, XCircle } from "lucide-react";
import type { ValidationStatus } from "@/shared/validationStatus";

export function StatusChip({ className, children }: { className: string; children: ReactNode }) {
    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
        >
            {children}
        </span>
    );
}

export function ValidationBadge({ status }: { status: ValidationStatus }) {
    switch (status) {
        case "validating":
            return (
                <StatusChip className="border-border text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    Validating
                </StatusChip>
            );
        case "failed":
            return (
                <StatusChip className="border-destructive/40 bg-destructive/10 text-destructive">
                    <XCircle className="h-3 w-3" aria-hidden />
                    Failed
                </StatusChip>
            );
        case "validated":
            return (
                <StatusChip className="border-primary/40 bg-primary/10 text-primary">
                    <CircleCheck className="h-3 w-3" aria-hidden />
                    Validated
                </StatusChip>
            );
        default:
            return (
                <StatusChip className="border-border text-muted-foreground">
                    <CircleDashed className="h-3 w-3" aria-hidden />
                    Not validated
                </StatusChip>
            );
    }
}
