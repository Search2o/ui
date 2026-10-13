import type { UserRole } from "@/orval/search2o.schemas";
import { canSeeDevActions, railGroupsFor } from "@/shared/railGroups";
import { uiText, uiTextOptional } from "@/shared/uiText";

export type SchematicRow =
    | { kind: "pinned"; label: string }
    | { kind: "switch"; label: string }
    | { kind: "group"; label: string }
    | { kind: "item"; label: string }
    | { kind: "footer"; label: string };

export type BeatTarget =
    | { kind: "rows"; from: number; to: number }
    | { kind: "box"; top: number; left: number; width: number; height: number }
    | { kind: "icon"; index: number };

export type TourBeat = {
    id: string;
    target: BeatTarget;
    title: string;
    body: string;
    expand?: string;
};

export const SCHEMATIC = {
    rail: { top: 0, left: 0, width: 30, height: 100 },
    band: { top: 0, left: 30, width: 70, height: 11 },
    query: { top: 20, left: 35, width: 60, height: 22 },
} as const;

export const RAIL_ROWS = {
    top: 5,
    left: 3,
    width: 24,
    bottom: 4,
    maxHeight: 8.4,
    gap: 2.2,
} as const;

export const BAND_ICONS = { count: 3, size: 5, gap: 1.5, right: 3 } as const;

export function bandIconBox(index: number) {
    const groupWidth = BAND_ICONS.count * BAND_ICONS.size + (BAND_ICONS.count - 1) * BAND_ICONS.gap;
    const left = 100 - BAND_ICONS.right - groupWidth + index * (BAND_ICONS.size + BAND_ICONS.gap);
    const height = SCHEMATIC.band.height * 0.62;
    return {
        top: SCHEMATIC.band.top + (SCHEMATIC.band.height - height) / 2,
        left,
        width: BAND_ICONS.size,
        height,
    };
}

export function schematicRows(
    role: UserRole | null | undefined,
    expanded?: string,
): SchematicRow[] {
    const hasMenu = canSeeDevActions(role);
    const rows: SchematicRow[] = [{ kind: "pinned", label: "New search" }];
    if (hasMenu) rows.push({ kind: "switch", label: "Platform · Searches" });

    if (hasMenu) {
        for (const group of railGroupsFor(role)) {
            rows.push({ kind: "group", label: group.label });
            if (group.label === expanded) {
                for (const item of group.items) rows.push({ kind: "item", label: item.label });
            }
        }
    } else {
        rows.push({ kind: "group", label: "Searches" });
        for (const label of ["Expense policy", "Laptop setup", "Payroll dates"]) {
            rows.push({ kind: "item", label });
        }
    }

    rows.push({ kind: "footer", label: "Your profile" });
    return rows;
}

export function tourBeats(role: UserRole | null | undefined): TourBeat[] {
    const hasMenu = canSeeDevActions(role);
    const base = schematicRows(role);

    const beats: TourBeat[] = [
        {
            id: "ask",
            target: { kind: "box", ...SCHEMATIC.query },
            title: uiText("welcome.ask.title"),
            body: uiText("welcome.ask.body"),
        },
        {
            id: "newSearch",
            target: { kind: "rows", from: 0, to: 0 },
            title: uiText("welcome.newSearch.title"),
            body: uiText("welcome.newSearch.body"),
        },
    ];

    if (hasMenu) {
        beats.push({
            id: "platform",
            target: { kind: "rows", from: 1, to: 1 },
            title: uiText("welcome.platform.title"),
            body: uiText("welcome.platform.body"),
        });

        for (const group of railGroupsFor(role)) {
            const rows = schematicRows(role, group.label);
            const at = rows.findIndex((r) => r.kind === "group" && r.label === group.label);
            if (at < 0) continue;
            beats.push({
                id: `group:${group.label}`,
                target: { kind: "rows", from: at, to: at + group.items.length },
                title: group.label,
                body: uiTextOptional(`welcome.group.${group.label}`) ?? "",
                expand: group.label,
            });
        }
    } else {
        const at = base.findIndex((r) => r.kind === "group" && r.label === "Searches");
        beats.push({
            id: "searches",
            target: { kind: "rows", from: at, to: base.length - 2 },
            title: uiText("welcome.searches.title"),
            body: uiText("welcome.searches.body"),
        });
    }

    [
        {
            id: "auditLog",
            title: uiText("welcome.icon.auditLog.title"),
            body: uiText("welcome.icon.auditLog.body"),
        },
        {
            id: "docs",
            title: uiText("welcome.icon.docs.title"),
            body: uiText("welcome.icon.docs.body"),
        },
        {
            id: "help",
            title: uiText("welcome.icon.help.title"),
            body: uiText("welcome.icon.help.body"),
        },
    ].forEach((icon, i) => {
        beats.push({
            id: `icon:${icon.id}`,
            target: { kind: "icon", index: i },
            title: icon.title,
            body: icon.body,
        });
    });

    beats.push({
        id: "profile",
        target: { kind: "rows", from: base.length - 1, to: base.length - 1 },
        title: uiText("welcome.profile.title"),
        body: uiText("welcome.profile.body"),
    });

    return beats;
}

export const BEAT_MS = 5000;
