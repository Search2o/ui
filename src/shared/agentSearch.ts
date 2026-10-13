import { useCallback, useState } from "react";
import type { KeyboardEvent } from "react";
import type { AgentTitleModel } from "@/orval/search2o.schemas";
import { FollowupBehavior, SearchBehavior } from "@/shared/searchOptions";

export type MatchOutcome =
    | { kind: "run"; agentName: string }
    | { kind: "show"; results: AgentTitleModel[] }
    | { kind: "noMatch" };

export function decideSearch(results: AgentTitleModel[], behavior: SearchBehavior): MatchOutcome {
    if (results.length === 0) return { kind: "noMatch" };
    if (behavior === SearchBehavior.showResults) return { kind: "show", results };
    if (behavior === SearchBehavior.executeOnlyMatch && results.length > 1) {
        return { kind: "show", results };
    }
    return { kind: "run", agentName: results[0].agentName };
}

function withPrevious(
    results: AgentTitleModel[],
    previous: AgentTitleModel | null,
): AgentTitleModel[] {
    if (!previous) return results;
    return results.some((r) => r.agentName === previous.agentName)
        ? results
        : [...results, previous];
}

export function followupNeedsSearch(behavior: FollowupBehavior): boolean {
    return behavior !== FollowupBehavior.executePrevious;
}

export function decideFollowup(
    results: AgentTitleModel[],
    behavior: FollowupBehavior,
    previous: AgentTitleModel | null,
): MatchOutcome {
    const top = results[0];
    const prev = previous?.agentName?.trim() ? previous : null;
    const runPrev: MatchOutcome = prev
        ? { kind: "run", agentName: prev.agentName }
        : { kind: "noMatch" };

    switch (behavior) {
        case FollowupBehavior.executePrevious:
            return runPrev;

        case FollowupBehavior.executeTopMatch:
            return top ? { kind: "run", agentName: top.agentName } : runPrev;

        case FollowupBehavior.executeOnlyMatch:
            if (results.length === 1) return { kind: "run", agentName: top.agentName };
            if (results.length === 0) return runPrev;
            return { kind: "show", results: withPrevious(results, prev) };

        case FollowupBehavior.showResults:
        default: {
            const list = withPrevious(results, prev);
            return list.length > 0 ? { kind: "show", results: list } : { kind: "noMatch" };
        }
    }
}

export function useAgentMatches() {
    const [results, setResults] = useState<AgentTitleModel[]>([]);
    const [selected, setSelected] = useState(0);

    const show = useCallback((next: AgentTitleModel[]) => {
        setResults(next);
        setSelected(0);
    }, []);

    const clear = useCallback(() => {
        setResults([]);
        setSelected(0);
    }, []);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLElement>): boolean => {
            if (results.length === 0) return false;
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((i) => (i + 1) % results.length);
                return true;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((i) => (i - 1 + results.length) % results.length);
                return true;
            }
            return false;
        },
        [results.length],
    );

    return {
        results,
        selected,
        setSelected,
        selectedAgent: (results[selected] ?? null) as AgentTitleModel | null,
        show,
        clear,
        handleKeyDown,
    };
}
