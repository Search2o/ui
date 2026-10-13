import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import * as API from "@/orval/search2o";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { MarkdownText } from "@/shared/SafeContent";
import { errorText } from "@/shared/apiError";
import { AlertTriangle, BookOpen, ExternalLink, Loader2 } from "lucide-react";
import { uiText } from "@/shared/uiText";

const ANSWER_COLUMN = "mx-auto w-full max-w-2xl";

const ASK_COLUMN = "mx-auto w-full max-w-xl";

const MIN_QUESTION = 8;
const MAX_QUESTION = 1000;

export default function DocsModule() {
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [asking, setAsking] = useState(false);
    const askId = useRef(0);

    const trimmed = question.trim();
    const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUESTION;

    const ask = useCallback(async () => {
        const q = question.trim();
        if (q.length < MIN_QUESTION || asking) return;

        const id = ++askId.current;
        setAsking(true);
        setError(null);
        try {
            const resp = await API.docsQuestion({ question: q });
            if (id !== askId.current) return;
            if (resp.success && resp.answer?.trim()) {
                setAnswer(resp.answer);
                return;
            }
            setAnswer(null);
            setError(resp.error?.message || uiText("docs.emptyAnswer"));
        } catch (e) {
            if (id !== askId.current) return;
            setAnswer(null);
            setError(errorText(e, "The question could not be answered."));
        } finally {
            if (id === askId.current) setAsking(false);
        }
    }, [asking, question]);

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void ask();
        }
    };

    const hasResponse = Boolean(answer || error);

    return (
        <div className="flex h-full w-full flex-col">
            <Card className="flex flex-1 flex-col">
                <CardHeader className={`${ANSWER_COLUMN} px-0`}>
                    <div className="flex items-center justify-between gap-4">
                        <ModuleCardTitle title="Docs" />
                        <a
                            href={uiText("docs.url")}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                            Full docs
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col space-y-6">
                    <div className={hasResponse ? "" : "flex flex-1 flex-col justify-center"}>
                        <div
                            className={`${ASK_COLUMN} space-y-4 rounded-2xl border bg-surface p-6 text-center`}
                        >
                            <div className="space-y-2">
                                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                                    <BookOpen className="h-5 w-5 text-primary" aria-hidden />
                                </span>
                                <h2 className="text-base font-semibold">
                                    {uiText("docs.heading")}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {uiText("docs.subheading")}
                                </p>
                            </div>

                            <Textarea
                                value={question}
                                onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION))}
                                onKeyDown={onKeyDown}
                                rows={3}
                                className="min-h-24 resize-none text-left text-base leading-relaxed placeholder:text-sm"
                                placeholder={uiText("docs.placeholder")}
                                aria-label="Your question about Search2o"
                                disabled={asking}
                            />

                            <div className="flex items-center justify-between gap-4">
                                <p className="text-left text-xs text-muted-foreground">
                                    {tooShort ? uiText("docs.tooShort") : "\u00a0"}
                                </p>
                                <Button
                                    type="button"
                                    className="shrink-0 gap-2"
                                    onClick={() => void ask()}
                                    disabled={asking || trimmed.length < MIN_QUESTION}
                                >
                                    {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    {asking
                                        ? "Asking\u2026"
                                        : answer
                                          ? "Ask again"
                                          : "Ask the docs"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {error ? (
                        <Alert variant="destructive" className={ANSWER_COLUMN}>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle className="line-clamp-none">{error}</AlertTitle>
                        </Alert>
                    ) : null}

                    {answer ? (
                        <div className={`${ANSWER_COLUMN} space-y-3 rounded-xl bg-surface p-4`}>
                            <MarkdownText text={answer} />
                            <p className="border-t pt-3 text-xs text-muted-foreground">
                                {uiText("docs.disclaimer")}{" "}
                                <a
                                    href={uiText("docs.url")}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-4"
                                >
                                    {uiText("docs.disclaimerLinkText")}
                                </a>
                                .
                            </p>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
