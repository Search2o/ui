import type { AgentTitleModel } from "@/orval/search2o.schemas";
import { cn } from "@/lib/utils";
import { CornerDownLeft, SearchX } from "lucide-react";
import { uiText } from "@/shared/uiText";

export function AgentSuggestions({
    results,
    selected,
    onSelect,
    onRun,
    idPrefix = "agent-suggestion",
}: {
    results: AgentTitleModel[];
    selected: number;
    onSelect: (index: number) => void;
    onRun: (agent: AgentTitleModel) => void;
    idPrefix?: string;
}) {
    if (results.length === 0) return null;

    const many = results.length > 1;

    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
                {many ? `${results.length} agents match` : "1 agent matches"}
            </p>

            <ul
                role="listbox"
                aria-label="Matching agents"
                className="divide-y divide-border/60 overflow-hidden rounded-xl border bg-card shadow-sm"
            >
                {results.map((agent, index) => {
                    const isSelected = index === selected;
                    return (
                        <li
                            key={agent.agentName}
                            id={`${idPrefix}-${index}`}
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => onSelect(index)}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onRun(agent);
                            }}
                            className={cn(
                                "flex cursor-pointer items-center gap-3 px-4 py-3",
                                isSelected ? "bg-accent text-accent-foreground" : "text-foreground",
                            )}
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    "h-8 w-1 shrink-0 rounded-full",
                                    isSelected ? "bg-primary" : "bg-transparent",
                                )}
                            />

                            <span className="min-w-0 flex-1">
                                <span
                                    className={cn(
                                        "block truncate text-sm",
                                        isSelected && "font-medium",
                                    )}
                                >
                                    {agent.agentTitle || agent.agentName}
                                </span>
                                {agent.agentTitle && agent.agentTitle !== agent.agentName ? (
                                    <span className="block truncate font-mono text-xs text-muted-foreground">
                                        {agent.agentName}
                                    </span>
                                ) : null}
                            </span>

                            {isSelected ? (
                                <span className="flex shrink-0 items-center gap-1 rounded-md border border-current/20 px-1.5 py-0.5 text-[11px] font-medium">
                                    <CornerDownLeft className="h-3 w-3" />
                                    Enter
                                </span>
                            ) : null}
                        </li>
                    );
                })}
            </ul>

            {many ? <p className="text-xs text-muted-foreground">↑ ↓ to choose another</p> : null}
        </div>
    );
}

export function NoAgentMatch() {
    return (
        <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-dashed bg-card px-4 py-4"
        >
            <SearchX className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
                <p className="text-sm font-medium">No agent matches this question</p>
                <p className="text-sm text-muted-foreground">{uiText("search.noMatchHint")}</p>
            </div>
        </div>
    );
}
