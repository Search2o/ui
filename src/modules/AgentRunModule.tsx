import { type KeyboardEvent, useCallback, useState } from "react";
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
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

    return (
        <div className="grid gap-4 p-4">
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2 space-y-0">
                    <div className="space-y-1">
                        <ModuleCardTitle
                            title={`${payload?.agentTitle ?? ""} (${agentName})`}
                            help="agent-run"
                        />
                        <UpdatedBy obj={payload} />
                    </div>

                    <BackButton fallback="Agents" />
                </CardHeader>

                <CardContent className="space-y-3">
                    <div className="relative">
                        <Textarea
                            id="searchbox3"
                            aria-label="Agent query input"
                            placeholder={uiText("placeholder.agentRunQuery")}
                            rows={4}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={onKeyDown}
                            className="pr-12"
                        />
                        <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            aria-label="Run query"
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="absolute bottom-2 right-2"
                        >
                            <Search className="size-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
