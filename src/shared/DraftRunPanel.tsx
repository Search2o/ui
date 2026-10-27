import { forwardRef, useState } from "react";
import { Loader2, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AskInputsForm } from "@/shared/AskInputsForm";
import { DraftQueryField } from "@/shared/DraftQueryField";
import { HoverTip } from "@/shared/HoverTip";
import { ReadyToPublishNotice } from "@/shared/ReadyToPublishNotice";
import { ValidationBadge } from "@/shared/ValidationBadge";
import { ValidationErrors } from "@/shared/ValidationErrors";
import { ValidationOutput } from "@/shared/ValidationOutput";
import { DEFAULT_OUTPUT_CATEGORIES, type OutputCategory } from "@/shared/outputCategories";
import type { DraftValidation } from "@/shared/useDraftValidation";
import type { ValidationStatus } from "@/shared/validationStatus";

export const DraftRunPanel = forwardRef<
    HTMLDivElement,
    {
        run: DraftValidation;
        status: ValidationStatus;
        validationQuery: string;
        onValidationQueryChange: (query: string) => void;
        runDisabled: boolean;
        runTip: string;
        readyToPublish: boolean;
        onPublish: () => void;
        agentName: string | null;
        onOpenErrorPath: (path: string) => void;
        onOpenTracePath: (path: string) => void;
        onOpenAllowlist: () => void;
    }
>(function DraftRunPanel(
    {
        run,
        status,
        validationQuery,
        onValidationQueryChange,
        runDisabled,
        runTip,
        readyToPublish,
        onPublish,
        agentName,
        onOpenErrorPath,
        onOpenTracePath,
        onOpenAllowlist,
    },
    ref,
) {
    const [shown, setShown] = useState<Set<OutputCategory>>(
        () => new Set(DEFAULT_OUTPUT_CATEGORIES),
    );

    return (
        <div
            ref={ref}
            role="region"
            aria-label="Validation run"
            className="scroll-mt-20 border-t-2 border-primary"
        >
            <div className="flex h-11 items-center gap-2.5 border-b border-primary/20 bg-primary/10 pr-2 pl-4">
                <span className="text-sm font-semibold text-primary">Validation run</span>
                <span className="inline-flex sm:hidden">
                    <ValidationBadge status={status} />
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <HoverTip tip={runTip} wrap={runDisabled}>
                        <Button
                            size="sm"
                            variant={run.pendingAsk || readyToPublish ? "outline" : "default"}
                            className="h-7"
                            onClick={() => void run.onValidate()}
                            disabled={runDisabled}
                        >
                            {run.isValidating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                                <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                            )}
                            {run.isValidating ? "Running" : run.inConversation ? "Ask" : "Run"}
                        </Button>
                    </HoverTip>
                </div>
            </div>
            <div ref={run.queryRef} className="scroll-mt-20 p-4">
                <DraftQueryField
                    inputRef={run.queryBoxRef}
                    inConversation={run.inConversation}
                    validationQuery={validationQuery}
                    followupQuery={run.followupQuery}
                    disabled={run.isValidating}
                    onValidationQueryChange={onValidationQueryChange}
                    onFollowupQueryChange={run.setFollowupQuery}
                    onStartOver={run.startOver}
                />
            </div>

            {readyToPublish ? <ReadyToPublishNotice onPublish={onPublish} /> : null}

            {run.hasAnything ? (
                <div className="divide-y border-t">
                    {run.askWithoutForm ? (
                        <div className="bg-amber-500/10 px-4 py-3 text-sm">
                            This agent paused to ask the user for input, so the validation run
                            stopped there — it has not failed. The response carried no form, so the
                            answers cannot be supplied from here; run the published agent, or
                            re-validate once the server returns the question.
                        </div>
                    ) : null}

                    {run.pendingAsk ? (
                        <div className="p-4">
                            <AskInputsForm
                                askInput={run.pendingAsk}
                                agentName={agentName}
                                disabled={run.isValidating}
                                onSubmit={(answers) => void run.onValidate(answers)}
                            />
                        </div>
                    ) : null}

                    {run.validationErrors?.length || run.runtimeError ? (
                        <div ref={run.errorBlockRef} className="space-y-3 bg-destructive/5 p-4">
                            {run.validationErrors?.length ? (
                                <ValidationErrors
                                    errors={run.validationErrors}
                                    onOpenPath={onOpenErrorPath}
                                    onOpenAllowlist={onOpenAllowlist}
                                />
                            ) : null}
                            {run.runtimeError ? (
                                <div>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                                        <XCircle className="h-3.5 w-3.5" />
                                        Runtime error
                                    </div>
                                    <div className="mt-1.5 break-words text-sm text-destructive">
                                        {run.runtimeError}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {run.hasOutput || run.isValidating ? (
                        <ValidationOutput
                            items={run.traceItems}
                            shown={shown}
                            onShownChange={setShown}
                            running={run.isValidating}
                            canClear={run.hasOutput}
                            onStop={run.cancel}
                            onClear={run.clearOutput}
                            onOpenPath={onOpenTracePath}
                        />
                    ) : null}
                </div>
            ) : null}
        </div>
    );
});
