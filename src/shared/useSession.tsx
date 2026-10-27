import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import * as API from "@/orval/search2o";
import { onSessionExpired, suppressToastsBriefly } from "@/shared/sessionExpiry";
import { usageLimitResetAt } from "@/shared/usageLimit";
import { errorText } from "@/shared/apiError";
import { finishPendingSso, suppressAutoSso } from "@/shared/ssoSignIn";
import { applyUiConfig } from "@/shared/uiConfig";
import type {
    AccountNameResponseModel,
    ThemeType,
    UserProfileModel,
} from "@/orval/search2o.schemas";

export type SessionStatus =
    "booting" | "authenticated" | "unauthenticated" | "unreachable" | "limited";

function resolveSystemTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

function applyTheme(mode: ThemeType) {
    const root = document.documentElement;
    const actual = mode === "system" ? resolveSystemTheme() : mode;

    root.classList.toggle("dark", actual === "dark");
    root.setAttribute("data-theme", mode);

    try {
        localStorage.setItem("ui.theme", mode);
    } catch {}
}

function getErrorStatus(error: unknown): number | undefined {
    const e = error as {
        status?: number;
        response?: { status?: number };
        cause?: {
            status?: number;
            response?: { status?: number };
        };
    };

    return e?.status ?? e?.response?.status ?? e?.cause?.status ?? e?.cause?.response?.status;
}

type SessionContextShape = {
    user: UserProfileModel | null;
    accountName: string;
    authMethods: string[] | null;
    serviceLevel: string | null;
    theme: ThemeType;
    sessionStatus: SessionStatus;
    limitMessage: string;
    lastError: unknown | null;
    sessionExpired: boolean;

    setTheme: (mode: ThemeType, opts?: { persist?: boolean }) => void;

    refreshProfile: () => Promise<void>;

    retryBootstrap: () => Promise<void>;

    signOut: () => Promise<string | null>;

    setAccountName: React.Dispatch<React.SetStateAction<string>>;
    setServiceLevel: React.Dispatch<React.SetStateAction<string | null>>;
    setUser: React.Dispatch<React.SetStateAction<UserProfileModel | null>>;
};

const SessionContext = createContext<SessionContextShape | null>(null);

let uiConfigLoaded = false;

