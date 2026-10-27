import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Composer = forwardRef<
    HTMLTextAreaElement,
    TextareaHTMLAttributes<HTMLTextAreaElement> & {
        options?: ReactNode;
        action?: ReactNode;
    }
>(function Composer({ options, action, className, ...textarea }, ref) {
    return (
        <div className="rounded-xl border bg-background shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
            <textarea
                ref={ref}
                {...textarea}
                className={cn(
                    "block w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60",
                    className,
                )}
            />
            <div className="flex items-center gap-2 px-2 pb-2">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">{options}</div>
                {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
            </div>
        </div>
    );
});
