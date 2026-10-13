import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tryReloadForNewVersion } from "@/shared/appUpdated";

export function PageErrorScreen({ onRetry }: { onRetry: () => void }) {
    return (
        <Card className="w-full shadow-sm">
            <CardHeader>
                <div className="flex items-start gap-3">
                    <AlertTriangle
                        className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                        aria-hidden
                    />
                    <div className="min-w-0 space-y-1">
                        <CardTitle className="text-base">
                            This page could not be displayed
                        </CardTitle>
                        <CardDescription>
                            Something in this page failed to render. The rest of the app is
                            unaffected — you can try again, or pick another page from the menu.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button variant="outline" onClick={onRetry}>
                    <RefreshCcw className="h-4 w-4" aria-hidden />
                    Try again
                </Button>
            </CardContent>
        </Card>
    );
}

export function AppUpdatedScreen() {
    const [reloading, setReloading] = useState(false);

    useEffect(() => {
        setReloading(tryReloadForNewVersion());
    }, []);

    return (
        <Card className="w-full max-w-xl shadow-sm">
            <CardHeader>
                <div className="flex items-start gap-3">
                    <RefreshCcw
                        className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                        aria-hidden
                    />
                    <div className="min-w-0 space-y-1">
                        <CardTitle className="text-base">Search2o has been updated</CardTitle>
                        <CardDescription>
                            A new version was released while this tab was open, so part of the app
                            could no longer be loaded. Reloading picks up the new version; nothing
                            has been lost.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Button onClick={() => window.location.reload()} disabled={reloading}>
                    <RefreshCcw className="h-4 w-4" aria-hidden />
                    {reloading ? "Reloading…" : "Reload"}
                </Button>
            </CardContent>
        </Card>
    );
}

export function AppErrorScreen() {
    return (
        <main className="min-h-screen grid place-items-center bg-background px-4">
            <Card className="w-full max-w-xl shadow-sm">
                <CardHeader>
                    <div className="flex items-start gap-3">
                        <AlertTriangle
                            className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                            aria-hidden
                        />
                        <div className="min-w-0 space-y-1">
                            <CardTitle className="text-base">Something went wrong</CardTitle>
                            <CardDescription>
                                Search2o hit an unexpected error and could not continue. Reloading
                                usually clears it.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={() => window.location.reload()}>
                        <RefreshCcw className="h-4 w-4" aria-hidden />
                        Reload
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}
