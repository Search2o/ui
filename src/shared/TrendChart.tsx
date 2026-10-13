import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis } from "recharts";

const padYDomain = ([dataMin, dataMax]: readonly [number, number]): [number, number] => {
    const span = dataMax - dataMin;
    const pad = span > 0 ? span * 0.1 : Math.max(Math.abs(dataMax) * 0.1, 1);
    return [dataMin - pad, dataMax + pad];
};

function Swatch({ cfg }: { cfg?: ChartConfig[string] }) {
    const light = cfg?.theme?.light ?? cfg?.color ?? "currentColor";
    const dark = cfg?.theme?.dark ?? cfg?.color ?? "currentColor";
    return (
        <span
            className="inline-block h-2 w-2 shrink-0 rounded-[2px] bg-[var(--sw-l)] [.dark_&]:bg-[var(--sw-d)]"
            style={{ "--sw-l": light, "--sw-d": dark } as CSSProperties}
        />
    );
}

export type TrendPoint = { bucketStart: number } & Record<string, number | undefined>;

export type TrendFillRange = { start: number; end: number; bucketMs: number | undefined };

const MAX_FILL_BUCKETS = 400;

function fillTrend(
    data: TrendPoint[],
    series: string[],
    fill: TrendFillRange | undefined,
): TrendPoint[] {
    const bucketMs = fill?.bucketMs;
    if (!fill || !bucketMs || bucketMs <= 0 || data.length === 0) return data;
    if ((fill.end - fill.start) / bucketMs > MAX_FILL_BUCKETS) return data;

    const byStart = new Map(data.map((p) => [p.bucketStart, p]));
    const offset = ((data[0].bucketStart % bucketMs) + bucketMs) % bucketMs;
    const first = fill.start - ((((fill.start - offset) % bucketMs) + bucketMs) % bucketMs);

    const zero = Object.fromEntries(series.map((k) => [k, 0]));
    const out: TrendPoint[] = [];
    for (let t = first; t <= fill.end; t += bucketMs) {
        out.push(byStart.get(t) ?? { bucketStart: t, ...zero });
    }
    return out;
}

export function TrendSection({
    hourly,
    title = "Trends",
    columnsClassName = "sm:grid-cols-2 lg:grid-cols-3",
    children,
}: {
    hourly: boolean;
    title?: string;
    columnsClassName?: string;
    children: ReactNode;
}) {
    return (
        <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
                <div className="text-sm font-medium">{title}</div>
                <div className="text-xs text-muted-foreground">
                    {hourly ? "hourly" : "daily"} buckets
                </div>
            </div>
            <div className={`grid gap-x-6 gap-y-4 ${columnsClassName}`}>{children}</div>
        </div>
    );
}

export function TrendChart({
    title,
    data,
    config,
    series,
    hourly,
    fillRange,
    valueFormatter,
    className = "aspect-auto h-24 w-full",
}: {
    title: string;
    data: TrendPoint[];
    config: ChartConfig;
    series: string[];
    hourly: boolean;
    fillRange?: TrendFillRange;
    valueFormatter?: (v: number) => string;
    className?: string;
}) {
    const fmtBucket = useMemo(() => {
        const fmt = new Intl.DateTimeFormat(
            undefined,
            hourly
                ? { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }
                : { month: "short", day: "2-digit" },
        );
        return (ts: number) => fmt.format(new Date(ts));
    }, [hourly]);

    const filled = useMemo(
        () => fillTrend(data, series, fillRange),
        [data, fillRange, series.join(",")],
    );

    return (
        <div className="grid row-span-2 grid-rows-subgrid">
            <div className="mb-1 flex items-center gap-3">
                <div className="text-xs font-medium text-muted-foreground">{title}</div>
                {series.length > 1 && (
                    <div className="flex items-center gap-2">
                        {series.map((key) => (
                            <span
                                key={key}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground"
                            >
                                <Swatch cfg={config[key]} />
                                {config[key]?.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <ChartContainer config={config} className={className}>
                <LineChart data={filled} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                    <XAxis
                        dataKey="bucketStart"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={fmtBucket}
                        tickLine={false}
                        axisLine={{ stroke: "var(--color-border)" }}
                        minTickGap={48}
                        interval="preserveStartEnd"
                    />
                    <YAxis hide domain={padYDomain} />
                    <ChartTooltip
                        content={
                            <ChartTooltipContent
                                labelFormatter={(_label, items) => {
                                    const ts = items?.[0]?.payload?.bucketStart as
                                        number | undefined;
                                    return ts != null ? fmtBucket(ts) : "";
                                }}
                                formatter={
                                    valueFormatter
                                        ? (value, name, item) => (
                                              <>
                                                  <div
                                                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                                      style={{ backgroundColor: item.color }}
                                                  />
                                                  <div className="flex flex-1 items-center justify-between leading-none">
                                                      <span className="text-muted-foreground">
                                                          {(config[name as string]
                                                              ?.label as string) ?? name}
                                                      </span>
                                                      <span className="text-foreground font-mono font-medium tabular-nums">
                                                          {valueFormatter(Number(value))}
                                                      </span>
                                                  </div>
                                              </>
                                          )
                                        : undefined
                                }
                            />
                        }
                    />
                    {series.map((key) => (
                        <Line
                            key={key}
                            dataKey={key}
                            type="monotone"
                            stroke={`var(--color-${key})`}
                            strokeWidth={2}
                            isAnimationActive={false}
                            dot={
                                filled.length > 1
                                    ? false
                                    : { r: 3, strokeWidth: 0, fill: `var(--color-${key})` }
                            }
                            activeDot={{ r: 3 }}
                        />
                    ))}
                </LineChart>
            </ChartContainer>
        </div>
    );
}
