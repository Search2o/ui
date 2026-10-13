import { useSyncExternalStore } from "react";
import * as UI from "@/shared/uistate";
import { useSession } from "@/shared/useSession";

const SEARCH_MODULES = new Set<UI.ModuleKey>(["SearchHistory", "SearchConversation"]);

export function isSearchModule(m: UI.ModuleKey): boolean {
    return SEARCH_MODULES.has(m);
}

let leftWorkspace = true;
const listeners = new Set<() => void>();

export function setSearchWorkspace(on: boolean): void {
    const next = !on;
    if (leftWorkspace === next) return;
    leftWorkspace = next;
    listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}

const getSnapshot = () => leftWorkspace;

export function useSearchWorkspace(): boolean {
    const { user } = useSession();
    const active = UI.useActiveModule();
    const left = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const role = user?.role;
    if (role === "user") return true;
    if (role !== "developer" && role !== "admin" && role !== "owner") return false;

    return SEARCH_MODULES.has(active) && !left;
}

export function resetSearchWorkspace(): void {
    leftWorkspace = true;
    listeners.forEach((fn) => fn());
}
