type Entry = { key: string; text: string; values?: { value: string; text: string }[] };

const ENTRIES: Entry[] = [
    {
        key: "apiTimeoutSeconds",
        text: "Timeout in seconds for REST API calls from the UI. Keep this above 60 seconds as some calls can take up to one minute.",
    },
    {
        key: "toastDurationSeconds",
        text: "Default number of seconds that pop-up messages remain visible.",
    },
    {
        key: "search.tag",
        text: "Only agents carrying this tag are searched. Leave empty to search every tag.",
    },
    {
        key: "search.searchBehavior",
        text: "What happens when the user presses Enter on a new search. One of:",
        values: [
            {
                value: "executeTopMatch",
                text: "Run the best match. The best matching agent runs, however many matched.",
            },
            {
                value: "executeOnlyMatch",
                text: "Run a single match. When one agent matches, it runs. When several do, the user chooses.",
            },
            {
                value: "showResults",
                text: "Always show the matches. The user chooses which agent runs, even when only one matched.",
            },
        ],
    },
    {
        key: "search.followupBehavior",
        text: 'What happens when the user presses Enter on a follow-up in a conversation. The "previous agent" is the one that last answered. One of:',
        values: [
            {
                value: "executeTopMatch",
                text: 'Run the best match. The best matching agent runs, however many matched. When none do, the previous agent runs (for example, "and in French?").',
            },
            {
                value: "executeOnlyMatch",
                text: "Run a single match. When one agent matches, it runs. When several do, the user chooses, with the previous agent offered alongside them. When none do, the previous agent runs.",
            },
            {
                value: "showResults",
                text: "Always show the matches. The user chooses which agent runs, even when only one matched. The previous agent is offered alongside them.",
            },
            {
                value: "executePrevious",
                text: "Always the previous agent. A follow-up always runs the previous agent, and nothing is searched.",
            },
        ],
    },
];

export function UiConfigHelp() {
    return (
        <dl className="space-y-2 py-1 text-left [text-wrap:pretty]">
            {ENTRIES.map((entry) => (
                <div key={entry.key}>
                    <dt className="font-mono font-semibold">{entry.key}</dt>
                    <dd>{entry.text}</dd>
                    {entry.values ? (
                        <dd>
                            <dl className="mt-1 space-y-1 pl-3">
                                {entry.values.map((v) => (
                                    <div key={v.value}>
                                        <dt className="font-mono">{v.value}</dt>
                                        <dd className="opacity-80">{v.text}</dd>
                                    </div>
                                ))}
                            </dl>
                        </dd>
                    ) : null}
                </div>
            ))}
        </dl>
    );
}
