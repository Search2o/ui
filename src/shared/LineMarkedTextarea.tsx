import { useState, type ComponentProps } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"textarea">, "value" | "onChange"> & {
    value: string;
    onChange: (value: string) => void;
    lineErrors: (string | null)[];
    wrapperClassName?: string;
};

const FONT = "font-mono text-sm md:text-sm leading-6";

export function LineMarkedTextarea({
    value,
    onChange,
    lineErrors,
    className,
    wrapperClassName,
    ...rest
}: Props) {
    const [scroll, setScroll] = useState({ top: 0, left: 0 });
    const lines = value.split("\n");
    const anyMarked = lineErrors.some(Boolean);

    return (
        <div className={cn("relative", wrapperClassName)}>
            {anyMarked && (
                <div
                    aria-hidden
                    data-testid="line-marks"
                    className={cn(
                        "pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent px-3 py-2",
                        FONT,
                    )}
                >
                    <div style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}>
                        {lines.map((line, i) => {
                            const message = lineErrors[i];
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "-mx-3 flex h-6 items-center px-3 whitespace-pre",
                                        message && "bg-destructive/10 dark:bg-destructive/25",
                                    )}
                                >
                                    <span className="text-transparent">{line}</span>
                                    {message && (
                                        <span className="ml-4 min-w-0 truncate font-sans text-xs text-destructive dark:text-red-300">
                                            {message}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            <Textarea
                {...rest}
                value={value}
                wrap="off"
                spellCheck={false}
                onChange={(e) => onChange(e.target.value)}
                onScroll={(e) =>
                    setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft })
                }
                className={cn("relative whitespace-pre", FONT, className)}
            />
        </div>
    );
}
