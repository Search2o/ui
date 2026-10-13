import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import { ApiError, errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import { POOL_NAME, matchesRule } from "@/shared/schemaRules";

export const DEFAULT_POOL_NAME = "default";

export const POOL_NAME_MAX = POOL_NAME.maxLength;

export const POOL_NAME_RULE = uiText("validate.poolName");

export function poolNameError(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return uiText("validate.poolNameRequired");
    if (trimmed.length > POOL_NAME_MAX) {
        return `A pool name can be at most ${POOL_NAME_MAX} characters.`;
    }
    if (!matchesRule(POOL_NAME, trimmed)) return POOL_NAME_RULE;
    return null;
}

let cachedNames: string[] | null = null;
let inflight: Promise<string[]> | null = null;
const subscribers = new Set<() => void>();

export function invalidateApiConnectionPoolNames() {
    cachedNames = null;
    inflight = null;
    subscribers.forEach((fn) => fn());
}

async function fetchNames(): Promise<string[]> {
    if (cachedNames) return cachedNames;
    if (!inflight) {
        inflight = API.getApiConnectionPoolNames({})
            .then((resp) => {
                if (!resp?.success) {
                    throw new ApiError(resp?.error?.message || "Failed to load connection pools");
                }
                cachedNames = resp.apiConnectionPoolNames ?? [];
                return cachedNames;
            })
            .finally(() => {
                inflight = null;
            });
    }
    return inflight;
}

export function useApiConnectionPoolNames() {
    const [names, setNames] = useState<string[]>(cachedNames ?? []);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        let cancelled = false;
        fetchNames()
            .then((list) => {
                if (!cancelled) {
                    setNames(list);
                    setError(null);
                }
            })
            .catch((e) => {
                if (!cancelled) setError(errorText(e, "Failed to load pools."));
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const cancel = load();
        const onInvalidate = () => load();
        subscribers.add(onInvalidate);
        return () => {
            cancel();
            subscribers.delete(onInvalidate);
        };
    }, [load]);

    return { names, error };
}
