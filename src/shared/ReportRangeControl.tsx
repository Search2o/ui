import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { uiText } from "@/shared/uiText";
import {
    clampToBounds,
    presetRange,
    threeMonthsAgoMidnight,
    type RangePreset,
    type ReportRange,
} from "@/shared/ReportRange";

type PresetItem = { key: Exclude<RangePreset, "custom">; label: string };

const PRESET_GROUPS: { title: string; items: PresetItem[] }[] = [
    {
        title: "Intraday",
        items: [
            { key: "last1h", label: "Last hour" },
            { key: "last6h", label: "Last 6 hours" },
            { key: "last24h", label: "Last 24 hours" },
        ],
    },
    {
        title: "Days",
        items: [
            { key: "today", label: "Today" },
            { key: "yesterday", label: "Yesterday" },
            { key: "last7d", label: "Last 7 days" },
            { key: "last30d", label: "Last 30 days" },
        ],
    },
    {
        title: "Months",
        items: [
            { key: "thisMonth", label: "This month" },
            { key: "prevMonth", label: "Previous month" },
            { key: "last3", label: "Last 3 months" },
        ],
    },
];

const ALL_PRESETS: PresetItem[] = PRESET_GROUPS.flatMap((g) => g.items);

const toTimeStr = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const fmtDay = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function atTime(day: Date, hm: string, fallbackHours: number, fallbackMinutes: number): Date {
    const [h, m] = hm.split(":").map(Number);
    const x = new Date(day);
    const hours = Number.isFinite(h) ? h : fallbackHours;
    const minutes = Number.isFinite(m) ? m : fallbackMinutes;
    const isEndOfDay = hours === 23 && minutes === 59;
    x.setHours(hours, minutes, isEndOfDay ? 59 : 0, isEndOfDay ? 999 : 0);
    return x;
}

export function ReportRangeControl({
    value,
    onChange,
}: {
    value: ReportRange;
    onChange: (range: ReportRange) => void;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<DateRange | undefined>();
    const [startTime, setStartTime] = useState("00:00");
    const [endTime, setEndTime] = useState("23:59");

    const preset = value.preset;
    const presetLabel = ALL_PRESETS.find((p) => p.key === preset)?.label;
    const triggerLabel = presetLabel ?? formatValueLabel(value);

    const onOpenChange = (next: boolean) => {
        if (next) {
            setDraft({ from: value.start, to: value.end });
            setStartTime(toTimeStr(value.start));
            setEndTime(toTimeStr(value.end));
        }
        setOpen(next);
    };

    const pickPreset = (p: Exclude<RangePreset, "custom">) => {
        setOpen(false);
        onChange(presetRange(p));
    };

    const onSelectDay = (next: DateRange | undefined, day: Date) => {
        if (draft?.from && draft.to) {
            setDraft({ from: day, to: undefined });
            setStartTime("00:00");
            setEndTime("23:59");
        } else {
            setDraft(next);
        }
    };

    const draftRange = (): ReportRange | null => {
        if (!draft?.from) return null;
        const start = clampToBounds(atTime(draft.from, startTime, 0, 0));
        const end = clampToBounds(atTime(draft.to ?? draft.from, endTime, 23, 59));
        return end > start ? { start, end, preset: "custom" as const } : null;
    };
    const drafted = draftRange();

    const applyDraft = () => {
        if (!drafted) return;
        setOpen(false);
        onChange(drafted);
    };

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                    {triggerLabel}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
                <div className="flex">
                    <div className="flex flex-col gap-1 border-r p-3">
                        {PRESET_GROUPS.map((group, gi) => (
                            <div key={group.title} className="flex flex-col gap-1">
                                <div
                                    className={`px-3 pb-0.5 text-[12px] font-medium text-muted-foreground ${gi > 0 ? "pt-2" : ""}`}
                                >
                                    {group.title}
                                </div>
                                {group.items.map((p) => (
                                    <Button
                                        key={p.key}
                                        variant={preset === p.key ? "secondary" : "ghost"}
                                        size="sm"
                                        className="justify-start"
                                        onClick={() => pickPreset(p.key)}
                                    >
                                        {p.label}
                                    </Button>
                                ))}
                            </div>
                        ))}
                    </div>
                    <div className="p-3">
                        <Calendar
                            mode="range"
                            numberOfMonths={2}
                            selected={draft}
                            onSelect={onSelectDay}
                            defaultMonth={
                                new Date(value.end.getFullYear(), value.end.getMonth() - 1, 1)
                            }
                            disabled={[{ before: threeMonthsAgoMidnight() }, { after: new Date() }]}
                        />
                        <div className="mt-2 flex items-center justify-between gap-4 border-t pt-3">
                            {draft?.from ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="whitespace-nowrap">{fmtDay(draft.from)}</span>
                                    <Input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="h-8 w-fit px-2 text-xs"
                                        aria-label="Start time"
                                    />
                                    <span>–</span>
                                    <span className="whitespace-nowrap">
                                        {fmtDay(draft.to ?? draft.from)}
                                    </span>
                                    <Input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="h-8 w-fit px-2 text-xs"
                                        aria-label="End time"
                                    />
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground">
                                    {uiText("report.range")}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={applyDraft} disabled={!drafted}>
                                    Apply
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function formatValueLabel({ start, end }: ReportRange): string {
    const wholeDays =
        start.getHours() === 0 &&
        start.getMinutes() === 0 &&
        end.getHours() === 23 &&
        end.getMinutes() === 59;
    if (wholeDays) {
        const s = fmtDay(start);
        const e = fmtDay(end);
        return s === e ? s : `${s} – ${e}`;
    }
    const fmt = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
}
