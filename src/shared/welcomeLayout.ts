import { RAIL_ROWS, type BeatTarget, type SchematicRow, bandIconBox } from "@/shared/welcomeTour";

export type Box = { top: number; left: number; width: number; height: number };

export function rowHeight(rows: SchematicRow[]): number {
    const stacked = rows.filter((r) => r.kind !== "footer").length || 1;
    const available = 100 - RAIL_ROWS.top - RAIL_ROWS.bottom - RAIL_ROWS.maxHeight - 3;
    return Math.min(RAIL_ROWS.maxHeight, available / stacked);
}

export function rowBox(rows: SchematicRow[], index: number): Box {
    const pitch = rowHeight(rows);
    const height = Math.max(1, pitch - RAIL_ROWS.gap);
    const common = { left: RAIL_ROWS.left, width: RAIL_ROWS.width, height };
    if (rows[index]?.kind === "footer") {
        return { ...common, top: 100 - RAIL_ROWS.bottom - height };
    }
    return { ...common, top: RAIL_ROWS.top + index * pitch + RAIL_ROWS.gap / 2 };
}

export function targetBox(target: BeatTarget, rows: SchematicRow[]): Box {
    if (target.kind === "box") return target;
    if (target.kind === "icon") return bandIconBox(target.index);
    const first = rowBox(rows, target.from);
    const last = rowBox(rows, target.to);
    return {
        top: first.top,
        left: first.left,
        width: first.width,
        height: last.top + last.height - first.top,
    };
}
