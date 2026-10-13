import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as UI from "@/shared/uistate";

export function BackButton({
    fallback,
    label = "Back",
    onBack,
}: {
    fallback: UI.ModuleKey;
    label?: string;
    onBack?: (proceed: () => void) => void;
}) {
    const proceed = () => UI.goBack(fallback);
    return (
        <Button
            variant="outline"
            size="icon"
            aria-label={label}
            onClick={() => (onBack ? onBack(proceed) : proceed())}
            className="group h-9 w-9 rounded-full border-muted-foreground/30 shadow-sm transition-shadow hover:bg-accent/60 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
        </Button>
    );
}
