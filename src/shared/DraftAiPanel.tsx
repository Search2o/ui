import { useCallback, useEffect, useState, type ReactNode } from "react";
import * as API from "@/orval/search2o";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { HoverTip } from "@/shared/HoverTip";
import { errorText } from "@/shared/apiError";
import { DRAFT_HELP_MAX, DRAFT_HELP_MIN } from "@/shared/draftHelpPrompt";
import { uiText } from "@/shared/uiText";
import { AlertTriangle, CircleCheck, Loader2, Sparkles } from "lucide-react";

const REPLACED_NOTICE_MS = 3000;

export function DraftAiPanel({
    draftid,
    onBeforeSend,
    onReplace,
    onBusyChange,
    profiles,
}: {
    draftid: string;
    profiles?: ReactNode;
    onBeforeSend: () => Promise<boolean>;
    onReplace: (definition: string) => void;
    onBusyChange?: (busy: boolean) => void;
}) {
    const [prompt, setPrompt] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [replacedAt, setReplacedAt] = useState<number | null>(null);

    useEffect(() => {
        onBusyChange?.(busy);
    }, [busy, onBusyChange]);

    useEffect(() => {
        if (replacedAt === null) return;
        const timer = window.setTimeout(() => setReplacedAt(null), REPLACED_NOTICE_MS);
        return () => window.clearTimeout(timer);
    }, [replacedAt]);

    const tooShort = prompt.trim().length < DRAFT_HELP_MIN;

    const send = useCallback(async () => {
        if (tooShort || busy) return;
        setBusy(true);
        setError(null);
        try {
            if (!(await onBeforeSend())) return;
            const resp = await API.draftHelp({ draftid: draftid, userPrompt: prompt.trim() });
            if (!resp.success) {
                setError(resp.error?.message || "The AI could not answer.");
                return;
            }
            const written = (resp.agentDefinition ?? "").trim();
            if (!written) {
                setError(uiText("aiAssist.emptyAnswer"));
                return;
            }
            onReplace(written);
            setPrompt("");
            setReplacedAt(Date.now());
        } catch (e) {
            setError(errorText(e, "The AI could not answer."));
        } finally {
            setBusy(false);
        }
    }, [tooShort, busy, onBeforeSend, draftid, prompt, onReplace]);

    return (
        <div data-ai-assist className="space-y-3 p-4">
            {profiles}
            <Textarea
                id="ai-assist-prompt"
                aria-label={uiText("aiAssist.inputLabel")}
                rows={4}
                className="min-h-28 bg-background text-sm placeholder:text-xs"
                placeholder={uiText("aiAssist.placeholder")}
                value={prompt}
                maxLength={DRAFT_HELP_MAX}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        void send();
                    }
                }}
                disabled={busy}
            />
            <div className="flex flex-wrap items-center gap-2">
                <HoverTip tip="Ctrl+Enter / ⌘⏎">
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => void send()}
                        disabled={busy || tooShort}
                    >
                        {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                            <Sparkles className="h-4 w-4" aria-hidden />
                        )}
                        {busy ? "Writing…" : "Send"}
                    </Button>
                </HoverTip>
                <span className="text-xs text-muted-foreground">
                    {tooShort && prompt ? uiText("aiAssist.tooShort") : ""}
                </span>
                {busy ? (
                    <span className="text-xs text-muted-foreground">
                        {uiText("aiAssist.working")}
                    </span>
                ) : null}
                {replacedAt !== null ? (
                    <span
                        role="status"
                        className="animate-in fade-in inline-flex items-center gap-1.5 text-xs text-muted-foreground duration-200"
                    >
                        <CircleCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
                        {uiText("aiAssist.replaced")}
                    </span>
                ) : null}
            </div>
            {error ? (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    <AlertTitle className="line-clamp-none font-normal">{error}</AlertTitle>
                </Alert>
            ) : null}
        </div>
    );
}
