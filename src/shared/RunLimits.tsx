import { Gauge } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FieldLabel } from "@/shared/FieldLabel";

export function RunLimits({
    maxTime,
    maxCost,
    onMaxTimeChange,
    onMaxCostChange,
    invalid,
    timeLabel,
    timeHelp,
    costLabel,
    costHelp,
}: {
    maxTime: string;
    maxCost: string;
    onMaxTimeChange: (text: string) => void;
    onMaxCostChange: (text: string) => void;
    invalid: boolean;
    timeLabel: string;
    timeHelp?: string;
    costLabel: string;
    costHelp?: string;
}) {
    const time = maxTime.trim() ? `${maxTime.trim()} s` : "no time limit";
    const cost = maxCost.trim() ? `$${maxCost.trim()} a run` : "no cost limit";
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`Run limits: ${time}, ${cost}`}
                    className={
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 tabular-nums outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring " +
                        (invalid ? "border-destructive/50 text-destructive" : "border-border")
                    }
                >
                    <Gauge className="h-3 w-3" aria-hidden />
                    {time} · {cost}
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto space-y-3">
                <div className="space-y-1">
                    <FieldLabel help={timeHelp} htmlFor="maxTime" className="whitespace-nowrap">
                        {timeLabel}
                    </FieldLabel>
                    <Input
                        id="maxTime"
                        className="tabular-nums"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={maxTime}
                        onChange={(e) => onMaxTimeChange(e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <FieldLabel help={costHelp} htmlFor="maxCost" className="whitespace-nowrap">
                        {costLabel}
                    </FieldLabel>
                    <Input
                        id="maxCost"
                        className="tabular-nums"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={maxCost}
                        onChange={(e) => onMaxCostChange(e.target.value)}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
