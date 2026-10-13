import type { ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function HoverTip({
    tip,
    children,
    side = "top",
    wrap = false,
}: {
    tip?: string | null;
    children: ReactElement;
    side?: "top" | "right" | "bottom" | "left";
    wrap?: boolean;
}) {
    if (!tip) return children;

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {wrap ? <span className="inline-flex">{children}</span> : children}
                </TooltipTrigger>
                <TooltipContent side={side} className="max-w-sm">
                    {tip}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