async function loadUiConfig(): Promise<void> {
    if (uiConfigLoaded) return;
    try {
        const resp = await API.getUiConfig();
        if (!resp?.success) {
            console.warn("Search2o: getUiConfig failed; using the default UI config.", resp?.error);
            return;
        }
        applyUiConfig(resp.uiConfig);
        uiConfigLoaded = true;
    } catch (error) {
        console.warn("Search2o: getUiConfig failed; using the default UI config.", error);
    }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const bootedRef = useRef(false);
    const [user, setUser] = useState<UserProfileModel | null>(null);
    const [accountName, setAccountName] = useState("");
    const [authMethods, setAuthMethods] = useState<string[] | null>(null);
    const [serviceLevel, setServiceLevel] = useState<string | null>(null);
    const [sessionStatus, setSessionStatus] = useState<SessionStatus>("booting");
    const [limitMessage, setLimitMessage] = useState("");
    const [sessionExpired, setSessionExpired] = useState(false);
    const [lastError, setLastError] = useState<unknown | null>(null);

    const initialTheme: ThemeType = useMemo(() => {
        try {
            const v = localStorage.getItem("ui.theme") as ThemeType | null;
            if (v === "light" || v === "dark" || v === "system") return v;
        } catch {}
        return "system";
    }, []);
    const [theme, _setTheme] = useState<ThemeType>(initialTheme);

    const setTheme = useCallback((mode: ThemeType, opts?: { persist?: boolean }) => {
        _setTheme(mode);
        applyTheme(mode);
        if (opts?.persist) {
            try {
                localStorage.setItem("ui.theme", mode);
            } catch {}
        }
    }, []);

    const refreshProfile = useCallback(async () => {
        try {
            const resp = await API.getUserProfile();

            if (resp?.success && resp.user) {
                const nextUser: UserProfileModel = resp.user;
                setUser(nextUser);
                setSessionExpired(false);
                setSessionStatus("authenticated");
                setLastError(null);

                const prefTheme = nextUser.uiPref?.theme as ThemeType | null | undefined;
                if (prefTheme) {
                    setTheme(prefTheme);
                }
                return;
            }

            setUser(null);
            if (usageLimitResetAt(resp?.error) !== null) {
                setLimitMessage(resp?.error?.message ?? "");
                setSessionStatus("limited");
                setLastError(null);
                return;
            }
            setSessionStatus("unauthenticated");
            setLastError(null);
        } catch (error) {
            const status = getErrorStatus(error);
            setUser(null);

            if (status === 401 || status === 403) {
                setSessionStatus("unauthenticated");
                setLastError(null);
            } else {
                setSessionStatus("unreachable");
                setLastError(error);
            }
        }
    }, [setTheme]);

    const signOut = useCallback(async (): Promise<string | null> => {
        try {
            const res = await API.logout();
            if (!res?.success) return res?.error?.message || "Sign-out failed.";
        } catch (e) {
            return errorText(e, "Sign-out failed.");
        }
        setUser(null);
        setSessionExpired(false);
        setLimitMessage("");
        setSessionStatus("unauthenticated");
        suppressAutoSso();
        return null;
    }, []);

    const retryBootstrap = useCallback(async () => {
        setSessionStatus("booting");
        setLastError(null);
        setLimitMessage("");

        try {
            const [accountResp]: [AccountNameResponseModel, void] = await Promise.all([
                API.getAccountName(),
                loadUiConfig(),
            ]);

            if (!accountResp?.success) {
                if (usageLimitResetAt(accountResp?.error) !== null) {
                    setLimitMessage(accountResp.error?.message ?? "");
                    setSessionStatus("limited");
                    setLastError(null);
                    return;
                }
                throw new Error("getAccountName failed");
            }

            setAccountName(accountResp.accountName ?? "");
            setAuthMethods(accountResp.authMethods ?? null);
            setServiceLevel(accountResp.serviceLevel ?? null);

            await finishPendingSso();

            await refreshProfile();
        } catch (error) {
            setUser(null);
            setSessionStatus("unreachable");
            setLastError(error);
        }
    }, [refreshProfile]);

    useEffect(() => {
        applyTheme(theme);
        if (typeof window !== "undefined") {
            const media = window.matchMedia("(prefers-color-scheme: dark)");
            const handle = () => {
                let current: ThemeType;
                try {
                    current = (localStorage.getItem("ui.theme") as ThemeType | null) || theme;
                } catch {
                    current = theme;
                }
                if (current === "system") applyTheme("system");
            };
            media.addEventListener?.("change", handle);
            return () => media.removeEventListener?.("change", handle);
        }
    }, [theme]);

    const wasSignedInRef = useRef(false);
    useEffect(() => {
        if (sessionStatus === "authenticated") wasSignedInRef.current = true;
    }, [sessionStatus]);

    useEffect(
        () =>
            onSessionExpired(() => {
                setUser(null);
                if (wasSignedInRef.current) {
                    setSessionExpired(true);
                    suppressAutoSso();
                    suppressToastsBriefly();
                }
                setSessionStatus("unauthenticated");
            }),
        [],
    );

    useEffect(() => {
        if (bootedRef.current) return;
        bootedRef.current = true;
        void retryBootstrap();
    }, [retryBootstrap]);

    const value = useMemo<SessionContextShape>(
        () => ({
            user,
            accountName,
            authMethods,
            serviceLevel,
            theme,
            sessionStatus,
            limitMessage,
            lastError,
            sessionExpired,
            setTheme,
            refreshProfile,
            retryBootstrap,
            signOut,
            setUser,
            setAccountName,
            setServiceLevel,
        }),
        [
            user,
            accountName,
            authMethods,
            serviceLevel,
            theme,
            sessionStatus,
            lastError,
            sessionExpired,
            setTheme,
            refreshProfile,
            retryBootstrap,
            limitMessage,
            signOut,
        ],
    );

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextShape {
    const ctx = useContext(SessionContext);
    if (!ctx) {
        throw new Error("useSession must be used within a SessionProvider");
    }
    return ctx;
}
