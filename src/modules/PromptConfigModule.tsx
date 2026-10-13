import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { toast } from "sonner";
import type { AgentConfigPartRowModel, PromptProfileModel } from "@/orval/search2o.schemas";
import { ProfileTable, type ProfileColumn } from "@/shared/ProfileTable";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

type Row = {
    name: string;
    system: string;
    usedBy: number;
};

const MAX_ROWS = 200;

const COLUMNS: ProfileColumn<Row>[] = [
    { header: "Profile", cell: (r) => <span className="font-medium">{r.name}</span> },
    {
        header: "System prompt",
        cell: (r) => <span className="block max-w-xl truncate">{r.system || "—"}</span>,
    },
    {
        header: "Used by",
        className: "tabular-nums",
        cell: (r) => (r.usedBy ? `${r.usedBy} agent${r.usedBy === 1 ? "" : "s"}` : "—"),
    },
];

export default function PromptConfigModule() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<Row[]>([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const resp = await API.getAgentConfigPart({ part: "prompt" });
            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to load prompt profiles");
                setError(resp.error?.message || "Failed to load prompt profiles");
                return;
            }
            const items = (resp.configParts ?? []) as AgentConfigPartRowModel[];
            setRows(
                items
                    .map((item) => {
                        const v = (item.configValue ?? {}) as PromptProfileModel;
                        return {
                            name: v.name ?? "",
                            system: String(v.system ?? ""),
                            usedBy: (item.usedBy ?? []).length,
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name)),
            );
        } catch (e) {
            toast.error(errorText(e, "Failed to load prompt profiles"));
            setError(errorText(e, "Failed to load prompt profiles"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <ProfileTable<Row>
            title="Prompt profiles"
            help="prompt-profiles"
            items={rows}
            columns={COLUMNS}
            rowKey={(r) => r.name}
            onRowClick={(r) => UI.openSubModule("PromptConfigDetail", { name: r.name })}
            onAdd={() => UI.openSubModule("PromptConfigDetail", { isNew: true })}
            addLabel="Add prompt profile"
            emptyMessage={uiText("empty.promptProfiles")}
            maxRows={MAX_ROWS}
            loading={loading}
            error={error}
        />
    );
}
