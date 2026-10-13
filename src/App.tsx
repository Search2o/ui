import { Suspense, lazy, useEffect, useState } from "react";
import { SessionProvider, useSession } from "@/shared/useSession";
import { Clock, Loader2, LogOut, RefreshCcw, WifiOff } from "lucide-react";
import { uiText } from "@/shared/uiText";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IndexingAlerts } from "@/shared/IndexingAlerts";
import { AppToaster } from "@/shared/AppToaster";
import { ErrorBoundary } from "@/shared/ErrorBoundary";
import { AppErrorScreen, AppUpdatedScreen } from "@/shared/ErrorScreens";
import { isModuleLoadError } from "@/shared/appUpdated";
import * as API from "@/orval/search2o";
import { toast } from "sonner";
import { clearConnectId, connectIdFrom } from "@/shared/connectRequest";
import { hadSsoReturn, suppressAutoSso, takeStashedConnectId } from "@/shared/ssoSignIn";
import { useSuspendedAccount } from "@/shared/accountSuspended";
import { WelcomeDialog } from "@/shared/WelcomeDialog";
import { markWelcomeSeen, shouldShowWelcome } from "@/shared/welcomeSeen";
import { AccountSuspendedScreen } from "@/shared/AccountSuspendedScreen";
import { Logo } from "@/shared/Logo";

const NavigationModule = lazy(() => import("@/modules/NavigationModule"));
const LoginModule = lazy(() => import("@/modules/LoginModule"));
const ConnectModule = lazy(() => import("@/modules/ConnectModule"));

function LoadingInline() {
    return (
        <div className="rounded-2xl border bg-card text-card-foreground shadow-sm px-6 py-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
    );
}

function UnreachableScreen({ onRetry }: { onRetry: () => void }) {
    return (
        <main id="main" className="min-h-screen bg-background px-4">
            <div className="min-h-screen grid place-items-center">
                <Card className="w-full max-w-xl rounded-2xl border bg-card/80 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="mt-0.5 h-5 w-5 shrink-0 rounded-2xl bg-muted/60 ring-1 ring-border flex items-center justify-center">
                                <WifiOff className="h-5 w-5 text-muted-foreground" aria-hidden />
                            </div>

                            <div className="min-w-0 space-y-5">
                                <div className="flex items-center gap-10">
                                    <Logo className="h-6 md:h-6 w-auto select-none" />
                                    <CardTitle className="text-base md:text-lg leading-tight">
                                        Agent server is unreachable
                                    </CardTitle>
                                </div>

                                <CardDescription className="text-sm leading-relaxed">
                                    The UI couldn’t connect to the Search2o agent server. Verify the
                                    server is running and reachable from your network, then try
                                    again.
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
                            <div className="flex items-center gap-2">
                                <Button onClick={onRetry}>
                                    <RefreshCcw className="mr-2 h-4 w-4" aria-hidden />
                                    Retry
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            </div>
        </main>
    );
}

function LimitedScreen({ message }: { message: string }) {
    const { signOut } = useSession();
    const [signingOut, setSigningOut] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);

    const onSignOut = async () => {
        if (signingOut) return;
        setSigningOut(true);
        setFailed(await signOut());
        setSigningOut(false);
    };

    return (
        <main id="main" className="min-h-screen bg-background px-4">
            <div className="grid min-h-screen place-items-center">
                <Card className="w-full max-w-xl rounded-2xl border bg-card/80 shadow-sm backdrop-blur">
                    <CardHeader className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border">
                                <Clock className="h-5 w-5 text-muted-foreground" aria-hidden />
                            </div>

                            <div className="min-w-0 space-y-5">
                                <div className="flex items-center gap-10">
                                    <Logo className="h-6 w-auto select-none md:h-6" />
                                    <CardTitle className="text-base leading-tight md:text-lg">
                                        {uiText("account.limitedTitle")}
                                    </CardTitle>
                                </div>

                                <CardDescription className="line-clamp-none text-sm leading-relaxed">
                                    {message || uiText("account.limitedFallback")}
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
                            {failed ? (
                                <span className="text-sm text-destructive sm:mr-auto">
                                    {failed}
                                </span>
                            ) : null}
                            <Button variant="outline" disabled={signingOut} onClick={onSignOut}>
                                {signingOut ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                    <LogOut className="mr-2 h-4 w-4" aria-hidden />
                                )}
                                {signingOut ? "Signing out…" : "Sign out"}
                            </Button>
                        </div>
                    </CardHeader>
                </Card>
            </div>
        </main>
    );
}

