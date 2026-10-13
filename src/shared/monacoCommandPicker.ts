import type * as monacoT from "monaco-editor";
import {
    CARET_MARK,
    commandInsertName,
    commaRepairEdit,
    fieldSuggestionsFor,
    contextIndent,
    groupedCommandSuggestions,
    keyContextAt,
    reindentSnippet,
    SuggestMode,
    type KeyContext,
    type Suggestion,
} from "@/shared/monacoSchemas";

const ITEM_CLASS =
    "mx-1 cursor-pointer rounded-md px-2 py-[3px] font-mono text-[13px] text-foreground";
const ITEM_SELECTED_CLASS = `${ITEM_CLASS} bg-primary/15 text-primary`;

function fieldGroupTitle(ctx: KeyContext): string {
    if (ctx.mode === SuggestMode.Command) {
        const command = ctx.path[ctx.path.length - 2];
        const name = typeof command === "string" ? command.split(".")[0] : "";
        return name ? `${name} fields` : "Fields";
    }
    if (ctx.mode === SuggestMode.FuncArg) return "Argument";
    if (ctx.mode === SuggestMode.Func) return "Function";
    if (ctx.mode === SuggestMode.FunctionCallArg) return "Arguments";
    return "Fields";
}

export function installCommandPicker(
    editor: monacoT.editor.IStandaloneCodeEditor,
    monaco: typeof monacoT,
): void {
    const domNode = document.createElement("div");
    domNode.className =
        "s2o-command-picker z-50 flex w-[17rem] flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground font-sans shadow-lg";
    domNode.style.display = "none";
    domNode.addEventListener("mousedown", (e) => e.preventDefault());

    const listEl = document.createElement("div");
    listEl.className = "overflow-y-auto py-1";
    domNode.appendChild(listEl);

    const footerEl = document.createElement("div");
    footerEl.className =
        "border-t bg-muted/40 px-3 py-1.5 text-[11px] leading-snug text-muted-foreground";
    domNode.appendChild(footerEl);

    let open = false;
    let flat: Suggestion[] = [];
    let itemEls: HTMLElement[] = [];
    let selected = 0;
    let anchor: { lineNumber: number; column: number } | null = null;
    let siblingKeys = new Set<string>();
    let isCommandBlock = true;
    let ctxIndent = "";

    const widget: monacoT.editor.IContentWidget = {
        getId: () => "s2o.commandPicker",
        getDomNode: () => domNode,
        allowEditorOverflow: true,
        getPosition: () =>
            open && anchor
                ? {
                      position: { lineNumber: anchor.lineNumber, column: anchor.column },
                      preference: [
                          monaco.editor.ContentWidgetPositionPreference.BELOW,
                          monaco.editor.ContentWidgetPositionPreference.ABOVE,
                      ],
                  }
                : null,
    };
    editor.addContentWidget(widget);

    function close(): void {
        if (!open) return;
        open = false;
        domNode.style.display = "none";
        editor.layoutContentWidget(widget);
    }

    function setSelected(i: number): void {
        if (itemEls[selected]) itemEls[selected].className = ITEM_CLASS;
        selected = i;
        const el = itemEls[i];
        if (el) {
            el.className = ITEM_SELECTED_CLASS;
            el.scrollIntoView({ block: "nearest" });
        }
        footerEl.textContent = flat[i]?.documentation ?? "";
    }

    function render(groups: ReturnType<typeof groupedCommandSuggestions>): void {
        listEl.replaceChildren();
        itemEls = [];
        let index = 0;
        for (const group of groups) {
            const header = document.createElement("div");
            header.className =
                "px-3 pt-2 pb-0.5 text-[11px] font-semibold text-muted-foreground/70";
            header.textContent = group.title;
            listEl.appendChild(header);

            for (const s of group.items) {
                const i = index++;
                const item = document.createElement("div");
                item.className = i === selected ? ITEM_SELECTED_CLASS : ITEM_CLASS;
                item.textContent = s.name;

                item.addEventListener("mouseenter", () => setSelected(i));
                item.addEventListener("click", () => accept(flat[i]));
                itemEls.push(item);
                listEl.appendChild(item);
            }
        }

        footerEl.textContent = flat[selected]?.documentation ?? "";
        itemEls[selected]?.scrollIntoView({ block: "nearest" });
    }

    function sizeListToViewport(pos: monacoT.Position): void {
        const caret = editor.getScrolledVisiblePosition(pos);
        const editorTop = editor.getDomNode()?.getBoundingClientRect().top ?? 0;
        if (!caret) return;

        const caretTop = editorTop + caret.top;
        const caretBottom = caretTop + caret.height;
        const MARGIN = 16;
        const below = window.innerHeight - caretBottom - MARGIN - footerEl.offsetHeight;
        const above = caretTop - MARGIN - footerEl.offsetHeight;
        listEl.style.maxHeight = `${Math.max(160, Math.max(below, above))}px`;
    }

    function showNote(
        pos: monacoT.Position,
        quoteColumn: number,
        title = "No suggestions here.",
        detail = "A key here is not one this editor knows about.",
    ): void {
        listEl.replaceChildren();
        itemEls = [];
        flat = [];
        const note = document.createElement("div");
        note.className = "px-3 py-2 text-xs text-muted-foreground";
        note.textContent = title;
        listEl.appendChild(note);
        footerEl.textContent = detail;
        anchor = { lineNumber: pos.lineNumber, column: quoteColumn };
        open = true;
        domNode.style.display = "";
        listEl.style.maxHeight = "";
        editor.layoutContentWidget(widget);
    }

    function refresh(): void {
        const model = editor.getModel();
        const pos = editor.getPosition();
        if (!model || !pos) return close();

        const ctx = keyContextAt(model, pos);
        if (!ctx || !ctx.quoted) return close();

        if (ctx.mode === SuggestMode.ObjectExpected) {
            return showNote(
                pos,
                ctx.quoteColumn,
                "An object goes here.",
                "Every entry in this list is an object — { … }, not a string.",
            );
        }
        if (ctx.mode === SuggestMode.Unknown) return showNote(pos, ctx.quoteColumn);
        if (ctx.mode === SuggestMode.NewTask) return close();

        isCommandBlock = ctx.mode === SuggestMode.CommandBlock;
        let groups: ReturnType<typeof groupedCommandSuggestions>;
        if (isCommandBlock) {
            groups = groupedCommandSuggestions(ctx.prefix, ctx.path);
        } else {
            const items = fieldSuggestionsFor(ctx).filter((s) => s.name.startsWith(ctx.prefix));
            if (items.length === 0) {
                return showNote(
                    pos,
                    ctx.quoteColumn,
                    "Nothing left to add here.",
                    "Every field this block takes is already set.",
                );
            }
            groups = [{ title: fieldGroupTitle(ctx), items }];
        }
        flat = groups.flatMap((g) => g.items);
        if (flat.length === 0) return close();

        anchor = { lineNumber: pos.lineNumber, column: ctx.quoteColumn };
        siblingKeys = ctx.siblingKeys;
        ctxIndent = contextIndent(ctx);
        selected = 0;
        render(groups);
        open = true;
        domNode.style.display = "";
        sizeListToViewport(pos);
        editor.layoutContentWidget(widget);
    }

    function move(delta: number): void {
        if (flat.length === 0) return;
        setSelected((selected + delta + flat.length) % flat.length);
    }

    function accept(s: Suggestion | undefined): void {
        const model = editor.getModel();
        const pos = editor.getPosition();
        if (!s || !model || !pos || !anchor) return;

        const insertName = isCommandBlock ? commandInsertName(s.name, siblingKeys) : s.name;
        const raw =
            insertName === s.name
                ? s.insertText
                : s.insertText.replace(`"${s.name}"`, `"${insertName}"`);

        const line = model.getLineContent(pos.lineNumber);
        const lineWs = line.match(/^\s*/)?.[0] ?? "";
        const wsOnlyBeforeKey = lineWs.length >= anchor.column - 1;
        const startColumn = wsOnlyBeforeKey ? 1 : anchor.column;
        const insertText = (wsOnlyBeforeKey ? ctxIndent : "") + reindentSnippet(raw, ctxIndent);

        const hasClosingQuote = line[pos.column - 1] === '"';
        const edits: monacoT.editor.IIdentifiedSingleEditOperation[] = [
            {
                range: new monaco.Range(
                    pos.lineNumber,
                    startColumn,
                    pos.lineNumber,
                    pos.column + (hasClosingQuote ? 1 : 0),
                ),
                text: insertText,
            },
        ];
        const comma = commaRepairEdit(model, { lineNumber: pos.lineNumber, column: startColumn });
        if (comma) edits.push(comma);

        const markIndex = insertText.indexOf(CARET_MARK);
        const clean = insertText.replace(CARET_MARK, "");
        let caretAt: monacoT.IPosition | null = null;
        if (markIndex >= 0) {
            const before = insertText.slice(0, markIndex);
            const lineOffset = before.split("\n").length - 1;
            const colInLine = before.length - (before.lastIndexOf("\n") + 1);
            caretAt = {
                lineNumber: pos.lineNumber + lineOffset,
                column: lineOffset === 0 ? startColumn + colInLine : colInLine + 1,
            };
        }
        edits[0].text = clean;

        editor.executeEdits("s2o.commandPicker", edits);
        close();
        editor.focus();
        if (caretAt) editor.setPosition(caretAt);
    }

    editor.onDidChangeModelContent(() => refresh());
    editor.onDidChangeCursorPosition(() => {
        if (open) refresh();
    });
    editor.onDidBlurEditorWidget(() => close());

    editor.onKeyDown((e) => {
        if (!open) return;
        if (flat.length === 0 && e.keyCode !== monaco.KeyCode.Escape) return close();
        switch (e.keyCode) {
            case monaco.KeyCode.DownArrow:
                move(1);
                break;
            case monaco.KeyCode.UpArrow:
                move(-1);
                break;
            case monaco.KeyCode.Enter:
            case monaco.KeyCode.Tab:
                accept(flat[selected]);
                break;
            case monaco.KeyCode.Escape:
                close();
                break;
            default:
                return;
        }
        e.preventDefault();
        e.stopPropagation();
    });
}
