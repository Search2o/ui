import type { KeyboardEvent, ReactNode } from "react";
import { CircleCheck, CircleDashed, Loader2, XCircle } from "lucide-react";
import { HoverTip } from "@/shared/HoverTip";
import { uiText } from "@/shared/uiText";
import type { AssistMode, ValidationStatus } from "@/shared/validationStatus";

const TABS: AssistMode[] = ["ai", "validate"];

export function DraftAssistTabs({
    mode,
    onModeChange,
    aiBusy,
    validation,
}: {
    mode: AssistMode;
    onModeChange: (mode: AssistMode) => void;
    aiBusy: boolean;
    validation: ValidationStatus;
}) {
    const validating = validation === "validating";

    const lockReason = (tab: AssistMode): string | null => {
        if (tab === mode) return null;
        if (aiBusy) return uiText("draft.tabs.waitForAi");
        if (validating) return uiText("draft.tabs.waitForValidation");
        return null;
    };

    const select = (tab: AssistMode) => {
        if (tab === mode || lockReason(tab)) return;
        onModeChange(tab);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const i = TABS.indexOf(mode);
        let next: AssistMode | null = null;
        if (e.key === "ArrowRight") next = TABS[(i + 1) % TABS.length];
        else if (e.key === "ArrowLeft") next = TABS[(i - 1 + TABS.length) % TABS.length];
        else if (e.key === "Home") next = TABS[0];
        else if (e.key === "End") next = TABS[TABS.length - 1];
        if (!next) return;
        e.preventDefault();
        if (lockReason(next)) return;
        select(next);
        document.getElementById(`draft-tab-${next}`)?.focus();
    };

    const tab = (id: AssistMode, label: string, status: ReactNode) => {
        const selected = mode === id;
        const reason = lockReason(id);
        return (
            <HoverTip key={id} tip={reason}>
                <button
                    id={`draft-tab-${id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`draft-panel-${id}`}
                    aria-disabled={reason ? true : undefined}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => select(id)}
                    className={`relative flex min-w-0 items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                        selected
                            ? "bg-surface text-foreground"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    } ${reason ? "cursor-not-allowed opacity-60 hover:bg-muted/50 hover:text-muted-foreground" : ""}`}
                >
                    <span className="truncate">{label}</span>
                    {status}
                    {selected ? (
                        <span
                            aria-hidden
                            className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                        />
                    ) : null}
                </button>
            </HoverTip>
        );
    };

    return (
        <div
            role="tablist"
            aria-label="Draft with AI or Validate"
            onKeyDown={onKeyDown}
            className="grid grid-cols-2 divide-x border-b"
        >
            {tab(
                "ai",
                "Draft with AI",
                aiBusy ? (
                    <Status className="border-border text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        Writing
                    </Status>
                ) : null,
            )}
            {tab("validate", "Validate", <ValidationBadge status={validation} />)}
        </div>
    );
}

function Status({ className, children }: { className: string; children: ReactNode }) {
    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
        >
            {children}
        </span>
    );
}

function ValidationBadge({ status }: { status: ValidationStatus }) {
    switch (status) {
        case "validating":
            return (
                <Status className="border-border text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    Validating
                </Status>
            );
        case "failed":
            return (
                <Status className="border-destructive/40 bg-destructive/10 text-destructive">
                    <XCircle className="h-3 w-3" aria-hidden />
                    Failed
                </Status>
            );
        case "validated":
            return (
                <Status className="border-primary/40 bg-primary/10 text-primary">
                    <CircleCheck className="h-3 w-3" aria-hidden />
                    Validated
                </Status>
            );
        default:
            return (
                <Status className="border-border text-muted-foreground">
                    <CircleDashed className="h-3 w-3" aria-hidden />
                    Not validated
                </Status>
            );
    }
}
