import { useCallback, useEffect, useRef, useState } from "react";
import * as API from "@/orval/search2o";
import type { IntegrationTokenModel } from "@/orval/search2o.schemas";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { localDatetime } from "@/shared/commonFuncs";
import { errorText } from "@/shared/apiError";
import { AlertTriangle, Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { uiText } from "@/shared/uiText";
import { expiryDays } from "@/shared/tokenExpiry";

const maxTokens = () => Number(uiText("tokens.maxPerAccount")) || 10;

const MAX_NAME = 80;

function TokenRow({
    token,
    onRevoke,
}: {
    token: IntegrationTokenModel;
    onRevoke: (token: IntegrationTokenModel) => void;
}) {
    return (
        <tr>
            <td className="py-2 pr-4">
                {token.name || <span className="text-muted-foreground">Unnamed</span>}
            </td>
            <td className="py-2 pr-4 text-muted-foreground">
                {token.createdAt ? localDatetime(token.createdAt) : "—"}
            </td>
            <td className="py-2 pr-4 text-muted-foreground">
                {token.lastUsedAt ? localDatetime(token.lastUsedAt) : "Never used"}
            </td>
            <td className="py-2 pr-4 text-muted-foreground">
                {token.expiresAt ? localDatetime(token.expiresAt) : "Never expires"}
            </td>
            <td className="py-2 text-right">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Revoke ${token.name || "this token"}`}
                    onClick={() => onRevoke(token)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </td>
        </tr>
    );
}

export function IntegrationTokens({ maxAgeDays }: { maxAgeDays: number | null | undefined }) {
    const [tokens, setTokens] = useState<IntegrationTokenModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [daysText, setDaysText] = useState("");
    const daysTouched = useRef(false);
    useEffect(() => {
        if (!daysTouched.current && maxAgeDays !== undefined) {
            setDaysText(maxAgeDays && maxAgeDays > 0 ? String(maxAgeDays) : "");
        }
    }, [maxAgeDays]);
    const limit = maxAgeDays && maxAgeDays > 0 ? maxAgeDays : null;
    const expiry = expiryDays(daysText, limit);
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState<{ id: string; name: string; token: string } | null>(
        null,
    );
    const [copied, setCopied] = useState(false);
    const [revoking, setRevoking] = useState<IntegrationTokenModel | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await API.getIntegrationTokens({});
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to load your integration tokens.");
                return;
            }
            setTokens(resp.tokens ?? []);
        } catch (e) {
            toast.error(errorText(e, "Failed to load your integration tokens."));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const create = async () => {
        const trimmed = name.trim();
        if (!trimmed || creating || !expiry.ok) return;
        setCreating(true);
        try {
            const resp = await API.createIntegrationToken({
                name: trimmed,
                ...(expiry.days !== undefined ? { expiresInDays: expiry.days } : {}),
            });
            if (!resp.success || !resp.token) {
                toast.error(resp.error?.message ?? "The token could not be created.");
                return;
            }
            setCreated({ id: resp.tokenId ?? "", name: trimmed, token: resp.token });
            setCopied(false);
            setName("");
            daysTouched.current = false;
            setDaysText(limit ? String(limit) : "");
            await load();
        } catch (e) {
            toast.error(errorText(e, "The token could not be created."));
        } finally {
            setCreating(false);
        }
    };

    const revoke = async (token: IntegrationTokenModel) => {
        setRevoking(null);
        try {
            const resp = await API.revokeIntegrationToken({ tokenId: token.tokenId });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "The token could not be revoked.");
                return;
            }
            setCreated((shown) => (shown && shown.id === token.tokenId ? null : shown));
            toast.success(`${token.name || "The token"} can no longer be used.`);
            await load();
        } catch (e) {
            toast.error(errorText(e, "The token could not be revoked."));
        }
    };

    const copy = async () => {
        if (!created) return;
        try {
            await navigator.clipboard.writeText(created.token);
            setCopied(true);
        } catch {
            toast.error(uiText("tokens.copyBlocked"));
        }
    };

    const atLimit = tokens.length >= maxTokens();

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" aria-hidden />
                    Integrations
                </CardTitle>
            </CardHeader>

            <CardContent className="grid gap-5">
                {created ? (
                    <Alert>
                        <AlertTitle>Copy this token now — it will not be shown again</AlertTitle>
                        <AlertDescription className="grid gap-3">
                            <code className="block break-all rounded-md bg-surface px-3 py-2 font-mono text-xs">
                                {created.token}
                            </code>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" size="sm" onClick={() => void copy()}>
                                    {copied ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                    {copied ? "Copied" : "Copy token"}
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setCreated(null)}
                                >
                                    Done
                                </Button>
                            </div>
                            <p className="flex items-start gap-2 text-xs text-muted-foreground">
                                <AlertTriangle
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                    aria-hidden
                                />
                                {uiText("tokens.storageWarning")}
                            </p>
                        </AlertDescription>
                    </Alert>
                ) : null}

                <div className="grid gap-2 sm:max-w-xl">
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="grid min-w-48 flex-1 gap-2">
                            <Label htmlFor="integration-token-name">New token name</Label>
                            <Input
                                id="integration-token-name"
                                value={name}
                                maxLength={MAX_NAME}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Slack"
                                disabled={creating || atLimit}
                            />
                        </div>
                        <div className="grid w-56 gap-2">
                            <Label htmlFor="integration-token-days">
                                {limit ? `Expires in (up to ${limit} days)` : "Expires in (days)"}
                            </Label>
                            <Input
                                id="integration-token-days"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={limit ?? undefined}
                                value={daysText}
                                onChange={(e) => {
                                    daysTouched.current = true;
                                    setDaysText(e.target.value);
                                }}
                                placeholder={limit ? String(limit) : "Never"}
                                aria-invalid={expiry.ok ? undefined : true}
                                aria-describedby={
                                    expiry.ok ? undefined : "integration-token-days-error"
                                }
                                disabled={creating || atLimit}
                            />
                        </div>
                        <Button
                            type="button"
                            className="shrink-0 gap-2"
                            onClick={() => void create()}
                            disabled={creating || atLimit || !name.trim() || !expiry.ok}
                        >
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Create
                        </Button>
                    </div>
                    {!expiry.ok ? (
                        <p id="integration-token-days-error" className="text-sm text-destructive">
                            {expiry.reason}
                        </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                        A token can search, run agents and manage your own conversations. Nothing
                        administrative, whatever your role.
                    </p>
                </div>

                <div className="grid gap-2">
                    <p className="text-xs text-muted-foreground">
                        {tokens.length} of {maxTokens()} tokens used
                    </p>

                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading your tokens…</span>
                        </div>
                    ) : tokens.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{uiText("tokens.empty")}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-xs text-muted-foreground">
                                        <th className="py-2 pr-4 font-medium">Name</th>
                                        <th className="py-2 pr-4 font-medium">Created</th>
                                        <th className="py-2 pr-4 font-medium">Last used</th>
                                        <th className="py-2 pr-4 font-medium">Expires</th>
                                        <th className="py-2" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {tokens.map((token) => (
                                        <TokenRow
                                            key={token.tokenId}
                                            token={token}
                                            onRevoke={setRevoking}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </CardContent>

            <AlertDialog open={!!revoking} onOpenChange={(open) => !open && setRevoking(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Revoke {revoking?.name ? `“${revoking.name}”` : "this token"}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            That token stops working immediately. Nothing else changes — your other
                            integrations keep working, and you stay signed in here.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={() => revoking && void revoke(revoking)}>
                            Revoke
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
