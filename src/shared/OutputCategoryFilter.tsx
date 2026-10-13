import { Checkbox } from "@/components/ui/checkbox";
import { HoverTip } from "@/shared/HoverTip";
import { cn } from "@/lib/utils";
import {
    OUTPUT_CATEGORY_INFO,
    OUTPUT_CATEGORY_ORDER,
    outputCategoryHint,
    type OutputCategory,
} from "@/shared/outputCategories";

const LINK_CLASS =
    "text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline";

export function OutputCategoryFilter({
    selected,
    counts,
    onToggle,
    onShowAll,
    onHideAll,
}: {
    selected: ReadonlySet<OutputCategory>;
    counts: Partial<Record<OutputCategory, number>>;
    onToggle: (category: OutputCategory) => void;
    onShowAll: () => void;
    onHideAll: () => void;
}) {
    const anyHidden = OUTPUT_CATEGORY_ORDER.some(
        (category) => (counts[category] ?? 0) > 0 && !selected.has(category),
    );
    const anyShown = OUTPUT_CATEGORY_ORDER.some(
        (category) => (counts[category] ?? 0) > 0 && selected.has(category),
    );

    return (
        <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Validation output categories"
        >
            {OUTPUT_CATEGORY_ORDER.map((category) => {
                const info = OUTPUT_CATEGORY_INFO[category];
                const count = counts[category] ?? 0;
                const isOn = selected.has(category);
                const empty = count === 0;
                const id = `output-filter-${category}`;

                return (
                    <HoverTip
                        key={category}
                        tip={
                            empty
                                ? `${outputCategoryHint(category)} Nothing of this kind in this run.`
                                : outputCategoryHint(category)
                        }
                        wrap
                    >
                        <label
                            htmlFor={id}
                            className={cn(
                                "inline-flex select-none items-center gap-1.5 rounded-full border py-0.5 pl-1.5 pr-2 text-[11px] transition-colors",
                                isOn && !empty
                                    ? "border-transparent " + info.tone
                                    : "border-border bg-transparent text-muted-foreground",
                                empty ? "cursor-default opacity-45" : "cursor-pointer",
                                !empty && !isOn && "hover:bg-muted",
                            )}
                        >
                            <Checkbox
                                id={id}
                                aria-label={info.label}
                                checked={isOn}
                                disabled={empty}
                                onCheckedChange={() => onToggle(category)}
                                className="h-3 w-3 rounded-[3px]"
                            />
                            <info.Icon className="h-3 w-3" />
                            {info.label}
                            <span className="tabular-nums opacity-70">{count}</span>
                        </label>
                    </HoverTip>
                );
            })}

            {anyHidden || anyShown ? (
                <span className="ml-1 flex items-center gap-2">
                    {anyHidden ? (
                        <button type="button" onClick={onShowAll} className={LINK_CLASS}>
                            Show all
                        </button>
                    ) : null}
                    {anyShown ? (
                        <button type="button" onClick={onHideAll} className={LINK_CLASS}>
                            Hide all
                        </button>
                    ) : null}
                </span>
            ) : null}
        </div>
    );
}
