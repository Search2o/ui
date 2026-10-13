import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import * as UI from "@/shared/uistate";
import { toast } from "sonner";
import type { AgentConfigPartRowModel, McpServerModel } from "@/orval/search2o.schemas";
import { ProfileTable, type ProfileColumn } from "@/shared/ProfileTable";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";

type Row = {
    name: string;
    url: string;
    usedBy: number;
};

const MAX_ROWS = 25;

const COLUMNS: ProfileColumn<Row>[] = [
    { header: "Server", cell: (r) => <span className="font-medium">{r.name}</span> },
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

export default function McpConfigModule() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<Row[]>([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const resp = await API.getAgentConfigPart({ part: "mcp" });
            if (!resp.success) {
                toast.error(resp.error?.message || "Failed to load mcp servers");
                setError(resp.error?.message || "Failed to load mcp servers");
                return;
            }
            const items = (resp.configParts ?? []) as AgentConfigPartRowModel[];
            setRows(
                items
                    .map((item) => {
                        const v = (item.configValue ?? {}) as McpServerModel;
                        return {
                            name: v.name ?? "",
                            url: String(v.url ?? ""),
                            usedBy: (item.usedBy ?? []).length,
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name)),
            );
        } catch (e) {
            toast.error(errorText(e, "Failed to load mcp servers"));
            setError(errorText(e, "Failed to load mcp servers"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <ProfileTable<Row>
            title="MCP servers"
            help="mcp-servers"
            items={rows}
            columns={COLUMNS}
            rowKey={(r) => r.name}
            onRowClick={(r) => UI.openSubModule("MCPConfigDetail", { name: r.name })}
            onAdd={() => UI.openSubModule("MCPConfigDetail", { isNew: true })}
            addLabel="Add MCP server"
            emptyMessage={uiText("empty.mcpServers")}
            maxRows={MAX_ROWS}
            loading={loading}
            error={error}
        />
    );
}
