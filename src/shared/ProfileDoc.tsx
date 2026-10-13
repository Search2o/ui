import { FieldLabel } from "@/shared/FieldLabel";
import { Textarea } from "@/components/ui/textarea";
import { uiText } from "@/shared/uiText";

export const PROFILE_DOC_MAX = 500;

export function ProfileDoc({
    id,
    value,
    onChange,
    help,
    disabled,
}: {
    id: string;
    value: string;
    onChange: (next: string) => void;
    help?: string;
    disabled?: boolean;
}) {
    return (
        <div className="grid gap-2">
            <FieldLabel help={help} htmlFor={id}>
                Documentation <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
                id={id}
                rows={2}
                value={value}
                disabled={disabled}
                maxLength={PROFILE_DOC_MAX}
                onChange={(e) => onChange(e.target.value)}
                placeholder={uiText("help.profileDocUse")}
                className="max-w-3xl"
            />
        </div>
    );
}
