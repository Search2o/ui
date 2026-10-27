import { Rocket, Save, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/shared/BackButton";
import { HoverTip } from "@/shared/HoverTip";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { RunLimits } from "@/shared/RunLimits";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import { uiText } from "@/shared/uiText";
import type { ModuleKey } from "@/shared/uistate";

export function DraftHead({
    isNewDraft,
    agentName,
    name,
    onNameChange,
    tag,
    onTagChange,
    title,
    onTitleChange,
    maxTime,
    maxCost,
    onMaxTimeChange,
    onMaxCostChange,
    limitsInvalid,
    saveDisabled,
    onSave,
    publishDisabled,
    publishFilled,
    onPublish,
    backFallback,
}: {
    isNewDraft: boolean;
    agentName: string;
    name: string;
    onNameChange: (name: string) => void;
    tag: string;
    onTagChange: (tag: string) => void;
    title: string;
    onTitleChange: (title: string) => void;
    maxTime: string;
    maxCost: string;
    onMaxTimeChange: (text: string) => void;
    onMaxCostChange: (text: string) => void;
    limitsInvalid: boolean;
    saveDisabled: boolean;
    onSave: () => void;
    publishDisabled: boolean;
    publishFilled: boolean;
    onPublish: () => void;
    backFallback: ModuleKey;
}) {
    const fh = useFieldHelp("DraftResponseModel");
    const ft = useFieldTitle("DraftResponseModel");

    return (
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1 basis-80">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                    <ModuleCardTitle
                        title="Draft"
                        help="draft-edit"
                        className="text-xs font-semibold tracking-wider text-primary uppercase"
                    />
                    {isNewDraft ? (
                        <>
                            <label className="flex items-center gap-1.5">
                                Name
                                <Input
                                    id="agent-name"
                                    className="h-7 w-44 font-mono text-xs"
                                    value={name}
                                    onChange={(e) => onNameChange(e.target.value)}
                                    spellCheck={false}
                                />
                            </label>
                            <label className="flex items-center gap-1.5">
                                Tag
                                <Input
                                    id="tag"
                                    className="h-7 w-32 text-xs"
                                    value={tag}
                                    onChange={(e) => onTagChange(e.target.value)}
                                    placeholder="general"
                                />
                            </label>
                        </>
                    ) : (
                        <>
                            <HoverTip tip={uiText("agent.nameLocked")}>
                                <span className="cursor-help font-mono text-foreground">
                                    {agentName}
                                </span>
                            </HoverTip>
                            <HoverTip tip={uiText("agent.tagLocked")}>
                                <span className="inline-flex cursor-help items-center gap-1">
                                    <Tag className="h-3 w-3" aria-hidden />
                                    {tag || "general"}
                                </span>
                            </HoverTip>
                        </>
                    )}
                    <RunLimits
                        maxTime={maxTime}
                        maxCost={maxCost}
                        onMaxTimeChange={onMaxTimeChange}
                        onMaxCostChange={onMaxCostChange}
                        invalid={limitsInvalid}
                        timeLabel={ft("maxTime", "Max run time (seconds)")}
                        timeHelp={fh("maxTime")}
                        costLabel={ft("maxCost", "Max LLM cost per run (US dollars)")}
                        costHelp={fh("maxCost")}
                    />
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="shrink-0">Title</span>
                    <Input
                        id="title"
                        className="min-w-0 max-w-md text-foreground"
                        value={title}
                        onChange={(e) => onTitleChange(e.target.value)}
                        placeholder={uiText("placeholder.draftTitle")}
                    />
                </label>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onSave} disabled={saveDisabled}>
                    <Save className="h-4 w-4" />
                    Save
                </Button>
                <Button
                    variant={publishFilled ? "default" : "outline"}
                    size="sm"
                    onClick={onPublish}
                    disabled={publishDisabled}
                >
                    <Rocket className="h-4 w-4" />
                    Publish
                </Button>
                <BackButton fallback={backFallback} label="Back" />
            </div>
        </header>
    );
}
