import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TapTip, TOUCH_ONLY } from "@/shared/TapTip";
import { useMediaQuery } from "@/shared/useMediaQuery";

export function FieldLabel({
    children,
    help,
    htmlFor,
    className,
    helpClassName,
    helpSide = "top",
}: {
    children: ReactNode;
    help?: ReactNode;
    htmlFor?: string;
    className?: string;
    helpClassName?: string;
    helpSide?: "top" | "right" | "bottom" | "left";
}) {
    const touch = useMediaQuery(TOUCH_ONLY);
    if (!help) {
        return (
            <Label htmlFor={htmlFor} className={className}>
                {children}
            </Label>
        );
    }

    if (touch) {
        return (
            <TapTip tip={help} side={helpSide} align="start" className={helpClassName}>
                <Label htmlFor={htmlFor} className={className}>
                    {children}
                </Label>
            </TapTip>
        );
    }
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Label htmlFor={htmlFor} className={cn("cursor-help", className)}>
                        {children}
                    </Label>
                </TooltipTrigger>
                <TooltipContent
                    side={helpSide}
                    align="start"
                    className={cn("max-w-sm", helpClassName)}
                >
                    {help}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
