import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { findPathRange } from "@/shared/agentPath";
import { agentDisplayText } from "@/shared/agentText";
import { tokenizeJsonc, type Token, type TokenKind } from "@/shared/jsoncTokens";

const CLASS: Record<TokenKind, string> = {
    expr: "text-teal-700 dark:text-teal-300",
    key: "font-medium text-sky-800 dark:font-normal dark:text-sky-300",
    string: "text-emerald-700 dark:text-emerald-300",
    number: "text-amber-700 dark:text-amber-300",
    literal: "text-fuchsia-700 dark:text-fuchsia-300",
    comment: "italic text-slate-600 dark:text-slate-400",
    punct: "text-foreground/60 dark:text-foreground/50",
    plain: "text-foreground/85 dark:text-foreground/80",
};

type Piece = { kind: TokenKind; text: string; marked: boolean };

function markTokens(tokens: Token[], range: { offset: number; length: number } | null): Piece[] {
    const pieces: Piece[] = [];
    const from = range?.offset ?? -1;
    const to = range ? range.offset + range.length : -1;
    let at = 0;

    for (const t of tokens) {
        const start = at;
        const end = at + t.text.length;
        at = end;

        if (!range || end <= from || start >= to) {
            pieces.push({ kind: t.kind, text: t.text, marked: false });
            continue;
        }
        const a = Math.max(start, from);
        const b = Math.min(end, to);
        if (a > start)
            pieces.push({ kind: t.kind, text: t.text.slice(0, a - start), marked: false });
        for (const part of t.text.slice(a - start, b - start).split(/(\n[ \t]*)/)) {
            if (!part) continue;
            pieces.push({ kind: t.kind, text: part, marked: !/^\n[ \t]*$/.test(part) });
        }
        if (b < end) pieces.push({ kind: t.kind, text: t.text.slice(b - start), marked: false });
    }
    return pieces;
}

export function JsonCodeBlock({
    value,
    className,
    highlightPath,
}: {
    value: unknown;
    className?: string;
    highlightPath?: string;
}) {
    const text = useMemo(() => agentDisplayText(value), [value]);
    const tokens = useMemo(() => tokenizeJsonc(text), [text]);
    const range = useMemo(
        () => (highlightPath ? findPathRange(highlightPath, text) : null),
        [highlightPath, text],
    );
    const pieces = useMemo(() => markTokens(tokens, range), [tokens, range]);

    const markRef = useRef<HTMLSpanElement | null>(null);
    useEffect(() => {
        markRef.current?.scrollIntoView({ block: "center" });
    }, [range?.offset, range?.length]);

    let firstMark = true;
    const renderPiece = (piece: Piece, i: number): ReactNode => {
        if (!piece.marked) {
            return (
                <span key={i} className={CLASS[piece.kind]}>
                    {piece.text}
                </span>
            );
        }
        const ref = firstMark ? markRef : undefined;
        firstMark = false;
        return (
            <span
                key={i}
                ref={ref}
                className={
                    "rounded-[3px] bg-amber-300/50 ring-1 ring-amber-500/40 dark:bg-amber-400/25 " +
                    CLASS[piece.kind]
                }
            >
                {piece.text}
            </span>
        );
    };

    return (
        <pre
            className={
                "overflow-x-auto rounded-xl border border-border bg-muted/70 p-4 " +
                "font-mono text-[13.5px] leading-6 tracking-[-0.01em] dark:bg-muted/40 " +
                (className ?? "")
            }
        >
            <code>{pieces.map(renderPiece)}</code>
        </pre>
    );
}
