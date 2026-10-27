import { useState } from "react";

export function UsedByAgents({
    names,
    onOpen,
    collapsedCount = 6,
}: {
    names: string[];
    onOpen: (agentName: string) => void;
    collapsedCount?: number;
}) {
    const [showAll, setShowAll] = useState(false);
    if (names.length === 0) return null;
    const shown = showAll ? names : names.slice(0, collapsedCount);

    return (
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <span>
                Used by {names.length} agent{names.length === 1 ? "" : "s"}:
            </span>
            {shown.map((agentName) => (
                <button
                    key={agentName}
                    type="button"
                    className="rounded border px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
                    onClick={() => onOpen(agentName)}
                >
                    {agentName}
                </button>
            ))}
            {names.length > collapsedCount ? (
                <button
                    type="button"
                    className="rounded px-1 py-0.5 hover:bg-accent hover:text-foreground"
                    onClick={() => setShowAll((v) => !v)}
                >
                    {showAll ? "Show fewer" : `+${names.length - collapsedCount} more`}
                </button>
            ) : null}
        </div>
    );
}
