import type { UserRole } from "@/orval/search2o.schemas";
import { Mail, NotebookText, Logs, Search } from "lucide-react";
import {
    SCHEMATIC,
    type BeatTarget,
    type SchematicRow,
    bandIconBox,
    schematicRows,
} from "@/shared/welcomeTour";
import { type Box, rowBox, targetBox } from "@/shared/welcomeLayout";

export function WelcomeSchematic({
    role,
    expand,
    target,
    reduced,
}: {
    role: UserRole | null | undefined;
    expand?: string;
    target: BeatTarget;
    reduced?: boolean;
}) {
    const rows = schematicRows(role, expand);
    const box = targetBox(target, rows);

    return (
        <div className="@container">
            <div
                className="relative w-full overflow-hidden rounded-xl border bg-surface leading-none"
                style={{ aspectRatio: "16 / 10", fontSize: SCHEMATIC_FONT_SIZE }}
            >
                <div
                    className="absolute border-r bg-muted/40"
                    style={pct(SCHEMATIC.rail)}
                    aria-hidden
                />
                <div
                    className="absolute border-b bg-muted/20"
                    style={pct(SCHEMATIC.band)}
                    aria-hidden
                />

                <span
                    className="absolute flex items-center font-semibold text-muted-foreground"
                    style={{
                        top: `${SCHEMATIC.band.top}%`,
                        left: `${SCHEMATIC.band.left + 3}%`,
                        height: `${SCHEMATIC.band.height}%`,
                    }}
                    aria-hidden
                >
                    Your account
                </span>

                {[Logs, NotebookText, Mail].map((Icon, i) => (
                    <span
                        key={i}
                        className="absolute flex items-center justify-center"
                        style={pct(bandIconBox(i))}
                        aria-hidden
                    >
                        <Icon
                            className="text-muted-foreground"
                            style={{ height: "62%", width: "auto" }}
                        />
                    </span>
                ))}

                {rows.map((row, i) => (
                    <RailRow
                        key={`${row.kind}-${row.label}-${i}`}
                        row={row}
                        box={rowBox(rows, i)}
                    />
                ))}

                <span
                    className="absolute font-semibold text-foreground/70"
                    style={{
                        top: `${SCHEMATIC.query.top - 6}%`,
                        left: `${SCHEMATIC.query.left}%`,
                    }}
                    aria-hidden
                >
                    Search
                </span>
                <div
                    className="absolute flex items-center gap-1 rounded-md border bg-background px-1.5"
                    style={pct(SCHEMATIC.query)}
                    aria-hidden
                >
                    <Search
                        className="shrink-0 text-muted-foreground"
                        style={{ height: "10%", width: "auto" }}
                    />
                    <span className="text-muted-foreground">Ask a question…</span>
                </div>

                <div
                    className="absolute rounded-md bg-primary/10 outline-2 outline-offset-2 outline-primary shadow-[0_0_0_9999px_rgba(15,23,20,0.09)] dark:shadow-[0_0_0_9999px_rgba(0,0,0,0.34)]"
                    style={{
                        ...pct(box),
                        transition: reduced
                            ? "none"
                            : "top 600ms cubic-bezier(0.4,0,0.2,1), left 600ms cubic-bezier(0.4,0,0.2,1), width 600ms cubic-bezier(0.4,0,0.2,1), height 600ms cubic-bezier(0.4,0,0.2,1)",
                    }}
                    aria-hidden
                />
            </div>
        </div>
    );
}

const DRAWN_WIDTH_PX = 622;
const SCHEMATIC_FONT_SIZE = `clamp(5px, ${(8 / DRAWN_WIDTH_PX) * 100}cqw, 8px)`;

function pct(box: Box) {
    return {
        top: `${box.top}%`,
        left: `${box.left}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
    };
}

function RailRow({ row, box }: { row: SchematicRow; box: Box }) {
    const base = "absolute flex items-center overflow-hidden whitespace-nowrap";
    const style = pct(box);

    if (row.kind === "pinned") {
        return (
            <div
                className={`${base} justify-center rounded-md bg-primary/85 font-semibold text-primary-foreground`}
                style={style}
            >
                {row.label}
            </div>
        );
    }
    if (row.kind === "switch") {
        return (
            <div
                className={`${base} justify-center rounded-md border bg-background text-muted-foreground`}
                style={style}
            >
                {row.label}
            </div>
        );
    }
    if (row.kind === "group") {
        return (
            <div
                className={`${base} pl-2 text-[0.875em] font-semibold uppercase tracking-[0.09em] text-[#8fa39f]`}
                style={style}
            >
                {row.label}
            </div>
        );
    }
    if (row.kind === "footer") {
        return (
            <div className={`${base} gap-1.5 border-t pl-2 text-muted-foreground`} style={style}>
                <span
                    className="shrink-0 rounded-full bg-primary/70"
                    style={{ height: "55%", aspectRatio: "1" }}
                />
                {row.label}
            </div>
        );
    }
    return (
        <div className={`${base} pl-4 text-foreground/80`} style={style}>
            {row.label}
        </div>
    );
}
