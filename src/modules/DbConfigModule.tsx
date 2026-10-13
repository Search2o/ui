import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { toast } from "sonner";
import type { AgentConfigPartRowModel, DbConnectionModel } from "@/orval/search2o.schemas";
import { ProfileTable, type ProfileColumn } from "@/shared/ProfileTable";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

type Row = {
    name: string;
    connectionString: string;
    usedBy: number;
};

const MAX_ROWS = 100;

const COLUMNS: ProfileColumn<Row>[] = [
    { header: "Profile", cell: (r) => <span className="font-medium">{r.name}</span> },
    {
        header: "Connection",
        cell: (r) => <span className="block max-w-xl truncate">{r.connectionString || "—"}</span>,
    },
    {
        header: "Used by",
        className: "tabular-nums",
        cell: (r) => (r.usedBy ? `${r.usedBy} agent${r.usedBy === 1 ? "" : "s"}` : "—"),
    },
];

export default function DbConfigModule() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<Row[]>([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const resp = await API.getAgentConfigPart({ part: "db" });
            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to load database profiles");
                setError(resp.error?.message || "Failed to load database profiles");
                return;
            }
            const items = (resp.configParts ?? []) as AgentConfigPartRowModel[];
            setRows(
                items
                    .map((item) => {
                        const v = (item.configValue ?? {}) as DbConnectionModel;
                        return {
                            name: v.name ?? "",
                            connectionString: String(v.connectionString ?? ""),
                            usedBy: (item.usedBy ?? []).length,
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name)),
            );
        } catch (e) {
            toast.error(errorText(e, "Failed to load database profiles"));
            setError(errorText(e, "Failed to load database profiles"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <ProfileTable<Row>
            title="Database profiles"
            help="db-profiles"
            items={rows}
            columns={COLUMNS}
            rowKey={(r) => r.name}
            onRowClick={(r) => UI.openSubModule("DbConfigDetail", { name: r.name })}
            onAdd={() => UI.openSubModule("DbConfigDetail", { isNew: true })}
            addLabel="Add database profile"
            emptyMessage={uiText("empty.dbProfiles")}
            maxRows={MAX_ROWS}
            loading={loading}
            error={error}
        />
    );
}
