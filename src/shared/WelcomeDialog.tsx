import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserRole } from "@/orval/search2o.schemas";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { uiText } from "@/shared/uiText";
import { WelcomeSchematic } from "@/shared/WelcomeSchematic";
import { BEAT_MS, tourBeats } from "@/shared/welcomeTour";

function prefersReducedMotion(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WelcomeDialog({
    open,
    role,
    onClose,
}: {
    open: boolean;
    role: UserRole | null | undefined;
    onClose: () => void;
}) {
    const beats = useMemo(() => tourBeats(role), [role]);
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(true);
    const reduced = useMemo(() => prefersReducedMotion(), []);

    useEffect(() => {
        if (!open) return;
        setIndex(0);
        setPlaying(true);
    }, [open]);

    useEffect(() => {
        if (!open || !playing || index >= beats.length - 1) return;
        const t = setTimeout(() => setIndex((i) => Math.min(i + 1, beats.length - 1)), BEAT_MS);
        return () => clearTimeout(t);
    }, [open, playing, index, beats.length]);

    const goTo = useCallback((next: number) => {
        setPlaying(false);
        setIndex(next);
    }, []);

    const beat = beats[index];
    const done = index >= beats.length - 1;
    const close = useCallback(() => onClose(), [onClose]);

    if (!beat) return null;

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-2xl">
                <DialogTitle className="pr-10">{uiText("welcome.title")}</DialogTitle>
                <DialogDescription>{uiText("welcome.subtitle")}</DialogDescription>

                <WelcomeSchematic
                    role={role}
                    expand={beat.expand}
                    target={beat.target}
                    reduced={reduced}
                />

                <div className="grid">
                    {beats.map((b, i) => (
                        <div
                            key={b.id}
                            aria-hidden={i !== index}
                            className={`col-start-1 row-start-1 ${
                                i !== index
                                    ? "invisible"
                                    : reduced
                                      ? ""
                                      : "animate-in fade-in duration-500"
                            }`}
                        >
                            <p className="text-base font-semibold">{b.title}</p>
                            {b.body ? (
                                <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
                                    {b.body}
                                </p>
                            ) : null}
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {beats.map((b, i) => (
                            <button
                                key={b.id}
                                type="button"
                                aria-label={b.title}
                                aria-current={i === index}
                                onClick={() => goTo(i)}
                                className={`h-1.5 rounded-full transition-all ${
                                    i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
                                }`}
                            />
                        ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Previous"
                            disabled={index === 0}
                            onClick={() => goTo(Math.max(0, index - 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Next"
                            disabled={done}
                            onClick={() => goTo(Math.min(beats.length - 1, index + 1))}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant={done ? "default" : "outline"}
                            onClick={close}
                        >
                            {done ? uiText("welcome.dismiss") : "Skip"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
