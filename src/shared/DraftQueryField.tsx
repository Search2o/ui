import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HoverTip } from "@/shared/HoverTip";
import { uiText } from "@/shared/uiText";

export function DraftQueryField({
    inConversation,
    validationQuery,
    followupQuery,
    disabled = false,
    onValidationQueryChange,
    onFollowupQueryChange,
    onStartOver,
}: {
    inConversation: boolean;
    validationQuery: string;
    followupQuery: string;
    disabled?: boolean;
    onValidationQueryChange: (value: string) => void;
    onFollowupQueryChange: (value: string) => void;
    onStartOver: () => void;
}) {
    return (
        <>
            <div className="flex items-center justify-between gap-3">
                <HoverTip
                    tip={
                        inConversation
                            ? uiText("draft.followupHelp")
                            : uiText("draft.validationQueryHelp")
                    }
                >
                    <Label htmlFor="validationQuery" className="text-sm">
                        {inConversation ? "Follow-up question" : "Validation query"}
                    </Label>
                </HoverTip>
                {inConversation ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={disabled}
                        onClick={onStartOver}
                    >
                        Start over with the validation query
                    </Button>
                ) : null}
            </div>
            <Textarea
                id="validationQuery"
                rows={2}
                className="mt-1 min-h-0 text-sm"
                value={inConversation ? followupQuery : validationQuery}
                onChange={(e) =>
                    inConversation
                        ? onFollowupQueryChange(e.target.value)
                        : onValidationQueryChange(e.target.value)
                }
                placeholder={
                    inConversation
                        ? "Ask this conversation another question, or start over above."
                        : "A typical user query."
                }
            />
        </>
    );
}
