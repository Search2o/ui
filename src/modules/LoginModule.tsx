import { useCallback, useEffect, useRef, useState } from "react";
import * as API from "@/orval/search2o";
import type {
    BaseResponseModel,
    CreatePasswordWithEmailCodeModel,
    LoginResponseModel,
} from "@/orval/search2o.schemas";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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

import { Mail, Lock, AlertCircle, KeyRound, Loader2 } from "lucide-react";
import { PasswordInput } from "@/shared/PasswordInput";
import { PasswordHelpHint } from "@/shared/PasswordHelpHint";
import { useSession } from "@/shared/useSession";
import { signInPlan } from "@/shared/authMethod";
import { autoSsoSuppressed, ssoOutcomeMessage, startSso } from "@/shared/ssoSignIn";
import { errorText } from "@/shared/apiError";
import { Logo } from "@/shared/Logo";
import { uiText } from "@/shared/uiText";

type Props = {
    onAuthenticated?: () => void;
    connectId?: string | null;
};

export default function LoginModule({ onAuthenticated, connectId }: Props) {
    const { accountName, authMethods, sessionExpired } = useSession();
    const plan = signInPlan(authMethods);

    const [ssoNotice, setSsoNotice] = useState<string | null>(() => ssoOutcomeMessage());
    const [redirecting, setRedirecting] = useState(false);

    const beginSso = useCallback(async () => {
        setRedirecting(true);
        setSsoNotice(null);
        const failure = await startSso({ connectId });
        if (failure) {
            setSsoNotice(failure);
            setRedirecting(false);
        }
    }, [connectId]);

    const autoStarted = useRef(false);
    const ssoOnly = plan.sso && !plan.password;
    useEffect(() => {
        if (autoStarted.current || !ssoOnly) return;
        if (ssoNotice || sessionExpired || autoSsoSuppressed()) return;
        autoStarted.current = true;
        void beginSso();
    }, [ssoOnly, ssoNotice, sessionExpired, beginSso]);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [signingIn, setSigningIn] = useState(false);

    const [changePwOpen, setChangePwOpen] = useState(false);
    const [changePwNew, setChangePwNew] = useState("");
    const [changePwLoading, setChangePwLoading] = useState(false);

    const [forgotRequestOpen, setForgotRequestOpen] = useState(false);
    const [verifyOpen, setVerifyOpen] = useState(false);
    const [fpEmail, setFpEmail] = useState("");
    const [fpCode, setFpCode] = useState("");
    const [fpNewPassword, setFpNewPassword] = useState("");

    const finishAuth = useCallback(async () => {
        onAuthenticated?.();
    }, [onAuthenticated]);

    const handleLogin = useCallback(async () => {
        if (signingIn) return;
        setSigningIn(true);
        try {
            const loginModel = { email, password };
            const loginResp: LoginResponseModel = await API.login(loginModel);

            if (!loginResp.success) {
                toast.error(loginResp.error?.message || "Sign-in failed.");
                return;
            }
            if (loginResp.mustChangePassword) {
                setChangePwNew("");
                setChangePwOpen(true);
                return;
            }
            await finishAuth();
        } catch (e) {
            toast.error(errorText(e, "Sign-in failed."));
        } finally {
            setSigningIn(false);
        }
    }, [email, password, finishAuth, signingIn]);

    const openForgotRequest = useCallback(() => {
        setForgotRequestOpen(true);
        setVerifyOpen(false);
        setFpEmail(email || "");
        setFpCode("");
        setFpNewPassword("");
    }, [email]);

    const sendEmailCode = useCallback(async () => {
        const emailCodeModel = { email: fpEmail };
        const resp: BaseResponseModel = await API.emailCode(emailCodeModel);

        if (!resp.success) {
            toast.error(resp.error?.message || "Could not send code");
            return;
        }
        setForgotRequestOpen(false);
        setVerifyOpen(true);
    }, [fpEmail]);

    const createPasswordWithCode = useCallback(async () => {
        const createPasswordModel: CreatePasswordWithEmailCodeModel = {
            email: fpEmail,
            code: fpCode,
            newPassword: fpNewPassword,
        };
        const resp: BaseResponseModel = await API.createPasswordWithEmailCode(createPasswordModel);

        if (!resp?.success) {
            toast.error(resp?.error?.message || "Update failed");
            return;
        }

        toast.success("Password set.");
        const loginModel = { email: fpEmail, password: fpNewPassword };
        const loginResp: LoginResponseModel = await API.login(loginModel);

        if (!loginResp?.success) {
            toast.error(loginResp?.error?.message || "Automatic sign-in failed.");
            return;
        }

        await finishAuth();
        setVerifyOpen(false);
        setEmail(fpEmail);
        setPassword(fpNewPassword);
    }, [fpEmail, fpCode, fpNewPassword, finishAuth]);

    const submitChangePw = useCallback(async () => {
        if (!changePwNew) {
            toast.error("Please enter a new password");
            return;
        }
        try {
            setChangePwLoading(true);
            const resp: BaseResponseModel = await API.changePassword({
                currentPassword: password,
                newPassword: changePwNew,
            });
            if (resp?.success) {
                setChangePwOpen(false);
                await finishAuth();
            } else {
                toast.error(resp?.error?.message || "Could not update password");
            }
        } finally {
            setChangePwLoading(false);
        }
    }, [password, changePwNew, finishAuth]);

    const dialogBrandRow = (
        <DialogTitle className="flex items-center justify-between gap-3 pr-10">
            <Logo className="h-6 w-auto select-none" />
            <span className="ml-auto truncate text-right text-xs font-semibold tracking-wide text-muted-foreground">
                {accountName}
            </span>
        </DialogTitle>
    );

    return (
        <div className="w-full">
            <Card className="border shadow-sm bg-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Logo className="h-6 md:h-6 w-auto select-none" />
                        <span className="ml-auto text-right text-xs font-semibold tracking-wide text-muted-foreground">
                            {accountName}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!plan.password && !plan.sso ? (
                        <p className="text-sm text-muted-foreground">
                            This account signs in another way, which this version of the app does
                            not support yet.
                        </p>
                    ) : (
                        <>
                            {sessionExpired ? (
                                <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Session expired</AlertTitle>
                                </Alert>
                            ) : null}
                            {ssoNotice ? (
                                <Alert variant="destructive" className="mb-4">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle className="line-clamp-none font-normal">
                                        {ssoNotice}
                                    </AlertTitle>
                                </Alert>
                            ) : null}
                            {plan.sso ? (
                                <Button
                                    type="button"
                                    className="w-full gap-2"
                                    onClick={() => void beginSso()}
                                    disabled={redirecting}
                                >
                                    {redirecting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <KeyRound className="h-4 w-4" />
                                    )}
                                    {redirecting
                                        ? "Taking you to single sign-on…"
                                        : "Sign in with single sign-on"}
                                </Button>
                            ) : null}
                            {plan.sso && plan.password ? (
                                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                                    <div className="h-px flex-1 bg-border" />
                                    or
                                    <div className="h-px flex-1 bg-border" />
                                </div>
                            ) : null}
                            {plan.password ? (
                                <form
                                    className="space-y-4"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void handleLogin();
                                    }}
                                >
                                    <div className="grid gap-2">
                                        <Label htmlFor="email" className="flex items-center gap-2">
                                            <Mail className="h-4 w-4" />
                                            Email
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="you@company.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            autoComplete="username"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label
                                            htmlFor="password"
                                            className="flex items-center gap-2"
                                        >
                                            <Lock className="h-4 w-4" />
                                            Password
                                        </Label>
                                        <PasswordInput
                                            id="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            autoComplete="current-password"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <Button
                                            type="submit"
                                            className="min-w-28 gap-2"
                                            variant="outline"
                                            disabled={signingIn}
                                        >
                                            {signingIn ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : null}
                                            {signingIn ? "Signing in…" : "Sign in"}
                                        </Button>

                                        <button
                                            type="button"
                                            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                                            onClick={openForgotRequest}
                                        >
                                            New user / Forgot password
                                        </button>
                                    </div>
                                </form>
                            ) : null}
                            {plan.unsupported.length > 0 ? (
                                <p className="mt-4 text-xs text-muted-foreground">
                                    One of this account's sign-in methods is not supported by this
                                    version of the app.
                                </p>
                            ) : null}
                        </>
                    )}
                </CardContent>
            </Card>

            <Dialog open={forgotRequestOpen} onOpenChange={setForgotRequestOpen}>
                <DialogContent
                    onInteractOutside={(e) => e.preventDefault()}
                    className="sm:max-w-md"
                >
                    <DialogHeader>
                        {dialogBrandRow}
                        <DialogDescription>
                            Enter your email and we will send you a verification code. Use this
                            whether you are setting your first password or replacing one you have
                            forgotten.
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void sendEmailCode();
                        }}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="fp-email" className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Email
                            </Label>
                            <Input
                                id="fp-email"
                                type="email"
                                placeholder="you@company.com"
                                value={fpEmail}
                                onChange={(e) => setFpEmail(e.target.value)}
                            />
                        </div>

                        <Button type="submit" className="w-full">
                            Send code
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
                <DialogContent
                    onInteractOutside={(e) => e.preventDefault()}
                    className="sm:max-w-md"
                >
                    <DialogHeader>
                        {dialogBrandRow}
                        <DialogDescription>{uiText("signIn.codeSent.body")}</DialogDescription>
                        <p className="text-xs text-muted-foreground">
                            {uiText("signIn.codeSent.onlyIfKnown")}
                        </p>
                    </DialogHeader>
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void createPasswordWithCode();
                        }}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="fp-email-ro">Email</Label>
                            <Input
                                id="fp-email-ro"
                                type="email"
                                placeholder="you@company.com"
                                value={fpEmail}
                                onChange={(e) => setFpEmail(e.target.value)}
                                readOnly
                                disabled
                                autoComplete="username"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="fp-code">Code</Label>
                            <Input
                                id="fp-code"
                                placeholder="Verification code"
                                value={fpCode}
                                onChange={(e) => setFpCode(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="fp-new-pw">New password</Label>
                            <PasswordInput
                                id="fp-new-pw"
                                placeholder="New password"
                                value={fpNewPassword}
                                onChange={(e) => setFpNewPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                            <PasswordHelpHint />
                        </div>

                        <Button type="submit" className="w-full">
                            Set password
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={changePwOpen} onOpenChange={setChangePwOpen}>
                <AlertDialogContent className="sm:max-w-[480px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center justify-between gap-3">
                            <Logo className="h-6 md:h-6 w-auto select-none" />
                            <span className="ml-auto text-right text-xs font-semibold tracking-wide text-muted-foreground">
                                {accountName}
                            </span>
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 pt-1">
                                <p className="text-sm text-muted-foreground">
                                    Update your password
                                </p>
                                <div className="grid gap-2">
                                    <Label htmlFor="new-password">New password</Label>
                                    <PasswordInput
                                        id="new-password"
                                        placeholder="New password"
                                        value={changePwNew}
                                        onChange={(e) => setChangePwNew(e.target.value)}
                                        autoComplete="new-password"
                                    />
                                    <PasswordHelpHint />
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={changePwLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                void submitChangePw();
                            }}
                            disabled={changePwLoading || !changePwNew}
                        >
                            {changePwLoading ? "Updating…" : "Update"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
