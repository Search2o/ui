import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { toast } from "sonner";
import type { AgentConfigPartRowModel, LlmModel } from "@/orval/search2o.schemas";
import { ProfileTable, type ProfileColumn } from "@/shared/ProfileTable";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

type Row = {
    name: string;
    adapter: string;
    model: string;
    usedBy: number;
};

const MAX_PROFILES = 25;

const COLUMNS: ProfileColumn<Row>[] = [
    { header: "Profile", cell: (r) => <span className="font-medium">{r.name}</span> },
    { header: "Adapter", cell: (r) => r.adapter || "—" },
    { header: "Model", cell: (r) => r.model || "—" },
    {
        header: "Used by",
        className: "tabular-nums",
        cell: (r) => (r.usedBy ? `${r.usedBy} agent${r.usedBy === 1 ? "" : "s"}` : "—"),
    },
];

export default function LlmProfileModule() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<Row[]>([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const resp = await API.getAgentConfigPart({ part: "llm" });
            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to load LLM profiles");
                setError(resp.error?.message || "Failed to load LLM profiles");
                return;
            }
            const items = (resp.configParts ?? []) as AgentConfigPartRowModel[];
            setRows(
                items
                    .map((item) => {
                        const value = (item.configValue ?? {}) as LlmModel;
                        return {
                            name: value.name ?? "",
                            adapter: value.adapter ?? "",
                            model: value.model ?? "",
                            usedBy: (item.usedBy ?? []).length,
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name)),
            );
        } catch (e) {
            toast.error(errorText(e, "Failed to load LLM profiles"));
            setError(errorText(e, "Failed to load LLM profiles"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <ProfileTable<Row>
            title="LLM profiles"
            help="llm-profiles"
            items={rows}
            columns={COLUMNS}
            rowKey={(r) => r.name}
            onRowClick={(r) => UI.openSubModule("LlmProfileDetail", { name: r.name })}
            onAdd={() => UI.openSubModule("LlmProfileDetail", { isNew: true })}
            addLabel="Add LLM profile"
            emptyMessage={uiText("empty.llmProfiles")}
            maxRows={MAX_PROFILES}
            loading={loading}
            error={error}
        />
    );
}
