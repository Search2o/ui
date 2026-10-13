import { useCallback, useEffect, useState } from "react";
import * as API from "@/orval/search2o";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { connectRequestIsLive } from "@/shared/connectRequest";
import { errorText } from "@/shared/apiError";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Logo } from "@/shared/Logo";
import { uiText } from "@/shared/uiText";

type Request = { clientName: string; userCode: string; expiresIn: number };

function Frame({ children }: { children: React.ReactNode }) {
    return (
        <main id="main" className="min-h-screen bg-background px-4">
            <div className="grid min-h-screen place-items-center">
                <Card className="w-full max-w-lg shadow-sm">{children}</Card>
            </div>
        </main>
    );
}

function Ending({ title, detail }: { title: string; detail: string }) {
    return (
        <Frame>
            <CardHeader className="items-center gap-3 text-center">
                <Logo className="h-6 w-auto" />
                <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="pb-8 text-center text-sm text-muted-foreground">
                {detail}
            </CardContent>
        </Frame>
    );
}

export default function ConnectModule({
    connectId,
    userEmail,
    signedIn,
    signIn,
    onSignOut,
}: {
    connectId: string;
    userEmail?: string;
    signedIn: boolean;
    signIn: React.ReactNode;
    onSignOut: () => void | Promise<void>;
}) {
    const [request, setRequest] = useState<Request | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<"approved" | "rejected" | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await API.getConnectRequest({ connectId });
            if (!resp.success) {
                setError(resp.error?.message ?? "This connection request could not be read.");
                return;
            }
            setRequest({
                clientName: resp.clientName ?? "",
                userCode: resp.userCode ?? "",
                expiresIn: resp.expiresIn ?? 0,
            });
        } catch (e) {
            setError(errorText(e, "This connection request could not be read."));
        } finally {
            setLoading(false);
        }
    }, [connectId]);

    useEffect(() => {
        void load();
    }, [load]);

    const decide = async (approve: boolean) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const resp = await API.approveConnect({ connectId, approve });
            if (!resp.success) {
                setError(resp.error?.message ?? "This connection request could not be completed.");
                return;
            }
            setDone(approve ? "approved" : "rejected");
        } catch (e) {
            setError(errorText(e, "This connection request could not be completed."));
        } finally {
            setBusy(false);
        }
    };

    if (done === "approved") {
        return <Ending title="Connected" detail={uiText("connect.approved")} />;
    }
    if (done === "rejected") {
        return <Ending title="Request rejected" detail={uiText("connect.rejected")} />;
    }

    if (loading) {
        return (
            <Frame>
                <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    <span className="text-sm">Loading the request…</span>
                </CardContent>
            </Frame>
        );
    }

    if (!request || !connectRequestIsLive(request.clientName)) {
        return (
            <Ending title="This request is no longer valid" detail={uiText("connect.expired")} />
        );
    }

    return (
        <Frame>
            <CardHeader className="gap-4">
                <Logo className="h-6 w-auto" />
                <CardTitle className="text-lg leading-snug">
                    <span className="font-semibold">{request.clientName}</span> wants to connect to
                    your Search2o account
                </CardTitle>
            </CardHeader>

            <CardContent className="grid gap-6">
                <div className="grid gap-2 rounded-xl border bg-surface px-4 py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        Check this matches the code shown where you started
                    </p>
                    <p className="font-mono text-3xl font-semibold tracking-[0.3em]">
                        {request.userCode}
                    </p>
                </div>

                <p className="text-sm text-muted-foreground">
                    It will be able to search, run agents and manage your own conversations, as you.
                    It cannot do anything administrative, whatever your role.
                </p>

                {error ? (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="line-clamp-none">{error}</AlertTitle>
                    </Alert>
                ) : null}

                {signedIn ? (
                    <>
                        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span>
                                Approving as <span className="font-medium">{userEmail}</span>
                            </span>
                            <button
                                type="button"
                                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                onClick={() => void onSignOut()}
                                disabled={busy}
                            >
                                Not you? Sign out
                            </button>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                className="gap-2"
                                onClick={() => void decide(true)}
                                disabled={busy}
                            >
                                {busy ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4" />
                                )}
                                Approve
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void decide(false)}
                                disabled={busy}
                            >
                                Reject
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="border-t pt-5">
                        <p className="mb-4 text-sm text-muted-foreground">
                            {uiText("connect.signInPrompt")}
                        </p>
                        {signIn}
                    </div>
                )}
            </CardContent>
        </Frame>
    );
}
