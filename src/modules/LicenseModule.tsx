import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { HoverTip } from "@/shared/HoverTip";
import * as API from "@/orval/search2o";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Copy, Key, Loader2, RefreshCw, Save, Snowflake } from "lucide-react";
import type { GetLicenseResponseModel, FrozenInfoResponseModel } from "@/orval/search2o.schemas";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import { rotationRefusal, rotationSummary } from "@/shared/encryptionRotation";
import { fmtLocalShort } from "@/shared/commonFuncs";

const freezeText = () => uiText("help.freeze");

function nowForDatetimeLocal(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 15);
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function LicenseModule() {
    const [model, setModel] = useState<GetLicenseResponseModel | null>(null);
    const [loading, setLoading] = useState(true);
    const [reloading, setReloading] = useState(false);

    const [newLicensePlain, setNewLicensePlain] = useState<string | null>(null);

    const [expireAtLocal, setExpireAtLocal] = useState(() => nowForDatetimeLocal());
    const [confirmOpen, setConfirmOpen] = useState(false);
    const rotatingRef = useRef(false);
    const minExpireAt = useMemo(() => nowForDatetimeLocal(), []);

    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

    const [freezeLoading, setFreezeLoading] = useState(true);
    const [freezeBusy, setFreezeBusy] = useState(false);
    const [frozenState, setFrozenState] = useState<FrozenInfoResponseModel | null>(null);

    const [keyRotationConfirmOpen, setKeyRotationConfirmOpen] = useState(false);
    const [keyRotationBusy, setKeyRotationBusy] = useState(false);
    const [keyRotationSummary, setKeyRotationSummary] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const licenseRes = await API.getLicenseInfo({});

            setModel(licenseRes);
            if (licenseRes && licenseRes.success === false) {
                toast.error(licenseRes.error?.message ?? "Failed to load license info");
            }
        } catch (err) {
            toast.error(errorText(err, "Failed to load license info"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const reload = async () => {
        setReloading(true);
        await load();
        setReloading(false);
    };

    const loadFrozenInfo = useCallback(async () => {
        setFreezeLoading(true);
        try {
            const res = await API.getFrozenInfo({});
            if (!res.success) {
                toast.error(res.error?.message ?? "Failed to fetch frozen state");
                setFrozenState(null);
            } else {
                setFrozenState({
                    isFrozen: !!res.isFrozen,
                    frozenBy: res.frozenBy ?? null,
                    frozenAt: res.frozenAt ?? null,
                });
            }
        } catch (err) {
            toast.error(errorText(err, "Failed to fetch frozen state"));
            setFrozenState(null);
        } finally {
            setFreezeLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadFrozenInfo();
    }, [loadFrozenInfo]);

    const onFreeze = async () => {
        setFreezeBusy(true);
        try {
            const res = await API.freeze({});
            if (!res.success) {
                toast.error(res.error?.message ?? "Freeze failed");
                return;
            }
            await loadFrozenInfo();
        } catch (err) {
            toast.error(errorText(err, "Freeze failed"));
        } finally {
            setFreezeBusy(false);
        }
    };

    const onUnfreeze = async () => {
        setFreezeBusy(true);
        try {
            const res = await API.unfreeze({});
            if (!res.success) {
                toast.error(res.error?.message ?? "Unfreeze failed");
                return;
            }
            await loadFrozenInfo();
        } catch (err) {
            toast.error(errorText(err, "Unfreeze failed"));
        } finally {
            setFreezeBusy(false);
        }
    };

    const onRotateEncryptionKey = async () => {
        if (keyRotationBusy) return;
        setKeyRotationBusy(true);
        try {
            const res = await API.rotateEncryptionKey({});

            if (!res.success) {
                toast.error(
                    rotationRefusal(
                        res.error?.message,
                        res.nextRotationAllowedAt,
                        "The encryption key could not be rotated.",
                    ),
                );
                return;
            }

            setKeyRotationSummary(
                rotationSummary(res.rotatedAt, res.nextRotationAllowedAt) ??
                    uiText("encryption.rotate.done"),
            );
            toast.success(uiText("encryption.rotate.done"));
            setKeyRotationConfirmOpen(false);
        } catch (err) {
            toast.error(errorText(err, "The encryption key could not be rotated."));
        } finally {
            setKeyRotationBusy(false);
        }
    };

    const frozenAtLocal = useMemo(() => {
        if (!frozenState?.frozenAt) return null;
        try {
            const d = new Date(frozenState.frozenAt);
            return isNaN(d.getTime()) ? frozenState.frozenAt : fmtLocalShort(d);
        } catch {
            return frozenState.frozenAt;
        }
    }, [frozenState?.frozenAt]);

    const onConfirmCancelRotate = async () => {
        try {
            const res = await API.cancelRotateLicense({});

            if (res && res.success === true) {
                setNewLicensePlain(null);
                toast.success("License rotation has been cancelled");
                await reload();
            } else {
                toast.error(res?.error?.message ?? "Failed to cancel license rotation");
            }
        } catch (err) {
            toast.error(errorText(err, "Failed to cancel license rotation"));
        } finally {
            setCancelConfirmOpen(false);
        }
    };

    const onConfirmRotate = async () => {
        if (rotatingRef.current) return;
        rotatingRef.current = true;

        try {
            const ms = expireAtLocal ? new Date(expireAtLocal).getTime() : NaN;
            if (!ms || Number.isNaN(ms)) {
                toast.error(uiText("validate.expiryDate"));
                return;
            }

            const res = await API.rotateLicense({ oldLicenseExpiry: ms });

            if (!res || res.success === false) {
                toast.error(res?.error?.message ?? "Failed to rotate license");
                return;
            }

            if (res.license) {
                setNewLicensePlain(res.license);
            }

            await reload();
            setConfirmOpen(false);
        } catch (err) {
            toast.error(errorText(err, "Failed to rotate license"));
        } finally {
            rotatingRef.current = false;
        }
    };

    const handleCopyNewLicense = async () => {
        if (!newLicensePlain) return;
        try {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
                await navigator.clipboard.writeText(newLicensePlain);
                toast.success("New license key copied to clipboard");
            } else {
                throw new Error("Clipboard not available");
            }
        } catch {
            toast.error("Could not copy license key. Please copy it manually.");
        }
    };

    const currentKey: string | undefined = model?.license;
    const oldKey: string | undefined = model?.oldLicense as string | undefined;
    const oldExpiryMs: number | undefined = model?.oldLicenseExpiry as number | undefined;

    const oldExpiryLocal = useMemo(() => {
        if (!oldExpiryMs) return "";
        try {
            return fmtLocalShort(oldExpiryMs);
        } catch {
            return "";
        }
    }, [oldExpiryMs]);

    const licenseCreatedAtLocal = useMemo(() => {
        const ms = model?.licenseCreatedAt;
        if (!ms) return "";
        try {
            return fmtLocalShort(ms);
        } catch {
            return "";
        }
    }, [model]);

    const oldLicenseCreatedAtLocal = useMemo(() => {
        const ms = model?.oldLicenseCreatedAt;
        if (!ms) return "";
        try {
            return fmtLocalShort(ms);
        } catch {
            return "";
        }
    }, [model]);

    const licenseCreatedByName = model?.licenseCreatedByName;
    const licenseCreatedByEmail = model?.licenseCreatedByEmail;
    const oldLicenseCreatedByName = model?.oldLicenseCreatedByName;
    const oldLicenseCreatedByEmail = model?.oldLicenseCreatedByEmail;

    return (
        <div className="w-full space-y-6">
            <Card className="shadow-sm">
                <CardHeader>
                    <div className="text-sm font-semibold">License key rotation</div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading license information…</span>
                        </div>
                    ) : (
                        <>
                            {newLicensePlain && (
                                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                                                New license key
                                            </div>
                                            <div className="mt-1 break-all font-mono text-sm">
                                                {newLicensePlain}
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={handleCopyNewLicense}
                                            aria-label="Copy new license key"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="mt-2 text-xs text-amber-800">
                                        This will be the only time this license key will be shown.
                                        Copy it to a safe place.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-sm">
                                    {model?.license && model?.oldLicense
                                        ? "New license key"
                                        : "Current license key"}
                                </Label>
                                <div className="break-all font-mono text-sm">
                                    {currentKey ?? "—"}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {licenseCreatedByName ? (
                                        <>
                                            <span>Created by </span>
                                            <HoverTip tip={licenseCreatedByEmail ?? undefined}>
                                                <span className="font-medium underline-offset-2 decoration-dotted hover:underline">
                                                    {licenseCreatedByName}
                                                </span>
                                            </HoverTip>
                                            {licenseCreatedAtLocal && (
                                                <>
                                                    <span> on </span>
                                                    <span>{licenseCreatedAtLocal}</span>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <span>Created by —</span>
                                    )}
                                </div>
                            </div>

                            {oldKey && oldExpiryMs ? (
                                <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm">Current license key</Label>
                                        <div className="break-all font-mono text-sm">{oldKey}</div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            {oldLicenseCreatedByName ? (
                                                <>
                                                    <span>Created by </span>
                                                    <HoverTip
                                                        tip={oldLicenseCreatedByEmail ?? undefined}
                                                    >
                                                        <span className="font-medium underline-offset-2 decoration-dotted hover:underline">
                                                            {oldLicenseCreatedByName}
                                                        </span>
                                                    </HoverTip>
                                                    {oldLicenseCreatedAtLocal && (
                                                        <>
                                                            <span> on </span>
                                                            <span>{oldLicenseCreatedAtLocal}</span>
                                                        </>
                                                    )}
                                                </>
                                            ) : (
                                                <span>Created by —</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-sm">Expires at</Label>
                                        <div className="text-sm text-muted-foreground">
                                            {oldExpiryLocal || "—"}
                                        </div>
                                    </div>

                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        Both license keys are valid until{" "}
                                        <span>{oldExpiryLocal || "—"}</span>. You must restart your
                                        Search2o servers with the new license key before this time.
                                    </p>

                                    <AlertDialog
                                        open={cancelConfirmOpen}
                                        onOpenChange={setCancelConfirmOpen}
                                    >
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="mt-2"
                                            >
                                                Cancel license rotation
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                    Cancel license rotation?
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will cancel the license key rotation. The
                                                    new license key will be removed and the current
                                                    license key will not expire. If you already
                                                    started servers with the new license key, they
                                                    will stop functioning immediately. Do you want
                                                    to continue?
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>No</AlertDialogCancel>
                                                <AlertDialogAction onClick={onConfirmCancelRotate}>
                                                    Yes, cancel rotation
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ) : (
                                <div className="space-y-4 rounded-2xl border bg-muted/30 p-4">
                                    <div>
                                        <div className="mb-1 font-medium">Rotate license</div>
                                        <p className="text-sm text-muted-foreground">
                                            Select the date and time at which the current license
                                            will expire. Until this time, both the current license
                                            and the new license will be valid. You must restart all
                                            your servers with the new license before this time.
                                        </p>
                                    </div>

                                    <Separator />

                                    <div className="grid max-w-sm gap-2">
                                        <Label htmlFor="expireAtLocal">
                                            Expire current license key at
                                        </Label>
                                        <Input
                                            id="expireAtLocal"
                                            type="datetime-local"
                                            value={expireAtLocal}
                                            onChange={(e) => setExpireAtLocal(e.target.value)}
                                            min={minExpireAt}
                                        />
                                    </div>

                                    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                className="mt-2"
                                                disabled={!expireAtLocal || loading || reloading}
                                                variant="outline"
                                            >
                                                <Key className="h-4 w-4" />
                                                Change license key
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>
                                                    Confirm license rotation
                                                </AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will set the expiration for the current
                                                    license to{" "}
                                                    <strong>
                                                        {expireAtLocal
                                                            ? fmtLocalShort(expireAtLocal)
                                                            : "the selected time"}
                                                    </strong>{" "}
                                                    (local time). Do you want to proceed?
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={onConfirmRotate}>
                                                    Confirm
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader>
                    <div className="text-sm font-semibold">Encryption key rotation</div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {keyRotationSummary ?? uiText("encryption.rotate.cadence")}
                    </p>
                </CardContent>
                <CardFooter className="flex justify-end gap-3">
                    <AlertDialog
                        open={keyRotationConfirmOpen}
                        onOpenChange={setKeyRotationConfirmOpen}
                    >
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" disabled={keyRotationBusy}>
                                <RefreshCw className="h-4 w-4" />
                                Rotate encryption key
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {uiText("encryption.rotate.title")}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="space-y-2">
                                    <span className="block">
                                        {uiText("encryption.rotate.body")}
                                    </span>
                                    <span className="block">
                                        {uiText("encryption.rotate.restartNote")}
                                    </span>
                                    <span className="block font-medium text-foreground">
                                        {uiText("encryption.rotate.cadence")}
                                    </span>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={keyRotationBusy}>
                                    Keep the current key
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    variant="destructive"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        void onRotateEncryptionKey();
                                    }}
                                    disabled={keyRotationBusy}
                                >
                                    {keyRotationBusy ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Rotating…
                                        </>
                                    ) : (
                                        "Rotate the key"
                                    )}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
            </Card>

            <Card className="shadow-sm">
                <CardHeader>
                    <div className="text-sm font-semibold">Freeze system</div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {freezeLoading ? (
                        <div className="h-20 animate-pulse rounded-xl bg-muted" />
                    ) : !frozenState ? (
                        <div className="text-sm text-muted-foreground">
                            Unable to load current freeze state.
                        </div>
                    ) : frozenState.isFrozen ? (
                        <p className="text-sm">
                            This system has been frozen by{" "}
                            <span className="font-medium">{frozenState.frozenBy ?? "unknown"}</span>{" "}
                            at{" "}
                            <span className="font-medium">{frozenAtLocal ?? "unknown time"}</span>
                        </p>
                    ) : (
                        <div className="text-sm">{freezeText()}</div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-end gap-3">
                    {!freezeLoading &&
                        frozenState &&
                        (frozenState.isFrozen ? (
                            <Button variant="outline" onClick={onUnfreeze} disabled={freezeBusy}>
                                <Save className="h-4 w-4" />
                                {freezeBusy ? "Unfreezing..." : "Unfreeze"}
                            </Button>
                        ) : (
                            <Button variant="outline" onClick={onFreeze} disabled={freezeBusy}>
                                <Snowflake className="h-4 w-4" />
                                {freezeBusy ? "Freezing..." : "Freeze"}
                            </Button>
                        ))}
                </CardFooter>
            </Card>
        </div>
    );
}
