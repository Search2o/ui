import { Card, CardHeader } from "@/components/ui/card";
import { Info } from "lucide-react";
import { useUiText, uiText } from "@/shared/uiText";

export function AccountSuspendedScreen({ accountId }: { accountId: string }) {
    const t = useUiText();
    return (
        <main id="main" className="grid min-h-screen place-items-center bg-background px-4">
            <div className="w-full max-w-lg">
                <Card>
                    <CardHeader className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-muted-foreground" aria-hidden />
                            <h1 className="text-lg font-semibold">{t("account.suspendedTitle")}</h1>
                        </div>

                        <p className="text-sm">
                            {accountId ? (
                                <>
                                    Account ID{" "}
                                    <span className="font-mono font-semibold select-all">
                                        {accountId}
                                    </span>{" "}
                                    has been suspended immediately.
                                </>
                            ) : (
                                <>{uiText("account.suspendedLead")}</>
                            )}{" "}
                            {t("account.suspendedBody")}
                        </p>
                    </CardHeader>
                </Card>
            </div>
        </main>
    );
}
