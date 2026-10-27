import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    useCallback,
} from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monacoT from "monaco-editor";
import { findNodeAtLocation, parseTree } from "jsonc-parser";
import { Card, CardContent } from "@/components/ui/card";
import { defineMonacoThemes, useMonacoTheme } from "@/shared/monacoThemes";
import { ensureMonacoSchemas } from "@/shared/monacoSchemas";
import { installCommandPicker } from "@/shared/monacoCommandPicker";
import { fetchAgentSchemaOnce } from "@/shared/agentSchema";
import {
    installJsonBraceValueHighlighter,
    type MonacoValueHighlighter,
} from "@/shared/monacoValueHighlights";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    ArrowDown,
    ArrowUp,
    LocateFixed,
    MessageSquareDashed,
    MessageSquareOff,
    Redo2,
    Replace,
    Search,
    Undo2,
    AlignLeft,
    WrapText,
    FoldVertical,
    UnfoldVertical,
    ListOrdered,
    IndentIncrease,
    MoreHorizontal,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

await fetchAgentSchemaOnce();

type Cmd = {
    key: string;
    label: string;
    icon: ReactNode;
    run: (ed: monacoT.editor.IStandaloneCodeEditor) => void;
    hotkey?: string;
};

function tryRunAction(ed: monacoT.editor.IStandaloneCodeEditor, actionId: string) {
    const act = ed.getAction(actionId);
    if (!act) return false;
    void act.run();
    return true;
}

function trigger(ed: monacoT.editor.IStandaloneCodeEditor, actionId: string) {
    ed.trigger("commandbar", actionId, null);
}

const COMPACT_KEYS = new Set(["find", "format", "foldAll", "unfoldAll"]);

