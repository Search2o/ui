import { type KeyboardEvent, useState } from "react";
import * as API from "@/orval/search2o";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, SendHorizontal } from "lucide-react";
import { Composer } from "@/shared/Composer";
import * as UI from "@/shared/uistate";
import { preloadModule } from "@/shared/moduleRegistry";
import { AgentSuggestions, NoAgentMatch } from "@/shared/AgentSuggestions";
import { decideSearch, useAgentMatches } from "@/shared/agentSearch";
import { getUiConfig } from "@/shared/uiConfig";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

function getWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function SearchHistoryModule() {
    const [query, setQuery] = useState("");
    const [noMatch, setNoMatch] = useState(false);
    const [busy, setBusy] = useState(false);
    const matches = useAgentMatches();

    const run = (agentName: string) => {
        UI.openSubModule("SearchConversation", { query: query.trim(), agentName });
    };

    const onChange = (text: string) => {
        setQuery(text);
        setNoMatch(false);
        matches.clear();
    };

    const search = async () => {
        const q = query.trim();
        if (!q || busy) return;

        if (getWordCount(q) < 2 || q.length < 8) {
            toast.error(uiText("validate.queryTooShort"));
            return;
        }

        setBusy(true);
        setNoMatch(false);
        try {
            const options = getUiConfig().search;
            const resp = await API.search({ query: q, tag: options.tag });
            if (!resp.success) {
                toast.error(resp.error?.message || "Could not search for a matching agent.");
                return;
            }

            const outcome = decideSearch(resp.searchResults ?? [], options.searchBehavior);
            if (outcome.kind === "run") run(outcome.agentName);
            else if (outcome.kind === "show") matches.show(outcome.results);
            else setNoMatch(true);
        } catch (e) {
            toast.error(errorText(e, "Could not search for a matching agent."));
        } finally {
            setBusy(false);
        }
    };

    const submit = () => {
        const chosen = matches.selectedAgent;
        if (chosen) run(chosen.agentName);
        else void search();
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (matches.handleKeyDown(e)) return;
        if (e.key !== "Enter" || e.shiftKey) return;

        e.preventDefault();
        submit();
    };

    return (
        <div className="w-full h-full flex flex-col">
            <Card className="w-full">
                <CardHeader className="mx-auto w-full max-w-3xl px-0 pb-2">
                    <CardTitle>Search</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="mx-auto w-full max-w-3xl">
                        <Composer
                            rows={2}
                            placeholder={uiText("placeholder.searchQuery")}
                            aria-label="Ask a question"
                            className="min-h-[64px] text-base leading-relaxed"
                            value={query}
                            onChange={(e) => onChange(e.target.value)}
                            onKeyDown={onKeyDown}
                            disabled={busy}
                            role="combobox"
                            aria-expanded={matches.results.length > 0}
                            aria-controls="search-agent-suggestions"
                            aria-activedescendant={
                                matches.results.length > 0
                                    ? `search-agent-suggestion-${matches.selected}`
                                    : undefined
                            }
                            onFocus={() => preloadModule("SearchConversation")}
                            action={
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={submit}
                                    disabled={busy || !query.trim()}
                                >
                                    {busy ? (
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    ) : (
                                        <SendHorizontal className="h-4 w-4" aria-hidden />
                                    )}
                                    Send
                                </Button>
                            }
                        />
                    </div>

                    <div id="search-agent-suggestions" className="mx-auto w-full max-w-3xl">
                        <AgentSuggestions
                            results={matches.results}
                            selected={matches.selected}
                            onSelect={matches.setSelected}
                            onRun={(a) => run(a.agentName)}
                            idPrefix="search-agent-suggestion"
                        />
                        {noMatch ? <NoAgentMatch /> : null}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
