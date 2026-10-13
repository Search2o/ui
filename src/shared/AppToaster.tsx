import { Toaster, toast, type ToasterProps } from "sonner";
import { useSession } from "@/shared/useSession";
import { useUiConfig } from "@/shared/uiConfig";
import { toastsSuppressed } from "@/shared/sessionExpiry";

function suppressToastsDuringSignOut() {
    const guarded = toast as unknown as { __s2oGuarded?: boolean };
    if (guarded.__s2oGuarded) return;
    guarded.__s2oGuarded = true;

    type LooseToast = (...args: unknown[]) => string | number;

    for (const kind of ["error", "warning"] as const) {
        const original = toast[kind] as unknown as LooseToast;
        const guard: LooseToast = (...args) => (toastsSuppressed() ? "" : original(...args));
        toast[kind] = guard as unknown as (typeof toast)[typeof kind];
    }
}

suppressToastsDuringSignOut();

export function AppToaster() {
    const { theme } = useSession();
    const { toastDurationSeconds } = useUiConfig();

    return (
        <Toaster
            theme={(theme ?? "system") as ToasterProps["theme"]}
            richColors
            closeButton
            position="top-right"
            duration={toastDurationSeconds * 1000}
            className="font-sans"
            style={
                {
                    "--normal-bg": "hsl(var(--popover))",
                    "--normal-text": "hsl(var(--popover-foreground))",
                    "--normal-border": "hsl(var(--border))",
                } as React.CSSProperties
            }
            toastOptions={{
                classNames: {
                    toast: "rounded-xl border shadow-lg",
                    title: "text-sm font-medium",
                    description: "text-xs",
                },
            }}
        />
    );
}
