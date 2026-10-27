import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { AgentPromptModel } from "@/orval/search2o.schemas";
import { HoverTip } from "@/shared/HoverTip";
import { promptRows, type PromptRow } from "@/shared/agentPrompts";
import { uiText } from "@/shared/uiText";

export function PublishedPrompts({
    prompts,
    viewingPastVersion,
}: {
    prompts: Record<string, AgentPromptModel>;
    viewingPastVersion: boolean;
}) {
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const rows = promptRows(prompts);

    return (
        <div className="space-y-2">
            <div className="space-y-0.5">
                <HoverTip tip={uiText("prompt.intro")}>
                    <div className="cursor-help text-sm font-medium">
                        Prompts
                        {rows.length > 0 ? (
                            <span className="font-normal text-muted-foreground">
                                {" "}
                                ({rows.length})
                            </span>
                        ) : null}
                    </div>
                </HoverTip>
                <p className="text-xs text-muted-foreground">
                    {viewingPastVersion
                        ? uiText("prompt.notVersioned")
                        : uiText("prompt.publishedHelp")}
                </p>
            </div>

            {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">{uiText("empty.agentPrompts")}</p>
            ) : (
                <div className="divide-y rounded-2xl border bg-card">
                    {rows.map((row) => {
                        const isOpen = !!open[row.name];
                        const bodyId = `published-prompt-${row.name}`;
                        return (
                            <div key={row.name}>
                                <div className="px-1">
                                    <button
                                        type="button"
                                        aria-expanded={isOpen}
                                        aria-controls={bodyId}
                                        onClick={() =>
                                            setOpen((prev) => ({ ...prev, [row.name]: !isOpen }))
                                        }
                                        className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <ChevronRight
                                            aria-hidden
                                            className={
                                                "h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
                                                (isOpen ? "rotate-90" : "")
                                            }
                                        />
                                        <span className="shrink-0 font-mono text-sm">
                                            {row.name}
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {row.scope}
                                        </span>
                                        {row.doc ? (
                                            <span className="hidden min-w-0 truncate text-xs text-muted-foreground md:inline">
                                                — {row.doc}
                                            </span>
                                        ) : null}
                                    </button>
                                </div>
                                <div id={bodyId} hidden={!isOpen}>
                                    <PromptText row={row} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function PromptText({ row }: { row: PromptRow }) {
    const part = (label: string, text: string) =>
        text ? (
            <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{label}</div>
                <pre className="max-h-80 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-xs whitespace-pre-wrap break-words">
                    {text}
                </pre>
            </div>
        ) : null;
    return (
        <div className="space-y-3 px-4 pb-4">
            {part("System prompt", row.system)}
            {part("User prompt", row.user)}
            {row.doc ? <p className="text-xs text-muted-foreground">{row.doc}</p> : null}
        </div>
    );
}
