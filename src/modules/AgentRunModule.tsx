import { type KeyboardEvent, useCallback, useState } from "react";
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";
import { Composer } from "@/shared/Composer";
import { UpdatedBy } from "@/shared/UpdatedBy";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { uiText } from "@/shared/uiText";

export default function AgentRunModule() {
    const payload = UI.useModulePayload<UI.AgentPayloadType>();
    const agentName = payload?.agentName ?? "";
    const [query, setQuery] = useState<string>("");

    const canSubmit = query.trim().length > 0;

    const handleSubmit = useCallback(async () => {
        if (!agentName) {
            toast.error("Missing agent name.");
            return;
        }
        if (!canSubmit) return;
        const q = query.trim();
        if (!q) return;
        UI.openModule("SearchConversation", { query: q, agentName });
    }, [agentName, canSubmit, query]);

    const onKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSubmit) void handleSubmit();
            }
        },
        [canSubmit, handleSubmit],
    );

    const title = payload?.agentTitle ? `${payload.agentTitle} (${agentName})` : agentName;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div className="min-w-0 space-y-1">
                    <ModuleCardTitle title={title} help="agent-run" />
                    <UpdatedBy obj={payload} />
                </div>

                <BackButton fallback="Agents" />
            </CardHeader>

            <CardContent>
                <Composer
                    id="searchbox3"
                    aria-label="Agent query input"
                    placeholder={uiText("placeholder.agentRunQuery")}
                    rows={2}
                    className="min-h-[64px] text-base leading-relaxed"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    action={
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                        >
                            <SendHorizontal className="h-4 w-4" aria-hidden />
                            Send
                        </Button>
                    }
                />
            </CardContent>
        </Card>
    );
}
