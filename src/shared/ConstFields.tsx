import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { FieldLabel } from "@/shared/FieldLabel";
import { JsonCodeBlock } from "@/shared/JsonCodeBlock";
import { constPayload, constValue } from "@/shared/agentConst";
import { defineMonacoThemes, useMonacoTheme } from "@/shared/monacoThemes";
import { uiText } from "@/shared/uiText";

const MIN_HEIGHT = 96;

export function DraftConst({
    value,
    onChange,
}: {
    value: string;
    onChange: (text: string) => void;
}) {
    const theme = useMonacoTheme();
    const [height, setHeight] = useState(MIN_HEIGHT);
    const result = value.trim() ? constPayload(value) : null;
    const error = result && "error" in result ? result.error : null;

    const onMount: OnMount = (editor) => {
        const fit = () => {
            setHeight(Math.max(MIN_HEIGHT, editor.getContentHeight()));
            editor.layout();
        };
        editor.onDidContentSizeChange(fit);
        fit();
    };

    return (
        <div>
            <div className="py-2">
                <Editor
                    path="inmemory://const/agent-const.json"
                    value={value}
                    onChange={(v) => onChange(v ?? "")}
                    beforeMount={defineMonacoThemes}
                    onMount={onMount}
                    language="json"
                    theme={theme}
                    height={`${height}px`}
                    width="100%"
                    options={{
                        ariaLabel: "Const",
                        placeholder: "No const. Type a JSON object.",
                        fontSize: 14,
                        automaticLayout: true,
                        formatOnPaste: true,
                        wordWrap: "on",
                        scrollBeyondLastLine: false,
                        scrollbar: {
                            vertical: "hidden",
                            horizontal: "hidden",
                            alwaysConsumeMouseWheel: false,
                        },
                        minimap: { enabled: false },
                        overviewRulerLanes: 0,
                        overviewRulerBorder: false,
                        hideCursorInOverviewRuler: true,
                        lineNumbersMinChars: 3,
                        renderLineHighlight: "none",
                        tabSize: 2,
                        insertSpaces: true,
                        folding: true,
                        hover: { enabled: "on" },
                        quickSuggestions: false,
                        suggestOnTriggerCharacters: false,
                        wordBasedSuggestions: "off",
                        inlineSuggest: { enabled: false },
                        autoClosingQuotes: "always",
                        autoClosingBrackets: "always",
                        fixedOverflowWidgets: true,
                    }}
                />
            </div>
            {error ? (
                <p
                    role="alert"
                    className="border-t bg-destructive/5 px-4 py-2 text-xs text-destructive"
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}

export function ConstError({ error, consequence }: { error: string; consequence: string }) {
    return (
        <div
            role="alert"
            className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <div className="min-w-0 space-y-1">
                <p className="font-medium text-destructive">{uiText("const.decryptFailed")}</p>
                <p className="break-words text-muted-foreground">{error}</p>
                <p>{consequence}</p>
            </div>
        </div>
    );
}

export function PublishedConst({
    raw,
    error,
    label,
}: {
    raw: string | null | undefined;
    error?: string;
    label: string;
}) {
    const value = constValue(raw);
    return (
        <div className="space-y-2">
            <div className="space-y-0.5">
                <FieldLabel help={uiText("const.help")}>{label}</FieldLabel>
                <p className="text-xs text-muted-foreground">{uiText("const.publishedHelp")}</p>
            </div>
            {error ? (
                <ConstError error={error} consequence={uiText("const.replaceInDraft")} />
            ) : value ? (
                <JsonCodeBlock value={value} />
            ) : (raw ?? "").trim() ? (
                <pre className="rounded-lg bg-muted/50 p-2 font-mono text-xs whitespace-pre-wrap break-words">
                    {raw}
                </pre>
            ) : (
                <p className="text-xs text-muted-foreground">{uiText("empty.agentConst")}</p>
            )}
        </div>
    );
}
