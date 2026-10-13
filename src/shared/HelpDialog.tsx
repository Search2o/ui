import { useState } from "react";
import { toast } from "sonner";
import * as API from "@/orval/search2o";
import type { SendHelpMessageRequestModel } from "@/orval/search2o.schemas";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useUiText } from "@/shared/uiText";

const SUBJECT_MAX = 80;
const MESSAGE_MIN = 80;
const MESSAGE_MAX = 2000;

export function HelpDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const t = useUiText();
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);

    const subjectText = subject.trim();
    const messageText = message.trim();
    const remaining = MESSAGE_MIN - messageText.length;
    const canSend = remaining <= 0 && !sending;

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSend) return;
        setSending(true);
        try {
            const body: SendHelpMessageRequestModel = { message: messageText };
            if (subjectText) body.subject = subjectText;

            const resp = await API.sendHelpMessage(body);
            if (!resp?.success) {
                toast.error(resp?.error?.message || "Could not send your message.");
                return;
            }
            toast.success("Message sent to support", {
                description: resp.email ? `Support will reply to ${resp.email}.` : undefined,
            });
            setSubject("");
            setMessage("");
            onOpenChange(false);
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-2xl">
                <form onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle className="pr-10">Contact support</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="help-subject">Subject</Label>
                            <Input
                                id="help-subject"
                                name="help-subject"
                                autoComplete="off"
                                maxLength={SUBJECT_MAX}
                                placeholder="How can we help you?"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                disabled={sending}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="help-message">Message</Label>
                            <Textarea
                                id="help-message"
                                name="help-message"
                                autoComplete="off"
                                className="min-h-64"
                                maxLength={MESSAGE_MAX}
                                placeholder="Please tell us what you need help with."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={sending}
                            />
                            <p className="text-xs text-muted-foreground">
                                {messageText.length} / {MESSAGE_MAX} characters
                                {remaining > 0
                                    ? ` — a little more detail helps us: at least ${MESSAGE_MIN}, please`
                                    : null}
                            </p>
                        </div>
                        <p className="text-sm text-muted-foreground">{t("support.responseTime")}</p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={sending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!canSend}>
                            {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                            {sending ? "Sending…" : "Send"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
