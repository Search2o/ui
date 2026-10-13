import type { ReactNode } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

export type SortDir = "asc" | "desc";

export function SortHeaderButton({
    label,
    active,
    dir,
    onClick,
}: {
    label: ReactNode;
    active: boolean;
    dir: SortDir;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1 font-medium leading-none"
            aria-label={`Sort by ${typeof label === "string" ? label : "column"}`}
        >
            <span>{label}</span>
            {active &&
                (dir === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5 opacity-70" />
                ) : (
                    <ArrowDown className="h-3.5 w-3.5 opacity-70" />
                ))}
        </button>
    );
}
