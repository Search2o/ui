export type TokenKind =
    "key" | "string" | "expr" | "number" | "literal" | "comment" | "punct" | "plain";

export type Token = { kind: TokenKind; text: string };

export function tokenizeJsonc(src: string): Token[] {
    const out: Token[] = [];
    let i = 0;

    const push = (kind: TokenKind, text: string) => {
        if (!text) return;
        const last = out[out.length - 1];
        if (last && last.kind === kind) last.text += text;
        else out.push({ kind, text });
    };

    while (i < src.length) {
        const c = src[i];

        if (c === "/" && src[i + 1] === "/") {
            const end = src.indexOf("\n", i);
            const stop = end === -1 ? src.length : end;
            push("comment", src.slice(i, stop));
            i = stop;
            continue;
        }
        if (c === "/" && src[i + 1] === "*") {
            const end = src.indexOf("*/", i + 2);
            const stop = end === -1 ? src.length : end + 2;
            push("comment", src.slice(i, stop));
            i = stop;
            continue;
        }

        if (c === '"') {
            let j = i + 1;
            while (j < src.length) {
                if (src[j] === "\\") j += 2;
                else if (src[j] === '"') break;
                else j += 1;
            }
            const text = src.slice(i, Math.min(j + 1, src.length));
            let k = j + 1;
            while (k < src.length && /\s/.test(src[k])) k += 1;
            const isKey = src[k] === ":";
            const inner = text.slice(1, -1).trim();
            push(
                isKey ? "key" : inner.startsWith("{") && inner.endsWith("}") ? "expr" : "string",
                text,
            );
            i = j + 1;
            continue;
        }

        if (/[-\d]/.test(c) && /[\d]/.test(src[i + 1] ?? c)) {
            const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
            if (m) {
                push("number", m[0]);
                i += m[0].length;
                continue;
            }
        }

        const literal = /^(true|false|null|None|True|False)\b/.exec(src.slice(i));
        if (literal) {
            push("literal", literal[0]);
            i += literal[0].length;
            continue;
        }

        push(/[{}[\],:]/.test(c) ? "punct" : "plain", c);
        i += 1;
    }
    return out;
}
