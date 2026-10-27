import { useCallback, useEffect, useRef, useState } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";
import { toast } from "sonner";
import { useUnsavedWork } from "@/shared/sessionExpiry";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BarChart3,
    CheckCircle2,
    Pencil,
    Play,
    RefreshCcw,
    TableOfContents,
    Trash2,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { resetPagedList } from "@/shared/pagedList";

import { JsonCodeBlock } from "@/shared/JsonCodeBlock";
import { findPathRange } from "@/shared/agentPath";
import type { AgentResponseModel, PastVersionModel } from "@/orval/search2o.schemas";
import { PublishedPrompts } from "@/shared/PublishedPrompts";
import { PublishedConst } from "@/shared/ConstFields";
import { UpdatedBy } from "@/shared/UpdatedBy";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { Composer } from "@/shared/Composer";
import { HoverTip } from "@/shared/HoverTip";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import { AGENT_TAG, matchesRule } from "@/shared/schemaRules";
import { MAX_LENGTHS } from "@/shared/schemaRules";
import { INDEXING_TIMEOUT_MS, startIndexing, useIndexingJob } from "@/shared/indexingJobs";
import { fmtLocalShort } from "@/shared/commonFuncs";

const CURRENT_VERSION_VALUE = "__current__";

function EditPencil({ tip, onClick }: { tip: string; onClick: () => void }) {
    return (
        <HoverTip tip={tip}>
            <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={tip}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={onClick}
            >
                <Pencil className="h-3.5 w-3.5" />
            </Button>
        </HoverTip>
    );
}

function InlineEdit({
    value,
    onChange,
    onSave,
    onCancel,
    saving,
    label,
    maxLength,
    width,
}: {
    value: string;
    onChange: (v: string) => void;
    onSave: () => void | Promise<void>;
    onCancel: () => void;
    saving: boolean;
    label: string;
    maxLength: number;
    width: string;
}) {
    return (
        <span className="flex flex-wrap items-center gap-2">
            <Input
                autoFocus
                value={value}
                disabled={saving}
                maxLength={maxLength}
                aria-label={label}
                className={`h-7 max-w-full ${width}`}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") void onSave();
                    if (e.key === "Escape") onCancel();
                }}
            />
            <Button
                type="button"
                size="sm"
                className="h-7"
                disabled={saving}
                onClick={() => void onSave()}
            >
                {saving ? "Saving…" : "Save"}
            </Button>
            <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={saving}
                onClick={onCancel}
            >
                Cancel
            </Button>
        </span>
    );
}

function fmtPastVersion(epochMs: number): string {
    return fmtLocalShort(epochMs);
}

function PastVersionLabel({ item }: { item: PastVersionModel }) {
    return (
        <div className="flex min-w-0 flex-col">
            <span className="truncate">{fmtPastVersion(item.pastVersion)}</span>
        </div>
    );
}

