import { useCallback, useEffect, useState, useRef } from "react";
import * as API from "@/orval/search2o";
import type { AgentConfigPartRowModel, PromptProfileModel } from "@/orval/search2o.schemas";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { Trash2 } from "lucide-react";
import { ActionBar } from "@/shared/ActionBar";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp } from "@/shared/fieldHelp";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { ProfileDoc } from "@/shared/ProfileDoc";
import { openNameSet, reopenByName, makeUiId } from "@/shared/collectionUi";
import { Input } from "@/components/ui/input";
import { HoverTip } from "@/shared/HoverTip";
import * as UI from "@/shared/uistate";
import { BackButton } from "@/shared/BackButton";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";
import { UsedByAgents } from "@/shared/UsedByAgents";

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
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import { MAX_LENGTHS } from "@/shared/schemaRules";

type EditablePromptProfile = PromptProfileModel & {
    uiId: string;
    source: PromptProfileModel;
    lastUpdatedByEmail?: string;
    lastUpdatedByName?: string;
    configVersion?: number;
    usedBy: string[];
    isNew?: boolean;
    isSaving?: boolean;
    isDeleting?: boolean;
};

function itemToEditable(item: AgentConfigPartRowModel): EditablePromptProfile {
    const profile = item.configValue as PromptProfileModel;
    return {
        uiId: makeUiId(profile.name),
        source: profile,
        name: profile.name,
        system: profile.system ?? "",
        user: profile.user ?? "",
        doc: profile.doc ?? "",
        lastUpdatedByEmail: item.lastUpdatedByEmail,
        lastUpdatedByName: item.lastUpdatedByName,
        configVersion: item.configVersion,
        usedBy: Array.isArray(item.usedBy) ? item.usedBy : [],
    };
}

function editableToProfile(profile: EditablePromptProfile): PromptProfileModel {
    return {
        ...profile.source,
        name: profile.name.trim(),
        type: "prompt",
        system: profile.system?.trim() ? profile.system : null,
        user: profile.user?.trim() ? profile.user : null,
        doc: profile.doc ?? "",
    };
}

function openAgentView(agentName: string) {
    UI.openSubModule("AgentView", {
        agentName,
    });
}

