import type { KeyboardEvent, ReactNode } from "react";
import { HoverTip } from "@/shared/HoverTip";

export type PaneTab<T extends string> = {
    id: T;
    label: string;
    badge?: ReactNode;
    problem?: boolean;
    lockReason?: string | null;
};

export function PaneTabs<T extends string>({
    idPrefix,
    label,
    tabs,
    value,
    onChange,
    end,
}: {
    idPrefix: string;
    label: string;
    tabs: PaneTab<T>[];
    value: T;
    onChange: (id: T) => void;
    end?: ReactNode;
}) {
    const locked = (tab: PaneTab<T>) => tab.id !== value && Boolean(tab.lockReason);

    const select = (tab: PaneTab<T>) => {
        if (tab.id === value || locked(tab)) return;
        onChange(tab.id);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const i = tabs.findIndex((t) => t.id === value);
        let next: PaneTab<T> | undefined;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (!next) return;
        e.preventDefault();
        if (locked(next)) return;
        select(next);
        document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus();
    };

    return (
        <div className="flex min-h-11 items-center gap-2 border-b pr-2 pl-1">
            <div
                role="tablist"
                aria-label={label}
                onKeyDown={onKeyDown}
                className="flex min-w-0 items-stretch self-stretch overflow-x-auto [scrollbar-width:none]"
            >
                {tabs.map((tab) => {
                    const selected = tab.id === value;
                    const isLocked = locked(tab);
                    return (
                        <HoverTip key={tab.id} tip={isLocked ? tab.lockReason : null}>
                            <button
                                id={`${idPrefix}-tab-${tab.id}`}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                aria-controls={`${idPrefix}-panel-${tab.id}`}
                                aria-disabled={isLocked ? true : undefined}
                                tabIndex={selected ? 0 : -1}
                                onClick={() => select(tab)}
                                className={
                                    "relative flex shrink-0 items-center gap-1.5 px-2 sm:px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset " +
                                    (selected
                                        ? "text-foreground"
                                        : "text-muted-foreground hover:text-foreground") +
                                    (isLocked ? " cursor-not-allowed opacity-50" : "")
                                }
                            >
                                {tab.label}
                                {tab.badge}
                                {tab.problem ? (
                                    <span
                                        aria-label="needs fixing"
                                        className="h-1.5 w-1.5 rounded-full bg-destructive"
                                    />
                                ) : null}
                                {selected ? (
                                    <span
                                        aria-hidden
                                        className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                                    />
                                ) : null}
                            </button>
                        </HoverTip>
                    );
                })}
            </div>
            {end ? <div className="ml-auto flex shrink-0 items-center">{end}</div> : null}
        </div>
    );
}

export function TabCount({ n }: { n: number }) {
    return n > 0 ? (
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {n}
        </span>
    ) : null;
}