export default function AgentViewModule() {
    const payload = UI.useModulePayload<UI.AgentPayloadType>();
    const agentName = payload?.agentName;

    const [loading, setLoading] = useState(!!agentName);
    const [agent, setAgent] = useState<AgentResponseModel>();
    const [loadError, setLoadError] = useState<string | null>(null);
    const [displayAgent, setDisplayAgent] = useState<AgentResponseModel>();
    const [pastVersions, setPastVersions] = useState<PastVersionModel[]>([]);
    const [loadingPastVersions, setLoadingPastVersions] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<string>(CURRENT_VERSION_VALUE);
    const [loadingSelectedVersion, setLoadingSelectedVersion] = useState(false);

    const [editingTag, setEditingTag] = useState(false);
    const [tagDraft, setTagDraft] = useState("");
    const [savingTag, setSavingTag] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [editingLimits, setEditingLimits] = useState(false);
    const [timeDraft, setTimeDraft] = useState("");
    const [costDraft, setCostDraft] = useState("");
    const [savingLimits, setSavingLimits] = useState(false);
    const fh = useFieldHelp("AgentResponseModel");
    const ft = useFieldTitle("AgentResponseModel");
    const [titleDraft, setTitleDraft] = useState("");
    const [savingTitle, setSavingTitle] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const [desc, setDesc] = useState("");

    useUnsavedWork(
        () =>
            desc !== (agent?.descriptor?.description ?? "") ||
            (editingTitle && titleDraft !== (displayAgent?.agentTitle ?? "")) ||
            (editingTag && tagDraft !== (displayAgent?.agentTag ?? "")) ||
            (editingLimits &&
                (timeDraft !== String(agent?.maxTime ?? "") ||
                    costDraft !== String(agent?.maxCost ?? ""))),
    );
    const indexJob = useIndexingJob(agentName);
    const indexing = indexJob !== null;
    const [validatingDesc, setValidatingDesc] = useState(false);
    const [descError, setDescError] = useState<string | null>(null);
    const lastLoadedDescRef = useRef<string | null>(null);
    const [confirmDeindex, setConfirmDeindex] = useState(false);
    const lockedElsewhere = (agent?.isLocked ?? false) && !indexing;
    const indexJobRunning = indexing || (agent?.isLocked ?? false);

    const adoptDescriptor = useCallback((resp: AgentResponseModel) => {
        const fromServer = resp.descriptor?.description ?? null;
        if (fromServer === null) return;
        setDesc((current) =>
            current === "" || current === lastLoadedDescRef.current ? fromServer : current,
        );
        lastLoadedDescRef.current = fromServer;
    }, []);

    const loadAgent = useCallback(async () => {
        if (!agentName) {
            setLoading(false);
            setAgent(undefined);
            setDisplayAgent(undefined);
            setPastVersions([]);
            setSelectedVersion(CURRENT_VERSION_VALUE);
            return;
        }

        setLoading(true);
        setLoadError(null);
        setPastVersions([]);
        setSelectedVersion(CURRENT_VERSION_VALUE);

        try {
            const resp = await API.getAgent({ agentName });
            if (!resp.success) {
                const message = resp.error?.message ?? "Failed to load agent";
                toast.error(message);
                setLoadError(message);
                return;
            }
            setAgent(resp);
            setDisplayAgent(resp);
            adoptDescriptor(resp);
        } catch (e) {
            const message = errorText(e, "Failed to load agent");
            toast.error(message);
            setLoadError(message);
        } finally {
            setLoading(false);
        }
    }, [agentName, adoptDescriptor]);

    useEffect(() => {
        void loadAgent();
    }, [loadAgent]);

    useEffect(() => {
        async function loadPastVersions() {
            if (!agentName || !agent?.hasPastVersions) {
                setPastVersions([]);
                return;
            }

            setLoadingPastVersions(true);
            try {
                const resp = await API.getPastAgentVersions({
                    agentName,
                });
                if (!resp.success) {
                    toast.error(resp.error?.message ?? "Failed to load past versions");
                    return;
                }
                setPastVersions(resp.pastVersions ?? []);
            } finally {
                setLoadingPastVersions(false);
            }
        }

        void loadPastVersions();
    }, [agentName, agent?.hasPastVersions]);

    async function handleVersionChange(value: string) {
        setSelectedVersion(value);

        if (value === CURRENT_VERSION_VALUE) {
            setDisplayAgent(agent);
            return;
        }

        const pastVersion = Number(value);
        if (Number.isNaN(pastVersion) || !agentName) {
            return;
        }

        setLoadingSelectedVersion(true);
        try {
            const resp = await API.getPastAgent({
                agentName,
                pastVersion,
            });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to load the selected version");
                return;
            }
            setDisplayAgent(resp);
        } finally {
            setLoadingSelectedVersion(false);
        }
    }

    const loadDescriptor = useCallback(async () => {
        if (!agentName) return;
        try {
            const resp = await API.getAgent({ agentName });
            if (!resp.success) return;
            setAgent((prev) =>
                prev
                    ? {
                          ...prev,
                          descriptor: resp.descriptor,
                          descriptorVersion: resp.descriptorVersion,
                          lastDescriptorUpdatedByName: resp.lastDescriptorUpdatedByName,
                          lastDescriptorUpdatedByEmail: resp.lastDescriptorUpdatedByEmail,
                      }
                    : resp,
            );
            adoptDescriptor(resp);
            setValidatingDesc(false);
            setDescError(null);
        } catch {}
    }, [agentName, adoptDescriptor]);

    const refreshIndexState = useCallback(async () => {
        if (!agentName) return;
        try {
            const resp = await API.getAgent({ agentName });
            if (!resp.success) return;
            const patch = { isIndexed: resp.isIndexed ?? false, isLocked: resp.isLocked ?? false };
            setAgent((prev) => (prev ? { ...prev, ...patch } : prev));
            setDisplayAgent((prev) => (prev ? { ...prev, ...patch } : prev));
        } catch {}
    }, [agentName]);

    useEffect(() => {
        if (!lockedElsewhere) return;
        const id = window.setInterval(() => void refreshIndexState(), 30_000);
        return () => window.clearInterval(id);
    }, [lockedElsewhere, refreshIndexState]);

    const highlightPath = payload?.highlightPath;
    const shownDefinition = displayAgent?.agentDefinition;
    useEffect(() => {
        if (!highlightPath || typeof shownDefinition !== "string") return;
        if (!findPathRange(highlightPath, shownDefinition)) {
            toast.info(`${highlightPath} is not in the definition shown here.`);
        }
    }, [highlightPath, shownDefinition]);

    if (!agentName) {
        return (
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle>Agent</CardTitle>
                        <CardDescription>No agent selected.</CardDescription>
                    </div>
                    <BackButton fallback="Agents" />
                </CardHeader>
            </Card>
        );
    }

    if (!agent) {
        return (
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle>{agentName}</CardTitle>
                        <CardDescription>
                            {loading
                                ? "Loading…"
                                : (loadError ?? "This agent could not be loaded.")}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {!loading && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void loadAgent()}
                            >
                                <RefreshCcw className="h-4 w-4" />
                                Try again
                            </Button>
                        )}
                        <BackButton fallback="Agents" />
                    </div>
                </CardHeader>
            </Card>
        );
    }

    const descTrimmed = desc.trim();
    const isIndexed = displayAgent?.isIndexed ?? false;
    const indexUpToDate =
        isIndexed && descTrimmed === (agent?.descriptor?.description ?? "").trim();
    const memoryLabels = agent?.memoryLabels ?? [];

    const onIndex = () => {
        if (!agentName || descTrimmed.length === 0 || indexJobRunning) return;
        const version = agent?.descriptorVersion ?? 0;
        const description = desc;
        setValidatingDesc(true);
        setDescError(null);

        startIndexing({ agentName, kind: "index" }, async () => {
            try {
                const resp = await API.publishDescriptor(
                    { agentName, descriptorVersion: version, descriptor: { description } },
                    { signal: AbortSignal.timeout(INDEXING_TIMEOUT_MS) },
                );
                setValidatingDesc(false);
                if (resp.validationError) {
                    setDescError(resp.validationError);
                    return { ok: false, rejected: true, message: resp.validationError };
                }
                if (!resp.success) {
                    return {
                        ok: false,
                        message: resp.error?.message || "The agent could not be indexed.",
                    };
                }
                await Promise.all([loadDescriptor(), refreshIndexState()]);
                return { ok: true, message: uiText("agent.indexedOk") };
            } catch (e) {
                setValidatingDesc(false);
                return { ok: false, message: errorText(e, "Indexing failed") };
            }
        });
    };

    const onRemoveFromIndex = () => {
        if (!agentName || indexJobRunning) return;

        startIndexing({ agentName, kind: "remove" }, async () => {
            try {
                const resp = await API.deleteDescriptor(
                    { agentName },
                    { signal: AbortSignal.timeout(INDEXING_TIMEOUT_MS) },
                );
                if (!resp.success) {
                    return {
                        ok: false,
                        message:
                            resp.error?.message ??
                            "The agent could not be removed from the search index.",
                    };
                }
                await Promise.all([loadDescriptor(), refreshIndexState()]);
                return { ok: true, message: uiText("agent.removedFromIndex") };
            } catch (e) {
                return {
                    ok: false,
                    message: errorText(e, "Failed to remove from the search index"),
                };
            }
        });
    };

    const onEditDraft = async () => {
        if (!agent) return;
        try {
            const resp = await API.createDraftFromAgent({ agentName: agent.agentName });
            if (!resp?.success) {
                toast.error(resp?.error?.message || "Could not create draft");
                return;
            }
            resetPagedList("drafts");
            UI.openSubModule("DraftEdit", {
                draftid: resp.draftid || agent.agentName,
            });
        } catch (e) {
            toast.error(errorText(e, "Failed to create the draft."));
        }
    };

    const onSaveTitle = async () => {
        if (!agent) return;
        const title = titleDraft.trim();
        if (!title || title === agent.agentTitle) {
            setEditingTitle(false);
            return;
        }
        setSavingTitle(true);
        try {
            const resp = await API.updateTitle({ agentName: agent.agentName, agentTitle: title });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to update the title");
                return;
            }
            setAgent({ ...agent, agentTitle: title });
            setDisplayAgent((prev) => (prev ? { ...prev, agentTitle: title } : prev));
            resetPagedList("agents");
            toast.success("Title updated");
            setEditingTitle(false);
        } catch (e) {
            toast.error(errorText(e, "Failed to update the title."));
        } finally {
            setSavingTitle(false);
        }
    };

    const onSaveTag = async () => {
        if (!agent) return;
        const tag = tagDraft.trim();
        if (!tag || tag === agent.agentTag) {
            setEditingTag(false);
            return;
        }
        if (!matchesRule(AGENT_TAG, tag)) {
            toast.error(uiText("validate.agentTag"));
            return;
        }
        setSavingTag(true);
        try {
            const resp = await API.updateTag({ agentName: agent.agentName, agentTag: tag });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to update the tag");
                return;
            }
            setAgent({ ...agent, agentTag: tag });
            setDisplayAgent((prev) => (prev ? { ...prev, agentTag: tag } : prev));
            resetPagedList("agents");
            toast.success("Tag updated");
            setEditingTag(false);
        } catch (e) {
            toast.error(errorText(e, "Failed to update the tag."));
        } finally {
            setSavingTag(false);
        }
    };

    const onSaveLimits = async () => {
        if (!agent) return;
        const time = Number(timeDraft.trim());
        const cost = Number(costDraft.trim());
        if (!timeDraft.trim() || !Number.isInteger(time) || time < 1) {
            toast.error(uiText("validate.maxTime"));
            return;
        }
        if (!costDraft.trim() || !Number.isFinite(cost) || cost <= 0) {
            toast.error(uiText("validate.maxCost"));
            return;
        }
        if (time === agent.maxTime && cost === agent.maxCost) {
            setEditingLimits(false);
            return;
        }
        setSavingLimits(true);
        try {
            const resp = await API.updateAgentBudget({
                agentName: agent.agentName,
                maxTime: time,
                maxCost: cost,
            });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to update the run limits");
                return;
            }
            setAgent({ ...agent, maxTime: time, maxCost: cost, lastChanged: Date.now() });
            setDisplayAgent((prev) => (prev ? { ...prev, maxTime: time, maxCost: cost } : prev));
            toast.success("Run limits updated");
            setEditingLimits(false);
        } catch (e) {
            toast.error(errorText(e, "Failed to update the run limits."));
        } finally {
            setSavingLimits(false);
        }
    };

    const onDelete = async () => {
        if (!agent) return;
        try {
            const resp = await API.deleteAgent({ agentName: agent.agentName });
            if (!resp?.success) {
                toast.error(resp?.error?.message || "Failed to delete the agent");
                return;
            }
            resetPagedList("agents");
            toast.success(`${agent.agentName} deleted`);
            UI.openModule("Agents");
        } catch (e) {
            toast.error(errorText(e, "Failed to delete the agent."));
        }
    };

    return (
        <Card className="w-full shadow-sm">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                    {loading ? (
                        <>
                            <Skeleton className="h-7 w-48 rounded-xl" />
                            <Skeleton className="h-4 w-80 rounded-xl" />
                        </>
                    ) : displayAgent ? (
                        <>
                            <ModuleCardTitle
                                title={`${displayAgent.agentName}`}
                                help="agent-view"
                            />
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {editingTitle ? (
                                    <InlineEdit
                                        value={titleDraft}
                                        onChange={setTitleDraft}
                                        onSave={onSaveTitle}
                                        onCancel={() => setEditingTitle(false)}
                                        saving={savingTitle}
                                        label="Agent title"
                                        maxLength={MAX_LENGTHS.AGENT_TITLE.max}
                                        width="w-72"
                                    />
                                ) : (
                                    <span className="flex min-w-0 items-center gap-1">
                                        <span className="truncate">
                                            {displayAgent.agentTitle || "—"}
                                        </span>
                                        <EditPencil
                                            tip="Edit title — what users see when this agent is shown to them"
                                            onClick={() => {
                                                setTitleDraft(displayAgent.agentTitle ?? "");
                                                setEditingTitle(true);
                                            }}
                                        />
                                    </span>
                                )}

                                <span className="text-muted-foreground/40">·</span>

                                {editingTag ? (
                                    <InlineEdit
                                        value={tagDraft}
                                        onChange={setTagDraft}
                                        onSave={onSaveTag}
                                        onCancel={() => setEditingTag(false)}
                                        saving={savingTag}
                                        label="Agent tag"
                                        maxLength={MAX_LENGTHS.AGENT_TAG.max}
                                        width="w-40"
                                    />
                                ) : (
                                    <span className="flex items-center gap-1">
                                        <span className="rounded-md border bg-muted/40 px-2 py-0.5">
                                            {displayAgent.agentTag || "no tag"}
                                        </span>
                                        <EditPencil
                                            tip="Edit tag — decides which searches can find this agent"
                                            onClick={() => {
                                                setTagDraft(displayAgent.agentTag ?? "");
                                                setEditingTag(true);
                                            }}
                                        />
                                    </span>
                                )}

                                <span className="text-muted-foreground/40">·</span>

                                {editingLimits ? (
                                    <span className="flex flex-wrap items-center gap-2">
                                        <span className="flex items-center gap-2">
                                            <Input
                                                autoFocus
                                                type="number"
                                                inputMode="numeric"
                                                min={1}
                                                step={1}
                                                value={timeDraft}
                                                disabled={savingLimits}
                                                aria-label={ft("maxTime", "Max run time (seconds)")}
                                                className="h-7 w-24 tabular-nums"
                                                onChange={(e) => setTimeDraft(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") void onSaveLimits();
                                                    if (e.key === "Escape") setEditingLimits(false);
                                                }}
                                            />
                                            <span>s</span>
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <span>$</span>
                                            <Input
                                                type="number"
                                                inputMode="decimal"
                                                min={0}
                                                step="any"
                                                value={costDraft}
                                                disabled={savingLimits}
                                                aria-label={ft(
                                                    "maxCost",
                                                    "Max LLM cost per run (US dollars)",
                                                )}
                                                className="h-7 w-24 tabular-nums"
                                                onChange={(e) => setCostDraft(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") void onSaveLimits();
                                                    if (e.key === "Escape") setEditingLimits(false);
                                                }}
                                            />
                                        </span>
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="h-7"
                                            disabled={savingLimits}
                                            onClick={() => void onSaveLimits()}
                                        >
                                            Save
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7"
                                            disabled={savingLimits}
                                            onClick={() => setEditingLimits(false)}
                                        >
                                            Cancel
                                        </Button>
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1">
                                        <HoverTip tip={fh("maxTime")}>
                                            <span className="tabular-nums">
                                                {agent?.maxTime != null
                                                    ? `${agent.maxTime} s`
                                                    : "no time limit"}
                                            </span>
                                        </HoverTip>
                                        <span className="text-muted-foreground/40">·</span>
                                        <HoverTip tip={fh("maxCost")}>
                                            <span className="tabular-nums">
                                                {agent?.maxCost != null
                                                    ? `$${agent.maxCost} a run`
                                                    : "no cost limit"}
                                            </span>
                                        </HoverTip>
                                        <EditPencil
                                            tip="Edit run limits — how long a run may take and how much it may spend"
                                            onClick={() => {
                                                setTimeDraft(String(agent?.maxTime ?? ""));
                                                setCostDraft(String(agent?.maxCost ?? ""));
                                                setEditingLimits(true);
                                            }}
                                        />
                                    </span>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {displayAgent ? (
                        <>
                            <HoverTip tip="This agent's executions, duration and failures">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        UI.openSubModule("AgentDetailReport", {
                                            agentName: displayAgent.agentName,
                                        })
                                    }
                                >
                                    <BarChart3 className="h-4 w-4" />
                                    Usage
                                </Button>
                            </HoverTip>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    UI.openSubModule("AgentRun", {
                                        agentName: displayAgent.agentName,
                                        agentTitle: displayAgent.agentTitle,
                                        lastUpdatedByName: displayAgent.lastUpdatedByName,
                                        lastUpdatedByEmail: displayAgent.lastUpdatedByEmail,
                                        agentVersion: displayAgent.agentVersion,
                                    })
                                }
                            >
                                <Play className="h-4 w-4" />
                                Run
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void onEditDraft()}
                            >
                                <Pencil className="h-4 w-4" />
                                Edit in a draft
                            </Button>
                        </>
                    ) : null}
                    <BackButton fallback="Agents" />
                </div>
            </CardHeader>

            {displayAgent ? (
                <div className="space-y-3 px-6 pb-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <HoverTip tip={uiText("agent.descriptionPurpose")}>
                                    <Label
                                        htmlFor="agent-description"
                                        className="cursor-help text-sm font-medium"
                                    >
                                        Agent description
                                    </Label>
                                </HoverTip>
                                {isIndexed ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Indexed
                                    </span>
                                ) : (
                                    <span className="text-xs text-muted-foreground">
                                        Not indexed
                                    </span>
                                )}
                            </div>
                            <UpdatedBy
                                obj={{
                                    lastUpdatedByName: agent?.lastDescriptorUpdatedByName,
                                    lastUpdatedByEmail: agent?.lastDescriptorUpdatedByEmail,
                                    configVersion: agent?.descriptorVersion,
                                }}
                            />
                        </div>
                    </div>

                    <Composer
                        maxLength={MAX_LENGTHS.AGENT_DESCRIPTION.max}
                        id="agent-description"
                        value={desc}
                        onChange={(e) => {
                            setDesc(e.target.value);
                            setDescError(null);
                        }}
                        placeholder={uiText("agent.descriptionPrompt")}
                        className="min-h-32"
                        disabled={indexJobRunning}
                        action={
                            <>
                                {isIndexed && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => setConfirmDeindex(true)}
                                        disabled={indexJobRunning}
                                    >
                                        Remove from index
                                    </Button>
                                )}
                                <HoverTip
                                    tip={
                                        indexUpToDate && !indexJobRunning
                                            ? "The index already has this description. Change it to update the index."
                                            : null
                                    }
                                    wrap
                                >
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => void onIndex()}
                                        disabled={
                                            indexJobRunning ||
                                            descTrimmed.length === 0 ||
                                            indexUpToDate
                                        }
                                    >
                                        <TableOfContents className="h-4 w-4" />
                                        {validatingDesc
                                            ? "Validating…"
                                            : indexJobRunning
                                              ? "Indexing…"
                                              : isIndexed
                                                ? "Update index"
                                                : "Add to index"}
                                    </Button>
                                </HoverTip>
                            </>
                        }
                    />

                    {lockedElsewhere && (
                        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                            <span className="font-medium">Indexing in progress.</span> This agent is
                            locked while an indexing job runs against it, so the description cannot
                            be changed yet.
                        </div>
                    )}

                    {validatingDesc && (
                        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                            <span className="font-medium">Validating the description…</span> This
                            can take up to a minute. Please stay on this page until it completes —
                            leaving now would lose your work.
                        </div>
                    )}

                    {descError && (
                        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
                            <div className="font-medium text-destructive">
                                The description was rejected by validation
                            </div>
                            <div className="mt-1 whitespace-pre-wrap">{descError}</div>
                            <div className="mt-1 text-muted-foreground">
                                {uiText("agent.descriptionRejected")}
                            </div>
                        </div>
                    )}
                </div>
            ) : null}

            <AlertDialog open={confirmDeindex} onOpenChange={setConfirmDeindex}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{uiText("agent.removeFromIndexTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            Search queries will no longer match this agent, and its saved
                            description is deleted with it. The text stays in the box until you
                            leave this page, so you can add it back.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                setConfirmDeindex(false);
                                void onRemoveFromIndex();
                            }}
                        >
                            Remove from index
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {agent?.agentName} will be deleted. This cannot be undone.
                            {memoryLabels.length > 0 ? (
                                <>
                                    {" "}
                                    Every user&rsquo;s memories stored under{" "}
                                    {memoryLabels.join(", ")} go with it.
                                </>
                            ) : null}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void onDelete()} variant="destructive">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {displayAgent && memoryLabels.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1 px-6 pb-4 text-xs text-muted-foreground">
                    <HoverTip tip={uiText("agent.memoryLabelsWarning")}>
                        <span className="cursor-help">
                            Stores memories under {memoryLabels.length} label
                            {memoryLabels.length === 1 ? "" : "s"}:
                        </span>
                    </HoverTip>
                    {memoryLabels.map((label) => (
                        <span key={label} className="rounded border px-1.5 py-0.5">
                            {label}
                        </span>
                    ))}
                </div>
            ) : null}

            <Separator />

            <CardContent className="p-0">
                {loading ? (
                    <div className="space-y-3 px-6 py-4">
                        <Skeleton className="h-4 w-[85%]" />
                        <Skeleton className="h-4 w-[92%]" />
                        <Skeleton className="h-4 w-[88%]" />
                        <Skeleton className="h-[48vh] w-full" />
                    </div>
                ) : (
                    <div className="space-y-4 px-6 py-4">
                        {agent ? (
                            <PublishedConst
                                raw={agent.const}
                                error={agent.constError || undefined}
                                label={ft("const", "Const")}
                            />
                        ) : null}

                        {agent ? (
                            <PublishedPrompts
                                prompts={agent.agentPrompts ?? {}}
                                viewingPastVersion={selectedVersion !== CURRENT_VERSION_VALUE}
                            />
                        ) : null}

                        <div className="space-y-0.5">
                            <div className="text-sm font-medium">Agent definition</div>
                            <UpdatedBy obj={displayAgent} />
                        </div>

                        {agent?.hasPastVersions ? (
                            <div className="max-w-md space-y-2">
                                <Select
                                    value={selectedVersion}
                                    onValueChange={handleVersionChange}
                                    disabled={loadingPastVersions || loadingSelectedVersion}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a version" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={CURRENT_VERSION_VALUE}>
                                            Current version
                                        </SelectItem>
                                        {pastVersions.map((item) => (
                                            <SelectItem
                                                key={item.pastVersion}
                                                value={String(item.pastVersion)}
                                            >
                                                <PastVersionLabel item={item} />
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}

                        {loadingSelectedVersion ? (
                            <div className="space-y-3">
                                <Skeleton className="h-4 w-[60%]" />
                                <Skeleton className="h-[48vh] w-full" />
                            </div>
                        ) : displayAgent ? (
                            <JsonCodeBlock
                                value={displayAgent.agentDefinition}
                                highlightPath={payload?.highlightPath}
                            />
                        ) : null}
                    </div>
                )}

                {displayAgent ? (
                    <>
                        <Separator />
                        <div className="flex items-center justify-between gap-3 px-6 py-4">
                            <span className="text-xs text-muted-foreground">
                                {uiText("delete.agentCannotBeUndone")}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                    if (displayAgent.isIndexed) {
                                        toast.warning(uiText("agent.deindexFirst"), {
                                            duration: 8000,
                                        });
                                        return;
                                    }
                                    setConfirmDelete(true);
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                        </div>
                    </>
                ) : null}
            </CardContent>
        </Card>
    );
}
