import { ServiceLevel } from "@/orval/search2o.schemas";

export type UpgradeOffer = { kind: "none" } | { kind: "startPaid" };

export function upgradeOffer(level: string): UpgradeOffer {
    return level === ServiceLevel.free ? { kind: "startPaid" } : { kind: "none" };
}
