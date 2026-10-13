import { useEffect, useRef, type ReactNode } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uiText } from "@/shared/uiText";

export function ActionBar({
    onUpdate,
    dirty,
    busy = false,
    disabled = false,
    message,
    start,
    label = "Update",
}: {
    onUpdate: () => void;
    dirty: boolean;
    busy?: boolean;
    disabled?: boolean;
    message?: ReactNode;
    start?: ReactNode;
    label?: string;
}) {
    const canUpdate = dirty && !busy && !disabled;

    const latest = useRef({ canUpdate, onUpdate });
    latest.current = { canUpdate, onUpdate };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey) || e.key?.toLowerCase() !== "s") return;
            e.preventDefault();
            if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
            if (latest.current.canUpdate) latest.current.onUpdate();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const note = message ?? (dirty && !busy ? uiText("actionBar.unsaved") : null);

    return (
        <div
            data-testid="action-bar"
            className="action-bar sticky bottom-0 z-20 flex min-h-16 flex-wrap items-center gap-3 border-t bg-background px-6 py-3"
        >
            {start}
            <span
                className="min-w-0 flex-1 text-right text-sm text-muted-foreground"
                aria-live="polite"
            >
                {note}
            </span>
            <Button onClick={onUpdate} disabled={!canUpdate} variant="outline">
                <Save className="h-4 w-4" />
                {busy ? "Updating…" : label}
            </Button>
        </div>
    );
}
