import type * as monacoT from "monaco-editor";

type StringToken = {
    start: number;
    end: number;
};

export type MonacoValueHighlighter = {
    refresh: () => void;
    dispose: () => void;
};

export function installJsonBraceValueHighlighter(
    editor: monacoT.editor.IStandaloneCodeEditor,
): MonacoValueHighlighter {
    let collection: monacoT.editor.IEditorDecorationsCollection | null = null;
    let modelChangeSub: monacoT.IDisposable | null = null;
    let contentChangeSub: monacoT.IDisposable | null = null;

    const clearCollection = () => {
        collection?.clear();
        collection = null;
    };

    const refresh = () => {
        const model = editor.getModel();
        if (!model) {
            clearCollection();
            return;
        }

        const lang = model.getLanguageId();
        if (lang !== "json" && lang !== "jsonc") {
            clearCollection();
            return;
        }

        const text = model.getValue();
        const decorations: monacoT.editor.IModelDeltaDecoration[] = [];

        for (const token of findJsonStringTokens(text)) {
            if (isJsonKeyToken(text, token.end)) {
                continue;
            }

            const tokenText = text.slice(token.start, token.end);

            let decoded: string;
            try {
                decoded = JSON.parse(tokenText);
            } catch {
                continue;
            }

            if (!/^\{[\s\S]*\}$/.test(decoded)) {
                continue;
            }

            const openBraceOffset = decoded.indexOf("{");
            const closeBraceOffset = decoded.lastIndexOf("}");

            if (openBraceOffset === -1 || closeBraceOffset === -1) {
                continue;
            }

            const openIndex = token.start + 1 + openBraceOffset;
            const closeIndex = token.start + 1 + closeBraceOffset;

            const openStart = model.getPositionAt(openIndex);
            const openEnd = model.getPositionAt(openIndex + 1);

            const closeStart = model.getPositionAt(closeIndex);
            const closeEnd = model.getPositionAt(closeIndex + 1);

            decorations.push({
                range: {
                    startLineNumber: openStart.lineNumber,
                    startColumn: openStart.column,
                    endLineNumber: openEnd.lineNumber,
                    endColumn: openEnd.column,
                },
                options: {
                    inlineClassName: "json-brace-char",
                    inlineClassNameAffectsLetterSpacing: true,
                },
            });

            decorations.push({
                range: {
                    startLineNumber: closeStart.lineNumber,
                    startColumn: closeStart.column,
                    endLineNumber: closeEnd.lineNumber,
                    endColumn: closeEnd.column,
                },
                options: {
                    inlineClassName: "json-brace-char",
                    inlineClassNameAffectsLetterSpacing: true,
                },
            });

            if (closeIndex > openIndex + 1) {
                const contentStart = model.getPositionAt(openIndex + 1);
                const contentEnd = model.getPositionAt(closeIndex);

                decorations.push({
                    range: {
                        startLineNumber: contentStart.lineNumber,
                        startColumn: contentStart.column,
                        endLineNumber: contentEnd.lineNumber,
                        endColumn: contentEnd.column,
                    },
                    options: {
                        inlineClassName: "json-brace-content",
                        inlineClassNameAffectsLetterSpacing: true,
                    },
                });
            }
        }

        if (!collection) {
            collection = editor.createDecorationsCollection(decorations);
        } else {
            collection.set(decorations);
        }
    };

    const bindToCurrentModel = () => {
        contentChangeSub?.dispose();
        contentChangeSub = null;

        clearCollection();

        const model = editor.getModel();
        if (!model) {
            return;
        }

        contentChangeSub = model.onDidChangeContent(() => {
            refresh();
        });

        refresh();
    };

    modelChangeSub = editor.onDidChangeModel(() => {
        bindToCurrentModel();
    });

    bindToCurrentModel();

    return {
        refresh,
        dispose: () => {
            contentChangeSub?.dispose();
            modelChangeSub?.dispose();
            clearCollection();
        },
    };
}

function findJsonStringTokens(text: string): StringToken[] {
    const tokens: StringToken[] = [];
    const len = text.length;
    let i = 0;

    while (i < len) {
        if (text[i] !== '"') {
            i++;
            continue;
        }

        const start = i;
        i++;

        let escaped = false;
        while (i < len) {
            const ch = text[i];

            if (escaped) {
                escaped = false;
                i++;
                continue;
            }

            if (ch === "\\") {
                escaped = true;
                i++;
                continue;
            }

            if (ch === '"') {
                i++;
                tokens.push({ start, end: i });
                break;
            }

            i++;
        }
    }

    return tokens;
}

function isJsonKeyToken(text: string, fromIndex: number): boolean {
    let i = fromIndex;

    while (i < text.length) {
        const ch = text[i];
        if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
            i++;
            continue;
        }
        return ch === ":";
    }

    return false;
}
