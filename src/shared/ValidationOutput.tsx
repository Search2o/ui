import { useMemo } from "react";
import { Terminal } from "lucide-react";
import { HoverTip } from "@/shared/HoverTip";
import { OutputCategoryFilter } from "@/shared/OutputCategoryFilter";
import {
    DEFAULT_OUTPUT_CATEGORIES,
    OUTPUT_CATEGORY_INFO,
    type OutputCategory,
} from "@/shared/outputCategories";
import { categoryOf, formatTraceAge, type TraceItem } from "@/shared/draftEdit";

export function ValidationOutput({
    items,
    shown,
    onShownChange,
    running,
    canClear,
    onStop,
    onClear,
    onOpenPath,
}: {
    items: TraceItem[];
    shown: Set<OutputCategory>;
    onShownChange: (shown: Set<OutputCategory>) => void;
    running: boolean;
    canClear: boolean;
    onStop: () => void;
    onClear: () => void;
    onOpenPath: (path: string) => void;
}) {
    const counts = useMemo(() => {
        const out: Partial<Record<OutputCategory, number>> = {};
        for (const item of items) {
            const key = categoryOf(item);
            out[key] = (out[key] ?? 0) + 1;
        }
        return out;
    }, [items]);

    const visible = useMemo(
        () => items.filter((item) => shown.has(categoryOf(item))),
        [items, shown],
    );
    const hiddenCount = items.length - visible.length;

    const toggle = (category: OutputCategory) => {
        const next = new Set(shown);
        if (next.has(category)) next.delete(category);
        else next.add(category);
        onShownChange(next);
    };

    return (
        <div>
            <div className="flex h-9 items-center gap-2 border-b bg-muted/40 px-3">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Validation output</span>
                {items.length > 0 ? (
                    <span className="text-[11px] text-muted-foreground">
                        {visible.length} {visible.length === 1 ? "event" : "events"}
                        {hiddenCount > 0 ? (
                            <span className="opacity-70"> · {hiddenCount} hidden</span>
                        ) : null}
                    </span>
                ) : null}
                <span className="flex-1" />
                {running ? (
                    <div className="inline-flex items-center gap-2 rounded-md border bg-muted/40 py-1.5 pl-3 pr-1 text-xs text-muted-foreground shadow-sm">
                        <span className="inline-flex gap-1" aria-hidden="true">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-pulse" />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-pulse [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-pulse [animation-delay:300ms]" />
                        </span>
                        <span>Validating</span>
                        <button
                            type="button"
                            onClick={onStop}
                            className="rounded px-2 py-0.5 font-medium text-destructive transition-colors hover:bg-destructive/10"
                        >
                            Stop
                        </button>
                    </div>
                ) : null}
                {!running && canClear ? (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                        Clear
                    </button>
                ) : null}
            </div>
            {items.length > 0 ? (
                <div className="border-b bg-muted/20 px-3 py-2">
                    <OutputCategoryFilter
                        selected={shown}
                        counts={counts}
                        onToggle={toggle}
                        onShowAll={() => onShownChange(new Set(DEFAULT_OUTPUT_CATEGORIES))}
                        onHideAll={() => onShownChange(new Set())}
                    />
                </div>
            ) : null}

            <div className="space-y-1.5 p-3">
                {items.length === 0 ? null : visible.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                        Every category is hidden. {items.length}{" "}
                        {items.length === 1 ? "event is" : "events are"} still here — tick a
                        category above, or use “Show all”.
                    </div>
                ) : (
                    visible.map((item) => (
                        <OutputLine key={item.id} item={item} onOpenPath={onOpenPath} />
                    ))
                )}
            </div>
        </div>
    );
}

function OutputLine({ item, onOpenPath }: { item: TraceItem; onOpenPath: (path: string) => void }) {
    const { label, tone, Icon } = OUTPUT_CATEGORY_INFO[categoryOf(item)];
    const path = item.path;
    return (
        <div className="flex items-start gap-2 text-sm">
            <HoverTip tip={label}>
                <span
                    className={
                        "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] " +
                        tone
                    }
                >
                    <Icon className="h-3 w-3" />
                </span>
            </HoverTip>

            <span className="mt-0.5 w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {item.duration != null ? formatTraceAge(item.duration) : ""}
            </span>

            <div className="min-w-0 flex-1">
                {item.node}
                {path ? (
                    <TracePath
                        path={path}
                        onOpenPath={onOpenPath}
                        className="mt-0.5 block max-w-full md:hidden"
                    />
                ) : null}
            </div>

            {path ? (
                <TracePath
                    path={path}
                    onOpenPath={onOpenPath}
                    className="mt-0.5 hidden max-w-[14rem] shrink-0 md:block"
                />
            ) : null}
        </div>
    );
}

function TracePath({
    path,
    onOpenPath,
    className,
}: {
    path: string;
    onOpenPath: (path: string) => void;
    className: string;
}) {
    return (
        <HoverTip tip={`${path} — click to show it in the definition`}>
            <button
                type="button"
                onClick={() => onOpenPath(path)}
                className={
                    "truncate rounded font-mono text-[11px] text-muted-foreground/80 underline-offset-2 transition-colors hover:text-foreground hover:underline " +
                    className
                }
            >
                {path}
            </button>
        </HoverTip>
    );
}
