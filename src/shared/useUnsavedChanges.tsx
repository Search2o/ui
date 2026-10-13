import { useCallback, useEffect, useRef, useState } from "react";
import * as UI from "@/shared/uistate";
import { registerDirtyCheck } from "@/shared/sessionExpiry";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function useUnsavedChanges({
    isDirty,
    onSave,
    what = "changes",
}: {
    isDirty: () => boolean;
    onSave?: () => Promise<boolean>;
    what?: string;
}) {
    const [pendingNav, setPendingNav] = useState<{
        next: UI.ModuleKey;
        payload?: UI.ModulePayload;
    } | null>(null);
    const [saving, setSaving] = useState(false);

    const dirtyRef = useRef(isDirty);
    dirtyRef.current = isDirty;

    const guardRef = useRef<UI.NavigationGuard | null>(null);
    useEffect(() => {
        const guard: UI.NavigationGuard = (next, payload) => {
            if (!dirtyRef.current()) return true;
            setPendingNav({ next, payload });
            return false;
        };
        guardRef.current = guard;
        UI.setNavigationGuard(guard);
        return () => UI.clearNavigationGuard(guard);
    }, []);

    useEffect(() => registerDirtyCheck(() => dirtyRef.current()), []);

    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!dirtyRef.current()) return;
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    const resume = useCallback((nav: { next: UI.ModuleKey; payload?: UI.ModulePayload }) => {
        if (guardRef.current) UI.clearNavigationGuard(guardRef.current);
        setPendingNav(null);
        UI.openModule(nav.next, nav.payload);
    }, []);

    const release = useCallback(() => {
        if (guardRef.current) UI.clearNavigationGuard(guardRef.current);
        guardRef.current = null;
    }, []);

    const dialog = (
        <AlertDialog open={pendingNav !== null} onOpenChange={(o) => !o && setPendingNav(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
                    <AlertDialogDescription>
                        This {what} has changes that have not been saved. Leaving now discards them.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep editing</AlertDialogCancel>
                    <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={saving}
                        onClick={() => pendingNav && resume(pendingNav)}
                    >
                        Discard changes
                    </Button>
                    {onSave ? (
                        <AlertDialogAction
                            disabled={saving}
                            onClick={async (e) => {
                                e.preventDefault();
                                if (!pendingNav) return;
                                setSaving(true);
                                try {
                                    if (await onSave()) resume(pendingNav);
                                } finally {
                                    setSaving(false);
                                }
                            }}
                        >
                            {saving ? "Saving…" : "Save and leave"}
                        </AlertDialogAction>
                    ) : null}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return { dialog, release };
}
