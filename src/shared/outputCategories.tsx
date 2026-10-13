import {
    Activity,
    AlertTriangle,
    ArrowDownToLine,
    ArrowUpFromLine,
    FileText,
    MessageSquare,
    PenLine,
    Workflow,
    Wrench,
} from "lucide-react";
import { uiText } from "@/shared/uiText";
import type { ComponentType } from "react";
import { TraceType } from "@/orval/search2o.schemas";

export type OutputCategory = TraceType | "progress" | "data";

export type OutputCategoryInfo = {
    label: string;
    Icon: ComponentType<{ className?: string }>;
    tone: string;
};

export const OUTPUT_CATEGORY_ORDER: OutputCategory[] = [
    "data",
    "progress",
    TraceType.agent,
    TraceType.flow,
    TraceType.input,
    TraceType.output,
    TraceType.tool,
    TraceType.invoke,
    TraceType.error,
];

export const OUTPUT_CATEGORY_INFO: Record<OutputCategory, OutputCategoryInfo> = {
    data: {
        label: "Agent output",
        Icon: FileText,
        tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
    },
    progress: {
        label: "Progress",
        Icon: MessageSquare,
        tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    },
    agent: {
        label: "Agent trace",
        Icon: PenLine,
        tone: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
    },
    flow: {
        label: "Flow",
        Icon: Activity,
        tone: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
    },
    input: {
        label: "Input",
        Icon: ArrowUpFromLine,
        tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    },
    output: {
        label: "Output",
        Icon: ArrowDownToLine,
        tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    tool: {
        label: "Tool",
        Icon: Wrench,
        tone: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
    },
    invoke: {
        label: "Invoke",
        Icon: Workflow,
        tone: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
    },
    error: {
        label: "Error",
        Icon: AlertTriangle,
        tone: "bg-destructive/15 text-destructive",
    },
};

export const DEFAULT_OUTPUT_CATEGORIES: OutputCategory[] = [...OUTPUT_CATEGORY_ORDER];

export function outputCategoryHint(category: OutputCategory): string {
    switch (category) {
        case "data":
            return uiText("trace.output");
        case "progress":
            return uiText("trace.progress");
        case TraceType.agent:
            return uiText("trace.authorNotes");
        case TraceType.flow:
            return uiText("trace.flow");
        case TraceType.input:
            return uiText("trace.inputs");
        case TraceType.output:
            return uiText("trace.results");
        case TraceType.tool:
            return uiText("trace.tools");
        case TraceType.invoke:
            return uiText("trace.agents");
        case TraceType.error:
            return uiText("trace.errors");
    }
}
