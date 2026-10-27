import type { ReactNode } from "react";
import type { TraceType } from "@/orval/search2o.schemas";
import type { OutputCategory } from "@/shared/outputCategories";
import { uiText } from "@/shared/uiText";

export type AgentPart = "const" | "prompts" | "definition";

export function limitText(value: number | null | undefined): string {
    return value == null ? "" : String(value);
}

export function parseLimits(
    timeText: string,
    costText: string,
): { maxTime: number; maxCost: number } | { error: string } {
    const time = Number(timeText.trim());
    const cost = Number(costText.trim());
    if (!timeText.trim() || !Number.isInteger(time) || time < 1) {
        return { error: uiText("validate.maxTime") };
    }
    if (!costText.trim() || !Number.isFinite(cost) || cost <= 0) {
        return { error: uiText("validate.maxCost") };
    }
    return { maxTime: time, maxCost: cost };
}

export type TraceKind = "trace" | "progress" | "data";

export type TraceItem = {
    kind: TraceKind;
    traceType?: TraceType;
    node: ReactNode;
    duration?: number;
    path?: string;
    id: number;
};

export function categoryOf(item: Pick<TraceItem, "kind" | "traceType">): OutputCategory {
    return item.traceType ?? (item.kind === "progress" ? "progress" : "data");
}

export function formatTraceAge(ms: number): string {
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
