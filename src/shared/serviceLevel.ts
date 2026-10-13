import { ServiceLevel } from "@/orval/search2o.schemas";

const LEVEL_LABELS: Record<string, string> = {
    [ServiceLevel.free]: "Free",
    [ServiceLevel.paid]: "Paid",
};

export function serviceLevelLabel(level: string): string {
    if (!level) return "";
    return LEVEL_LABELS[level] ?? level.charAt(0).toUpperCase() + level.slice(1);
}

export function isBilled(level: string): boolean {
    return level !== ServiceLevel.free;
}

export function offersSingleSignOn(level: string | null | undefined): boolean {
    const value = level || ServiceLevel.free;
    return value !== ServiceLevel.free && value !== ServiceLevel.paid;
}
