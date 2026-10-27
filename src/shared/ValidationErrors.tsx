import { XCircle } from "lucide-react";
import type { ValidationResult } from "@/orval/search2o.schemas";
import { HoverTip } from "@/shared/HoverTip";
import { promptErrorTarget } from "@/shared/agentPrompts";

const KIND_LABEL: Record<string, string> = {
    secret: "Secret",
    allowlistItem: "Allowlist item",
    constItem: "Const item",
};

export function ValidationErrors({
    errors,
    onOpenPath,
    onOpenAllowlist,
}: {
    errors: ValidationResult[];
    onOpenPath: (path: string) => void;
    onOpenAllowlist: () => void;
}) {
    return (
        <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                Validation errors
            </div>
            <ul className="mt-1.5 space-y-1.5 text-sm text-destructive">
                {errors.map((err, idx) => {
                    const label = KIND_LABEL[err.vtype];
                    return (
                        <li key={`${err.path ?? ""}|${err.detail}|${idx}`}>
                            <div className="break-words">
                                {label ? (
                                    <span className="mr-1.5 rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium">
                                        {label}
                                    </span>
                                ) : null}
                                {err.detail}
                            </div>
                            {err.path || err.vtype === "allowlistItem" ? (
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-destructive/80">
                                    {err.path ? (
                                        <span className="font-mono">
                                            at{" "}
                                            <HoverTip
                                                tip={`${err.path} — click to show it in the ${promptErrorTarget(err.path) ? "prompts" : "definition"}`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenPath(err.path!)}
                                                    className="rounded underline-offset-2 transition-colors hover:text-destructive hover:underline"
                                                >
                                                    {err.path}
                                                </button>
                                            </HoverTip>
                                        </span>
                                    ) : null}
                                    {err.vtype === "allowlistItem" ? (
                                        <button
                                            type="button"
                                            onClick={onOpenAllowlist}
                                            className="rounded underline underline-offset-2 transition-colors hover:text-destructive"
                                        >
                                            Open Allowlist
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
