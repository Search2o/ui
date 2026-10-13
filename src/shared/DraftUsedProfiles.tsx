import { useEffect, useMemo, useState } from "react";
import * as API from "@/orval/search2o";
import type { ProfilesResponseModelProfiles } from "@/orval/search2o.schemas";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import {
    profileGroups,
    profileTypeLabel,
    toggleUsedProfile,
    type UsedProfiles,
} from "@/shared/draftHelpPrompt";

type Entry = { name: string; doc: string; missing: boolean };
type Group = { type: string; label: string; entries: Entry[] };

export function DraftUsedProfiles({
    value,
    onChange,
    disabled,
}: {
    value: UsedProfiles;
    onChange: (next: UsedProfiles) => void;
    disabled?: boolean;
}) {
    const [profiles, setProfiles] = useState<ProfilesResponseModelProfiles | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const fh = useFieldHelp("DraftResponseModel");
    const ft = useFieldTitle("DraftResponseModel");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const resp = await API.getProfiles({});
                if (cancelled) return;
                if (!resp.success) {
                    setLoadError(resp.error?.message || "The profiles could not be loaded.");
                    return;
                }
                setProfiles(resp.profiles ?? {});
            } catch (e) {
                if (!cancelled) setLoadError(errorText(e, "The profiles could not be loaded."));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const groups = useMemo<Group[]>(() => {
        const out: Group[] = profileGroups(profiles).map((g) => ({
            type: g.type,
            label: g.label,
            entries: g.profiles.map((p) => ({ name: p.name, doc: p.doc, missing: false })),
        }));
        if (profiles === null) return out;
        for (const [type, names] of Object.entries(value)) {
            let group = out.find((g) => g.type === type);
            if (!group) {
                group = { type, label: profileTypeLabel(type), entries: [] };
                out.push(group);
            }
            for (const name of names) {
                if (!group.entries.some((e) => e.name === name)) {
                    group.entries.push({ name, doc: "", missing: true });
                }
            }
        }
        return out;
    }, [profiles, value]);

    if (!loadError && profiles !== null && groups.length === 0) return null;

    return (
        <div className="space-y-2">
            <FieldLabel help={fh("usedProfiles")} className="text-sm">
                {ft("usedProfiles", "Used profiles")}
            </FieldLabel>
            {loadError ? (
                <p className="text-sm text-destructive">{loadError}</p>
            ) : profiles === null ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Loading profiles…
                </p>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {groups.map((g) => (
                        <fieldset key={g.type} className="min-w-0 space-y-1.5">
                            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {g.label}
                            </legend>
                            {g.entries.map((entry) => {
                                const id = `used-profile-${g.type}-${entry.name}`;
                                const checked = (value[g.type] ?? []).includes(entry.name);
                                return (
                                    <label
                                        key={entry.name}
                                        htmlFor={id}
                                        className="flex items-start gap-2 text-sm"
                                    >
                                        <Checkbox
                                            id={id}
                                            className="mt-0.5"
                                            checked={checked}
                                            disabled={disabled}
                                            onCheckedChange={(c) =>
                                                onChange(
                                                    toggleUsedProfile(
                                                        value,
                                                        g.type,
                                                        entry.name,
                                                        c === true,
                                                    ),
                                                )
                                            }
                                        />
                                        <span className="min-w-0">
                                            <span className="block font-mono text-xs">
                                                {entry.name}
                                            </span>
                                            {entry.missing ? (
                                                <span className="block text-xs text-muted-foreground">
                                                    {uiText("draft.profileNotConfigured")}
                                                </span>
                                            ) : entry.doc.trim() ? (
                                                <span
                                                    className="block truncate text-xs text-muted-foreground"
                                                    title={entry.doc}
                                                >
                                                    {entry.doc}
                                                </span>
                                            ) : null}
                                        </span>
                                    </label>
                                );
                            })}
                        </fieldset>
                    ))}
                </div>
            )}
        </div>
    );
}
