import type { ReactNode, Ref } from "react";
import { HoverTip } from "@/shared/HoverTip";
import { Composer } from "@/shared/Composer";
import { uiText } from "@/shared/uiText";

export function DraftQueryField({
    inConversation,
    validationQuery,
    followupQuery,
    disabled = false,
    onValidationQueryChange,
    onFollowupQueryChange,
    onStartOver,
    action,
    inputRef,
}: {
    inConversation: boolean;
    validationQuery: string;
    followupQuery: string;
    disabled?: boolean;
    onValidationQueryChange: (value: string) => void;
    onFollowupQueryChange: (value: string) => void;
    onStartOver: () => void;
    action?: ReactNode;
    inputRef?: Ref<HTMLTextAreaElement>;
}) {
    const label = inConversation ? "Follow-up question" : "Validation query";
    return (
        <Composer
            ref={inputRef}
            id="validationQuery"
            aria-label={label}
            rows={2}
            value={inConversation ? followupQuery : validationQuery}
            onChange={(e) =>
                inConversation
                    ? onFollowupQueryChange(e.target.value)
                    : onValidationQueryChange(e.target.value)
            }
            placeholder={
                inConversation ? "Ask this conversation another question." : "A typical user query."
            }
            options={
                <>
                    <HoverTip
                        tip={
                            inConversation
                                ? uiText("draft.followupHelp")
                                : uiText("draft.validationQueryHelp")
                        }
                    >
                        <span className="cursor-help px-1 text-xs text-muted-foreground">
                            {label}
                        </span>
                    </HoverTip>
                    {inConversation ? (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={onStartOver}
                            className="rounded px-1 text-xs text-primary underline-offset-2 hover:underline disabled:opacity-50"
                        >
                            Start over with the validation query
                        </button>
                    ) : null}
                </>
            }
            action={action}
        />
    );
}