function Shell() {
    const { user, sessionStatus, limitMessage, refreshProfile, retryBootstrap, setUser } =
        useSession();
    const suspendedAccountId = useSuspendedAccount();

    const [welcomeOpen, setWelcomeOpen] = useState(false);
    useEffect(() => {
        if (sessionStatus === "authenticated" && shouldShowWelcome(user?.email)) {
            setWelcomeOpen(true);
        }
    }, [sessionStatus, user?.email]);

    useEffect(() => {
        const show = () => setWelcomeOpen(true);
        window.addEventListener("s2o:show-welcome", show);
        return () => window.removeEventListener("s2o:show-welcome", show);
    }, []);

    const [connectId] = useState(() => {
        const id =
            connectIdFrom(window.location.search) ??
            (hadSsoReturn() ? takeStashedConnectId() : null);
        if (id) clearConnectId();
        return id;
    });

    if (suspendedAccountId !== null) {
        return <AccountSuspendedScreen accountId={suspendedAccountId} />;
    }

    if (sessionStatus === "booting") {
        return (
            <main id="main" className="min-h-screen grid place-items-center bg-background px-4">
                <LoadingInline />
            </main>
        );
    }

    if (sessionStatus === "unreachable") {
        return <UnreachableScreen onRetry={() => void retryBootstrap()} />;
    }

    if (sessionStatus === "limited") {
        return <LimitedScreen message={limitMessage} />;
    }

    if (connectId) {
        return (
            <Suspense
                fallback={
                    <main id="main" className="grid min-h-screen place-items-center bg-background">
                        <LoadingInline />
                    </main>
                }
            >
                <ConnectModule
                    connectId={connectId}
                    signedIn={sessionStatus === "authenticated" && !!user}
                    userEmail={user?.email ?? undefined}
                    signIn={
                        <Suspense fallback={<LoadingInline />}>
                            <LoginModule
                                onAuthenticated={() => void refreshProfile()}
                                connectId={connectId}
                            />
                        </Suspense>
                    }
                    onSignOut={async () => {
                        const res = await API.logout();
                        if (res?.success === false) {
                            toast.error(res.error?.message || "Sign-out failed.");
                            return;
                        }
                        suppressAutoSso();
                        setUser(null);
                    }}
                />
            </Suspense>
        );
    }

    if (sessionStatus === "authenticated" && user) {
        return (
            <main id="main" className="min-h-screen bg-background">
                <WelcomeDialog
                    open={welcomeOpen}
                    role={user.role}
                    onClose={() => {
                        markWelcomeSeen(user.email);
                        setWelcomeOpen(false);
                    }}
                />
                <Suspense
                    fallback={
                        <div className="grid min-h-screen place-items-center">
                            <LoadingInline />
                        </div>
                    }
                >
                    <NavigationModule />
                </Suspense>
            </main>
        );
    }

    return (
        <main id="main" className="min-h-screen bg-background grid place-items-center px-4">
            <div className="w-full max-w-md">
                <Suspense fallback={<LoadingInline />}>
                    <LoginModule onAuthenticated={() => void refreshProfile()} />
                </Suspense>
            </div>
        </main>
    );
}

export default function App() {
    return (
        <ErrorBoundary
            fallback={(error) =>
                isModuleLoadError(error) ? (
                    <main className="min-h-screen grid place-items-center bg-background px-4">
                        <AppUpdatedScreen />
                    </main>
                ) : (
                    <AppErrorScreen />
                )
            }
        >
            <SessionProvider>
                <a
                    href="#main"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 rounded-lg bg-primary px-3 py-2 text-primary-foreground shadow"
                >
                    Skip to content
                </a>

                <Shell />
                <IndexingAlerts />

                <AppToaster />
            </SessionProvider>
        </ErrorBoundary>
    );
}