export default function PromptConfigDetailModule() {
    function addProfile() {
        const uiId = makeUiId("prompt");
        setProfiles((previous) => [
            {
                uiId,
                source: { name: "", type: "prompt" },
                name: "",
                system: "",
                user: "",
                usedBy: [],
                isNew: true,
            },
            ...previous,
        ]);
        setOpenProfiles((previous) => ({ ...previous, [uiId]: true }));
    }

    const payload = UI.useModulePayload<{ name?: string; isNew?: boolean }>();
    const fh = useFieldHelp("PromptProfileModel");
    const [loading, setLoading] = useState(true);
    const [, setError] = useState<string | null>(null);
    const [collectionConfigVersion, setCollectionConfigVersion] = useState<number>(0);
    const [profiles, setProfiles] = useState<EditablePromptProfile[]>([]);
    const [openProfiles, setOpenProfiles] = useState<Record<string, boolean>>({});
    const [deleteTarget, setDeleteTarget] = useState<{
        index: number;
        name: string;
    } | null>(null);

    const loadProfiles = useCallback(async (keepOpenNames?: Set<string>) => {
        try {
            setLoading(true);
            const response = await API.getAgentConfigPart({ part: "prompt" });

            if (!response.success) {
                const message = response.error?.message || "Failed to load prompt profiles";
                toast.error(message);
                setError(message);
                return;
            }

            const configParts = response.configParts ?? [];

            const maxConfigVersion = configParts.reduce(
                (max, item) => Math.max(max, Number(item?.configVersion ?? 0)),
                0,
            );

            setCollectionConfigVersion(maxConfigVersion);
            const nextProfiles = configParts.map(itemToEditable);
            setProfiles(nextProfiles);
            setOpenProfiles(reopenByName(nextProfiles, keepOpenNames));
            setError(null);
        } catch (e) {
            const message = errorText(e, "Failed to load prompt profiles");
            toast.error(message);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadProfiles();
    }, [loadProfiles]);

    function removeLocalProfile(index: number) {
        const uiId = profiles[index]?.uiId;
        if (uiId) {
            setOpenProfiles((previous) => {
                const next = { ...previous };
                delete next[uiId];
                return next;
            });
        }
        setProfiles((previous) => previous.filter((_, i) => i !== index));
    }

    function updateProfileField<K extends keyof EditablePromptProfile>(
        index: number,
        field: K,
        value: EditablePromptProfile[K],
    ) {
        setProfiles((previous) =>
            previous.map((profile, i) => (i === index ? { ...profile, [field]: value } : profile)),
        );
    }

    async function handleUpsert(index: number): Promise<boolean> {
        const profile = profiles[index];
        if (!profile) return false;

        if (!profile.name.trim()) {
            toast.error("Profile name is required");
            return false;
        }

        try {
            updateProfileField(index, "isSaving", true);
            const response = await API.upsertAgentConfigPart({
                configValue: editableToProfile(profile),
                configVersion: profile.configVersion ?? collectionConfigVersion ?? 0,
            });

            if (!response.success) {
                toast.error(response.error?.message || "Failed to save prompt profile");
                return false;
            }

            toast.success("Prompt profile saved");
            await loadProfiles(openNameSet(profiles, openProfiles));
            if (profile.isNew) {
                UI.updatePayload({ name: profile.name.trim(), isNew: false });
            }
            return true;
        } catch (e) {
            toast.error(errorText(e, "Failed to save prompt profile"));
            return false;
        } finally {
            updateProfileField(index, "isSaving", false);
        }
    }

    async function handleConfirmDelete() {
        if (!deleteTarget) return;
        await handleDelete(deleteTarget.index);
        setDeleteTarget(null);
        releaseGuard();
        UI.goBack("PromptConfig");
    }

    async function handleDelete(index: number) {
        const profile = profiles[index];
        if (!profile) return;

        if (profile.isNew || !profile.name.trim()) {
            removeLocalProfile(index);
            return;
        }

        try {
            updateProfileField(index, "isDeleting", true);
            const response = await API.deleteAgentConfigPart({
                part: "prompt",
                name: profile.name.trim(),
                configVersion: profile.configVersion ?? collectionConfigVersion ?? 0,
            });

            if (!response.success) {
                toast.error(response.error?.message || "Failed to delete prompt profile");
                return;
            }

            toast.success("Prompt profile deleted");
            await loadProfiles(openNameSet(profiles, openProfiles));
        } catch (e) {
            toast.error(errorText(e, "Failed to delete prompt profile"));
        } finally {
            updateProfileField(index, "isDeleting", false);
        }
    }

    useEffect(() => {
        if (loading || !payload?.isNew) return;
        if (profiles.some((x) => x.isNew)) return;
        addProfile();
    }, [loading, payload?.isNew, profiles]);

    const index = payload?.name
        ? profiles.findIndex((p) => (p.name ?? "") === payload.name)
        : profiles.findIndex((p) => p.isNew);
    const profile = index >= 0 ? profiles[index] : undefined;

    const snapshotOf = (p: (typeof profiles)[number]) =>
        JSON.stringify({
            ...p,
            uiId: undefined,
            isNew: undefined,
            usedBy: undefined,
            isSaving: undefined,
            isDeleting: undefined,
            configVersion: undefined,
            lastUpdatedByEmail: undefined,
            lastUpdatedByName: undefined,
            source: undefined,
        });
    const savedSnapshotRef = useRef<string | null>(null);
    const collRef = useRef(profiles);
    collRef.current = profiles;
    const key = profile ? `${profile.uiId}:${index}` : "";
    const lastKeyRef = useRef("");
    if (profile && key !== lastKeyRef.current) {
        lastKeyRef.current = key;
        savedSnapshotRef.current = profile.isNew ? null : snapshotOf(profile);
    }
    const dirty =
        !!profile &&
        (savedSnapshotRef.current === null || snapshotOf(profile) !== savedSnapshotRef.current);

    const { dialog: unsavedDialog, release: releaseGuard } = useUnsavedChanges({
        what: "profile",
        isDirty: () => {
            const current = collRef.current[index];
            if (!current) return false;
            if (savedSnapshotRef.current === null) return true;
            return snapshotOf(current) !== savedSnapshotRef.current;
        },
        onSave: async () => (index >= 0 ? handleUpsert(index) : false),
    });

    if (loading) {
        return (
            <Card className="w-full shadow-sm">
                <CardHeader>
                    <ModuleCardTitle title="Prompt profile" help="prompt-profile-detail" />
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
            </Card>
        );
    }

    if (!profile) {
        return (
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <ModuleCardTitle title="Prompt profile" help="prompt-profile-detail" />
                    <BackButton fallback="PromptConfig" />
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    That profile no longer exists.
                </CardContent>
            </Card>
        );
    }

    const isUsed = profile.usedBy.length > 0;

    return (
        <>
            <Card className="w-full shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                        <ModuleCardTitle
                            title={profile.name || "New prompt profile"}
                            help="prompt-profile-detail"
                        />
                        {profile.isNew ? (
                            <div className="space-y-1 pt-1">
                                <HoverTip tip={uiText("validate.profileNameChars")}>
                                    <Input
                                        autoFocus
                                        value={profile.name}
                                        onChange={(e) =>
                                            updateProfileField(index, "name", e.target.value)
                                        }
                                        placeholder="Profile name"
                                        maxLength={MAX_LENGTHS.PROFILE_NAME.max}
                                        className="h-8 w-full max-w-sm"
                                    />
                                </HoverTip>
                            </div>
                        ) : null}
                        {isUsed ? (
                            <UsedByAgents names={profile.usedBy} onOpen={openAgentView} />
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                        <BackButton fallback="PromptConfig" />
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="space-y-4 px-4 pb-4">
                        <Card className="rounded-2xl border bg-card shadow-none">
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <FieldLabel
                                        help={fh("system")}
                                        htmlFor={`profile-${index}-system`}
                                    >
                                        System prompt
                                    </FieldLabel>
                                    <Textarea
                                        id={`profile-${index}-system`}
                                        value={profile.system ?? ""}
                                        onChange={(e) =>
                                            updateProfileField(index, "system", e.target.value)
                                        }
                                        disabled={profile.isSaving || profile.isDeleting}
                                        className="min-h-[140px]"
                                        placeholder="System prompt"
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <FieldLabel help={fh("user")} htmlFor={`profile-${index}-user`}>
                                        User prompt
                                    </FieldLabel>
                                    <Textarea
                                        id={`profile-${index}-user`}
                                        value={profile.user ?? ""}
                                        onChange={(e) =>
                                            updateProfileField(index, "user", e.target.value)
                                        }
                                        disabled={profile.isSaving || profile.isDeleting}
                                        className="min-h-[240px]"
                                        placeholder="User prompt"
                                    />
                                </div>

                                <ProfileDoc
                                    id={`profile-${index}-doc`}
                                    value={profile.doc ?? ""}
                                    help={fh("doc")}
                                    onChange={(v) => updateProfileField(index, "doc", v)}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>

                <ActionBar
                    onUpdate={() => void handleUpsert(index)}
                    dirty={dirty}
                    busy={!!profile.isSaving}
                    disabled={!!profile.isDeleting}
                    start={
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget({ index, name: profile.name ?? "" })}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                {isUsed
                                    ? uiText("delete.promptInUse")
                                    : uiText("delete.cannotBeUndone")}
                            </span>
                        </>
                    }
                />
            </Card>

            <AlertDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete profile</AlertDialogTitle>
                        <AlertDialogDescription>
                            Any agents using{" "}
                            <span className="font-semibold">{deleteTarget?.name}</span> will fail
                            immediately. Are you sure?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {unsavedDialog}
        </>
    );
}
