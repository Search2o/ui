export function RankBar({ value, max }: { value?: number; max: number }) {
    const v = value ?? 0;
    const pct = max > 0 && v > 0 ? Math.max((v / max) * 100, 2) : 0;
    return (
        <span
            className="relative mr-2 inline-block h-3 w-[84px] overflow-hidden rounded-[3px] bg-muted align-[-1px]"
            aria-hidden="true"
        >
            <span
                className="absolute inset-y-0 left-0 rounded-r-[3px] bg-[#2a78d6] [.dark_&]:bg-[#3987e5]"
                style={{ width: `${pct}%` }}
            />
        </span>
    );
}
