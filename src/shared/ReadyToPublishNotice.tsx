import { CircleCheck, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uiText } from "@/shared/uiText";

export function ReadyToPublishNotice({ onPublish }: { onPublish: () => void }) {
    return (
        <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 border-t bg-primary/5 px-4 py-3"
        >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <CircleCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {uiText("draft.readyToPublish")}
            </span>
            <Button type="button" size="sm" onClick={onPublish}>
                <Rocket className="mr-2 h-4 w-4" aria-hidden />
                Publish
            </Button>
        </div>
    );
}
