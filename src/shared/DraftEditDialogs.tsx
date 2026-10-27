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
import { metaFieldLabel } from "@/shared/publishMeta";
import { uiText } from "@/shared/uiText";

export function UndoAiEditDialog({
    open,
    onOpenChange,
    onUndo,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUndo: () => void;
}) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Undo the last AI edit?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Your unsaved changes to the definition will be discarded, and the draft will
                        be saved as it was before that edit.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep my changes</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            onOpenChange(false);
                            onUndo();
                        }}
                    >
                        Undo
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function MetaChangedDialog({
    fields,
    onClose,
    onReplace,
}: {
    fields: string[] | null;
    onClose: () => void;
    onReplace: () => void;
}) {
    return (
        <AlertDialog
            open={fields !== null}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>The agent changed after this draft was made</AlertDialogTitle>
                    <AlertDialogDescription>{uiText("publish.metaChanged")}</AlertDialogDescription>
                </AlertDialogHeader>
                {fields && fields.length > 0 ? (
                    <ul className="list-disc space-y-0.5 pl-5 text-sm">
                        {fields.map((field) => (
                            <li key={field}>{metaFieldLabel(field)}</li>
                        ))}
                    </ul>
                ) : null}
                <p className="text-sm text-muted-foreground">{uiText("publish.metaOverwrite")}</p>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            onClose();
                            onReplace();
                        }}
                    >
                        Publish and replace
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function AskPublishDialog({
    open,
    onOpenChange,
    onPublish,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPublish: () => void;
}) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Publishing will break questions people are answering
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        The published version of this agent can pause to ask the user a question.
                        Anyone — not just you — whose conversation is waiting on one of those
                        questions will not be able to answer it once this version replaces it; their
                        run cannot be resumed and the question is lost. They can start the
                        conversation again afterwards.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Don’t publish</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            onOpenChange(false);
                            onPublish();
                        }}
                    >
                        Publish anyway
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function UnsavedChangesDialog({
    open,
    onStay,
    onDiscard,
    onSave,
}: {
    open: boolean;
    onStay: () => void;
    onDiscard: () => void;
    onSave: () => void;
}) {
    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onStay();
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
                    <AlertDialogDescription>
                        This draft has unsaved changes. Save them before leaving, or discard them?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep editing</AlertDialogCancel>
                    <Button variant="outline" onClick={onDiscard}>
                        Discard changes
                    </Button>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onSave();
                        }}
                    >
                        Save and leave
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
