import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const TOUCH_ONLY = "(hover: none)";

export function TapTip({
    tip,
    children,
    side = "top",
    align = "center",
    className,
}: {
    tip: ReactNode;
    children: ReactElement;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    className?: string;
}) {
    return (
        <Popover>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent
                side={side}
                align={align}
                className={cn(
                    "w-fit max-w-[min(24rem,calc(100vw-2rem))] border-0 bg-foreground px-3 py-1.5 text-xs text-balance text-background",
                    className,
                )}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onFocusOutside={(e) => e.preventDefault()}
            >
                {tip}
            </PopoverContent>
        </Popover>
    );
}
