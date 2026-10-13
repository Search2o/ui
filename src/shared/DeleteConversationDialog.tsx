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

export function DeleteConversationDialog({
    open,
    title,
    onOpenChange,
    onConfirm,
}: {
    open: boolean;
    title: string;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}) {
    const named = title.trim() || "this conversation";

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete {named}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This conversation and everything in it will be permanently deleted. This
                        cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm} variant="destructive">
                        Delete permanently
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
