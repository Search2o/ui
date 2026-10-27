import type { ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TapTip, TOUCH_ONLY } from "@/shared/TapTip";
import { useMediaQuery } from "@/shared/useMediaQuery";

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
    const touch = useMediaQuery(TOUCH_ONLY);
    if (!tip) return children;
    if (touch) {
        if (!wrap && isControl(children)) return children;
        return (
            <TapTip tip={tip} side={side}>
                {wrap ? <span className="inline-flex">{children}</span> : children}
            </TapTip>
        );
    }

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

function isControl(el: ReactElement): boolean {
    const props = el.props as { onClick?: unknown; href?: unknown; type?: unknown };
    if (typeof el.type === "string") {
        return ["a", "button", "input", "select", "textarea"].includes(el.type);
    }
    return props.onClick !== undefined || props.href !== undefined || props.type !== undefined;
}
