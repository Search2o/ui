import * as COMMON from "@/shared/commonFuncs";
import { HoverTip } from "@/shared/HoverTip";
import { cn } from "@/lib/utils";

type VersionLike = {
    lastUpdatedByName?: string | null;
    lastUpdatedByEmail?: string | null;
    configVersion?: string | number | Date | null;
    agentVersion?: string | number | Date | null;
};

type Props<T extends VersionLike = VersionLike> = {
    obj?: T | null;
    className?: string;
    compact?: boolean;
};

export function UpdatedBy<T extends VersionLike>({ obj, className, compact = false }: Props<T>) {
    const version = obj?.configVersion ?? obj?.agentVersion;
    const hasName = !!obj?.lastUpdatedByName;
    const hasEmail = !!obj?.lastUpdatedByEmail;
    const hasVersion = version != null && version !== 0 && version !== "";
    const tooltipText = obj?.lastUpdatedByEmail ?? "";

    if (!hasName && !hasEmail && !hasVersion) return null;

    const label = obj?.lastUpdatedByName ?? obj?.lastUpdatedByEmail;

    return (
        <div className={cn("truncate text-xs text-muted-foreground", className)}>
            {(hasName || hasEmail) &&
                (compact && tooltipText ? (
                    <HoverTip tip={tooltipText}>
                        <span className="cursor-help">{label}</span>
                    </HoverTip>
                ) : (
                    <span>{label}</span>
                ))}

            {(hasName || hasEmail) && hasVersion && (
                <span className="mx-2 text-muted-foreground/60">·</span>
            )}

            {hasVersion && <span>{COMMON.fmtLocalShort(version)}</span>}
        </div>
    );
}
