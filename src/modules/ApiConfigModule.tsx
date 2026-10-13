import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { toast } from "sonner";
import type { AgentConfigPartRowModel, ApiServerModel } from "@/orval/search2o.schemas";
import { ProfileTable, type ProfileColumn } from "@/shared/ProfileTable";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

type Row = {
    name: string;
    url: string;
    usedBy: number;
};

const MAX_ROWS = 100;

const COLUMNS: ProfileColumn<Row>[] = [
    { header: "Profile", cell: (r) => <span className="font-medium">{r.name}</span> },
    {
        header: "URL",
        cell: (r) => <span className="block max-w-xl truncate">{r.url || "—"}</span>,
    },
    {
        header: "Used by",
        className: "tabular-nums",
        cell: (r) => (r.usedBy ? `${r.usedBy} agent${r.usedBy === 1 ? "" : "s"}` : "—"),
    },
];

export default function ApiConfigModule() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<Row[]>([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const resp = await API.getAgentConfigPart({ part: "api" });
            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to load api profiles");
                setError(resp.error?.message || "Failed to load api profiles");
                return;
            }
            const items = (resp.configParts ?? []) as AgentConfigPartRowModel[];
            setRows(
                items
                    .map((item) => {
                        const v = (item.configValue ?? {}) as ApiServerModel;
                        return {
                            name: v.name ?? "",
                            url: String(v.url ?? ""),
                            usedBy: (item.usedBy ?? []).length,
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name)),
            );
        } catch (e) {
            toast.error(errorText(e, "Failed to load api profiles"));
            setError(errorText(e, "Failed to load api profiles"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <ProfileTable<Row>
            title="API profiles"
            help="api-profiles"
            items={rows}
            columns={COLUMNS}
            rowKey={(r) => r.name}
            onRowClick={(r) => UI.openSubModule("ApiConfigDetail", { name: r.name })}
            onAdd={() => UI.openSubModule("ApiConfigDetail", { isNew: true })}
            addLabel="Add API profile"
            emptyMessage={uiText("empty.apiProfiles")}
            maxRows={MAX_ROWS}
            loading={loading}
            error={error}
        />
    );
}
