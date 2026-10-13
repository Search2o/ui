import { CardTitle } from "@/components/ui/card";
import { HoverTip } from "@/shared/HoverTip";
import { pageHelp, pageHelpKey } from "@/shared/pageHelp";

type ModuleCardTitleProps = {
    title: string;
    className?: string;
    help?: string;
};

export function ModuleCardTitle({ title, className, help }: ModuleCardTitleProps) {
    const tip = pageHelp(help ?? pageHelpKey(title));

    return (
        <HoverTip tip={tip} side="bottom">
            <CardTitle className={["w-fit", className].filter(Boolean).join(" ")}>
                {title}
            </CardTitle>
        </HoverTip>
    );
}