function MonacoCommandBar({
    editor,
    onToggleLineNumbers,
    indentGuidesOn,
    onToggleIndentGuides,
    wordWrapOn,
    onToggleWordWrap,
    compact = false,
}: {
    editor: monacoT.editor.IStandaloneCodeEditor | null;
    compact?: boolean;
    onToggleLineNumbers?: () => void;

    indentGuidesOn: boolean;
    onToggleIndentGuides: () => void;

    wordWrapOn: boolean;
    onToggleWordWrap: () => void;
}) {
    const cmds: Cmd[] = useMemo(
        () => [
            {
                key: "find",
                label: "Find",
                icon: <Search className="h-4 w-4" />,
                hotkey: "⌘F / Ctrl+F",
                run: (ed) => {
                    if (!tryRunAction(ed, "actions.find")) trigger(ed, "actions.find");
                },
            },
            {
                key: "replace",
                label: "Replace",
                icon: <Replace className="h-4 w-4" />,
                hotkey: "⌥⌘F / Ctrl+H",
                run: (ed) => {
                    if (!tryRunAction(ed, "editor.action.startFindReplaceAction")) {
                        trigger(ed, "editor.action.startFindReplaceAction");
                    }
                },
            },
            {
                key: "findNext",
                label: "Find next",
                icon: <ArrowDown className="h-4 w-4" />,
                run: (ed) => {
                    if (!tryRunAction(ed, "editor.action.nextMatchFindAction")) {
                        trigger(ed, "editor.action.nextMatchFindAction");
                    }
                },
            },
            {
                key: "findPrev",
                label: "Find previous",
                icon: <ArrowUp className="h-4 w-4" />,
                run: (ed) => {
                    if (!tryRunAction(ed, "editor.action.previousMatchFindAction")) {
                        trigger(ed, "editor.action.previousMatchFindAction");
                    }
                },
            },
            {
                key: "toggleComment",
                label: "Toggle comment",
                icon: <MessageSquareDashed className="h-4 w-4" />,
                hotkey: "⌘/ / Ctrl+/",
                run: (ed) => {
                    if (!tryRunAction(ed, "editor.action.commentLine")) {
                        trigger(ed, "editor.action.commentLine");
                    }
                },
            },
            {
                key: "blockComment",
                label: "Block comment",
                icon: <MessageSquareOff className="h-4 w-4" />,
                run: (ed) => {
                    if (!tryRunAction(ed, "editor.action.blockComment")) {
                        trigger(ed, "editor.action.blockComment");
                    }
                },
            },
            {
                key: "format",
                label: "Format document",
                icon: <AlignLeft className="h-4 w-4" />,
                hotkey: "⇧⌥F / Shift+Alt+F",
                run: (ed) => {
                    if (!tryRunAction(ed, "editor.action.formatDocument")) {
                        trigger(ed, "editor.action.formatDocument");
                    }
                },
            },
            {
                key: "wordWrap",
                label: wordWrapOn ? "Disable word wrap" : "Enable word wrap",
                icon: <WrapText className="h-4 w-4" />,
                run: () => onToggleWordWrap(),
            },
            {
                key: "toggleLineNumbers",
                label: "Toggle line numbers",
                icon: <ListOrdered className="h-4 w-4" />,
                run: () => {
                    onToggleLineNumbers?.();
                },
            },
            {
                key: "indentGuides",
                label: indentGuidesOn ? "Hide indent guides" : "Show indent guides",
                icon: <IndentIncrease className="h-4 w-4" />,
                run: () => onToggleIndentGuides(),
            },
            {
                key: "gotoLine",
                label: "Go to line",
                icon: <LocateFixed className="h-4 w-4" />,
                hotkey: "⌃G / Ctrl+G",
                run: (ed) => {
                    if (!tryRunAction(ed, "editor.action.gotoLine")) {
                        trigger(ed, "editor.action.gotoLine");
                    }
                },
            },
            {
                key: "foldAll",
                label: "Fold all",
                icon: <FoldVertical className="h-4 w-4" />,
                run: (ed) => {
                    tryRunAction(ed, "editor.foldAll");
                },
            },
            {
                key: "unfoldAll",
                label: "Unfold all",
                icon: <UnfoldVertical className="h-4 w-4" />,
                run: (ed) => {
                    tryRunAction(ed, "editor.unfoldAll");
                },
            },
            {
                key: "undo",
                label: "Undo",
                icon: <Undo2 className="h-4 w-4" />,
                hotkey: "⌘Z / Ctrl+Z",
                run: (ed) => {
                    if (!tryRunAction(ed, "undo")) trigger(ed, "undo");
                },
            },
            {
                key: "redo",
                label: "Redo",
                icon: <Redo2 className="h-4 w-4" />,
                hotkey: "⇧⌘Z / Ctrl+Y",
                run: (ed) => {
                    if (!tryRunAction(ed, "redo")) trigger(ed, "redo");
                },
            },
        ],
        [onToggleLineNumbers, indentGuidesOn, onToggleIndentGuides, wordWrapOn, onToggleWordWrap],
    );

    const runCmd = (c: Cmd) => {
        if (!editor) return;
        editor.focus();
        c.run(editor);
    };

    if (compact) {
        const more = cmds.filter((c) => !COMPACT_KEYS.has(c.key));
        return (
            <TooltipProvider delayDuration={150}>
                <div className="inline-flex items-center gap-0.5">
                    {cmds
                        .filter((c) => COMPACT_KEYS.has(c.key))
                        .map((c) => (
                            <Tooltip key={c.key}>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                        disabled={!editor}
                                        onClick={() => runCmd(c)}
                                        aria-label={c.label}
                                    >
                                        {c.icon}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                    <div className="font-medium">{c.label}</div>
                                    {c.hotkey ? (
                                        <div className="text-muted-foreground">{c.hotkey}</div>
                                    ) : null}
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                disabled={!editor}
                                aria-label="More editor commands"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-56">
                            {more.map((c) => (
                                <DropdownMenuItem key={c.key} onSelect={() => runCmd(c)}>
                                    <span className="text-muted-foreground">{c.icon}</span>
                                    {c.label}
                                    {c.hotkey ? (
                                        <DropdownMenuShortcut>
                                            {c.hotkey.split(" / ")[0]}
                                        </DropdownMenuShortcut>
                                    ) : null}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider delayDuration={150}>
            <div className="pointer-events-auto inline-flex flex-wrap items-center gap-1">
                {cmds.map((c, idx) => {
                    const btn = (
                        <Button
                            key={c.key}
                            type="button"
                            size="icon"
                            variant={
                                c.key === "indentGuides"
                                    ? indentGuidesOn
                                        ? "secondary"
                                        : "ghost"
                                    : "ghost"
                            }
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            disabled={!editor}
                            onClick={() => {
                                if (!editor) return;

                                editor.focus();
                                c.run(editor);
                            }}
                            aria-label={c.label}
                        >
                            {c.icon}
                        </Button>
                    );

                    return (
                        <span key={c.key} className="inline-flex items-center">
                            <Tooltip>
                                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                                <TooltipContent className="text-xs">
                                    <div className="font-medium">{c.label}</div>
                                    {c.hotkey ? (
                                        <div className="text-muted-foreground">{c.hotkey}</div>
                                    ) : null}
                                </TooltipContent>
                            </Tooltip>
                            {idx === 3 || idx === 5 ? (
                                <Separator orientation="vertical" className="mx-1 h-5" />
                            ) : null}
                        </span>
                    );
                })}
            </div>
        </TooltipProvider>
    );
}

type Props = {
    value: string;
    onChange?: (v: string) => void;
    readOnly?: boolean;
    showGutter?: boolean;
    framed?: boolean;
    toolbarTarget?: HTMLElement | null;
};

export type MonacoJsoncHandle = {
    revealJsonPath: (path: (string | number)[]) => boolean;
};

let overflowWidgetsHost: HTMLElement | null = null;
function widgetHost(): HTMLElement | undefined {
    if (typeof document === "undefined") return undefined;
    if (!overflowWidgetsHost) {
        overflowWidgetsHost = document.createElement("div");
        overflowWidgetsHost.className = "monaco-editor monaco-overflow-widgets-host";
        document.body.appendChild(overflowWidgetsHost);
    }
    return overflowWidgetsHost;
}

function MonacoJsonc(
    {
        value,
        onChange = undefined,
        readOnly = false,
        showGutter = true,
        framed = true,
        toolbarTarget,
    }: Props,
    ref: React.Ref<MonacoJsoncHandle>,
) {
    const monacoTheme = useMonacoTheme();
    const editorRef = useRef<monacoT.editor.IStandaloneCodeEditor | null>(null);
    const highlightRef = useRef<MonacoValueHighlighter | null>(null);

    useImperativeHandle(
        ref,
        () => ({
            revealJsonPath: (path) => {
                const editor = editorRef.current;
                const model = editor?.getModel();
                if (!editor || !model) return false;

                let node;
                try {
                    const root = parseTree(model.getValue());
                    node = root ? findNodeAtLocation(root, path) : undefined;
                } catch {
                    return false;
                }
                if (!node) return false;

                const start = model.getPositionAt(node.offset);
                const end = model.getPositionAt(node.offset + node.length);
                editor.setSelection({
                    startLineNumber: start.lineNumber,
                    startColumn: start.column,
                    endLineNumber: end.lineNumber,
                    endColumn: end.column,
                });
                editor.revealLinesInCenterIfOutsideViewport(start.lineNumber, end.lineNumber);

                const dom = editor.getContainerDomNode();
                const lineTop = editor.getTopForLineNumber(start.lineNumber);
                const pageTop = window.scrollY + dom.getBoundingClientRect().top + lineTop;
                window.scrollTo({ top: Math.max(0, pageTop - window.innerHeight / 3) });
                editor.focus();
                return true;
            },
        }),
        [],
    );
    const [height, setHeight] = useState<number>(120);
    const [contentLeft, setContentLeft] = useState<number>(20);

    const [lineNumbersOn, setLineNumbersOn] = useState(showGutter);
    const [indentGuidesOn, setIndentGuidesOn] = useState(true);
    const [wordWrapOn, setWordWrapOn] = useState(true);

    const updateHeight = () => {
        const ed = editorRef.current;
        if (!ed) return;
        const contentHeight = ed.getContentHeight();
        setHeight(Math.max(120, contentHeight));
        ed.layout();
    };

    const onToggleIndentGuides = useCallback(() => {
        setIndentGuidesOn((v) => {
            const next = !v;
            editorRef.current?.updateOptions({
                guides: { indentation: next },
            });
            return next;
        });
    }, []);

    const handleBeforeMount = (m: typeof monacoT) => {
        ensureMonacoSchemas(m);
        defineMonacoThemes(m);
    };

    const handleMount: OnMount = (editor, m) => {
        editorRef.current = editor;

        highlightRef.current?.dispose();
        highlightRef.current = installJsonBraceValueHighlighter(editor);
        installCommandPicker(editor, m);

        editor.addCommand(
            m.KeyCode.Enter,
            () => editor.trigger("keyboard", "editor.action.inlineSuggest.commit", {}),
            "inlineSuggestionVisible",
        );

        setContentLeft(editor.getLayoutInfo().contentLeft);
        editor.onDidContentSizeChange(updateHeight);
        updateHeight();

        editor.updateOptions({ readOnly });
    };

    useEffect(() => {
        editorRef.current?.updateOptions({ readOnly });
    }, [readOnly]);

    useEffect(() => {
        const ed = editorRef.current;
        if (!ed) return;

        requestAnimationFrame(() => {
            setContentLeft(ed.getLayoutInfo().contentLeft);
        });
    }, [lineNumbersOn]);

    useEffect(() => {
        return () => {
            highlightRef.current?.dispose();
            highlightRef.current = null;
        };
    }, []);

    const commandBar = (compact: boolean) => (
        <MonacoCommandBar
            editor={editorRef.current}
            onToggleLineNumbers={() => setLineNumbersOn((v) => !v)}
            indentGuidesOn={indentGuidesOn}
            onToggleIndentGuides={onToggleIndentGuides}
            onToggleWordWrap={() => setWordWrapOn((v) => !v)}
            wordWrapOn={wordWrapOn}
            compact={compact}
        />
    );

    const editor = (
        <>
            {toolbarTarget ? createPortal(commandBar(true), toolbarTarget) : null}
            {toolbarTarget === undefined ? (
                <div
                    className="flex w-full flex-wrap items-center gap-1 border-b py-1"
                    style={{ paddingLeft: contentLeft }}
                >
                    {commandBar(false)}
                </div>
            ) : null}

            <div className="relative">
                <Editor
                    path="inmemory://drafts/agent.jsonc"
                    value={value}
                    onChange={(v) => onChange?.(v ?? "")}
                    beforeMount={handleBeforeMount}
                    onMount={handleMount}
                    language="json"
                    theme={monacoTheme}
                    options={{
                        readOnly,
                        hover: { enabled: "on" },
                        fontSize: 14,
                        automaticLayout: true,
                        formatOnPaste: true,
                        formatOnType: true,
                        wordWrap: wordWrapOn ? "on" : "off",
                        scrollBeyondLastLine: false,
                        scrollbar: {
                            vertical: "hidden",
                            horizontal: wordWrapOn ? "hidden" : "auto",
                            verticalScrollbarSize: 0,
                            horizontalScrollbarSize: wordWrapOn ? 0 : 10,
                            alwaysConsumeMouseWheel: false,
                        },
                        minimap: { enabled: false },
                        lineNumbers: lineNumbersOn ? "on" : "off",
                        guides: { indentation: indentGuidesOn },
                        bracketPairColorization: { enabled: true },
                        lineNumbersMinChars: 0,
                        renderLineHighlight: "none",
                        tabSize: 2,
                        insertSpaces: true,
                        folding: true,
                        padding: { top: 0, bottom: 0 },
                        quickSuggestions: { other: false, comments: false, strings: false },
                        suggestOnTriggerCharacters: false,
                        wordBasedSuggestions: "off",
                        inlineSuggest: { enabled: true, showToolbar: "never" },
                        autoClosingQuotes: "always",
                        autoClosingBrackets: "always",
                        screenReaderAnnounceInlineSuggestion: true,
                        renderValidationDecorations: "on",
                        glyphMargin: true,
                        overflowWidgetsDomNode: widgetHost(),
                        fixedOverflowWidgets: true,
                    }}
                    width="100%"
                    height={`${height}px`}
                />
            </div>
        </>
    );

    if (!framed) return editor;

    return (
        <Card className="overflow-hidden rounded-2xl border bg-surface py-0 shadow-sm">
            <CardContent className="p-0">{editor}</CardContent>
        </Card>
    );
}

export default forwardRef(MonacoJsonc);
