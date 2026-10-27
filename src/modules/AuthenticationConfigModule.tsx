import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import * as API from "@/orval/search2o";
import type {
    AuthModel,
    BuiltinAuthModel,
    ConfigPartResponseModel,
    CookieModel,
    CookieModelSamesite,
    EmailFormat,
    OidcAuthModel,
    PasswordModel,
} from "@/orval/search2o.schemas";
import { SsoProvisioning } from "@/orval/search2o.schemas";
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
import { FieldLabel } from "@/shared/FieldLabel";
import { HoverTip } from "@/shared/HoverTip";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import { MAX_LENGTHS } from "@/shared/schemaRules";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ActionBar } from "@/shared/ActionBar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { invalidatePasswordHelp } from "@/shared/passwordHelp";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";
import { ChevronRight } from "lucide-react";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { UpdatedBy } from "@/shared/UpdatedBy";
import { errorText } from "@/shared/apiError";
import { uiText } from "@/shared/uiText";
import { offersSingleSignOn } from "@/shared/serviceLevel";
import { useSession } from "@/shared/useSession";

const EMPTY_EMAIL: EmailFormat = { subject: "", bodyHtml: "" };

const NEW_OIDC: OidcAuthModel = {
    method: "oidc",
    issuer: "",
    clientId: "",
    clientSecret: "",
    returnUrl: "",
    requireVerifiedEmail: true,
    emailClaim: "email",
    nameClaim: "name",
    provisioning: SsoProvisioning.reject,
    allowedEmailDomains: [],
};

export default function AuthenticationConfigModule() {
    const [res, setRes] = useState<ConfigPartResponseModel | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [version, setVersion] = useState<number | null>(null);
    const [model, setModel] = useState<AuthModel | null>(null);
    const [confirmPasswordsOff, setConfirmPasswordsOff] = useState(false);

    const [passwordOpen, setPasswordOpen] = useState(true);
    const [moreOidcOpen, setMoreOidcOpen] = useState(false);
    const ssoSectionRef = useRef<HTMLDivElement>(null);

    const MODELS = [
        "AuthModel",
        "CookieModel",
        "BuiltinAuthModel",
        "PasswordModel",
        "EmailFormat",
        "OidcAuthModel",
    ];
    const fh = useFieldHelp(...MODELS);
    const ft = useFieldTitle(...MODELS);

    const dirty = model !== null && JSON.stringify(model) !== JSON.stringify(res?.configValue);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await API.getSystemConfigPart({ part: "auth" });
                if (!mounted) return;
                if (!res.success) {
                    toast.error(res.error?.message ?? "Failed to load the authentication settings");
                    setLoading(false);
                    return;
                }
                setRes(res);
                setModel(res.configValue as AuthModel);
                setVersion(res.configVersion);
                setPasswordOpen(!(res.configValue as AuthModel).sso);
            } catch (e) {
                toast.error(errorText(e, "Failed to load the authentication settings"));
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const canSave = !!model && version !== null && !saving;

    const updateCookie = <K extends keyof CookieModel>(key: K, value: CookieModel[K]) => {
        setModel((prev) =>
            prev
                ? {
                      ...prev,
                      cookie: {
                          ...prev.cookie,
                          [key]: value,
                      },
                  }
                : prev,
        );
    };

    const builtin: BuiltinAuthModel | null = model?.builtinAuth ?? null;

    const updateBuiltin = (next: (prev: BuiltinAuthModel) => BuiltinAuthModel) =>
        setModel((prev) => (prev ? { ...prev, builtinAuth: next(prev.builtinAuth ?? {}) } : prev));

    const updatePassword = <K extends keyof PasswordModel>(key: K, value: PasswordModel[K]) =>
        updateBuiltin((b) => ({ ...b, password: { ...b.password, [key]: value } }));

    const updateMethod = <K extends keyof BuiltinAuthModel>(key: K, value: BuiltinAuthModel[K]) =>
        updateBuiltin((b) => ({ ...b, [key]: value }));

    const updateEmailTemplate = <
        S extends "newUserEmail" | "forgotPasswordEmail",
        K extends keyof EmailFormat,
    >(
        section: S,
        key: K,
        value: EmailFormat[K],
    ) =>
        updateBuiltin((b) => ({
            ...b,
            [section]: { ...EMPTY_EMAIL, ...b[section], [key]: value },
        }));

    const ssoTitle = `${ft("sso")} (${model?.sso?.method === "saml2" ? "SAML 2.0" : "OIDC"})`;

    const saved = res?.configValue as AuthModel | undefined;
    const savedOidc = saved?.sso?.method === "oidc" ? (saved.sso as OidcAuthModel) : null;
    const oidc = model?.sso?.method === "oidc" ? (model.sso as OidcAuthModel) : null;
    const otherSso = !!model?.sso && !oidc;
    const passwordsAllowed = model?.isBuiltinAllowed ?? true;

    const { serviceLevel } = useSession();
    const showSso = offersSingleSignOn(serviceLevel) || !!saved?.sso;

    const updateOidc = <K extends keyof OidcAuthModel>(key: K, value: OidcAuthModel[K]) =>
        setModel((prev) =>
            prev && prev.sso?.method === "oidc"
                ? { ...prev, sso: { ...(prev.sso as OidcAuthModel), [key]: value } }
                : prev,
        );

    const setSsoOn = (on: boolean) => {
        setModel((prev) =>
            prev ? { ...prev, sso: on ? { ...(savedOidc ?? NEW_OIDC) } : null } : prev,
        );
        setPasswordOpen(!on);
        if (on) {
            window.setTimeout(() => ssoSectionRef.current?.scrollIntoView?.({ block: "start" }), 0);
        }
    };

    const setPasswordsAllowed = (on: boolean) =>
        setModel((prev) => (prev ? { ...prev, isBuiltinAllowed: on } : prev));

    const ssoMissing: string[] = [];
    if (oidc) {
        if (!oidc.issuer?.trim()) ssoMissing.push("issuer");
        if (!oidc.clientId?.trim()) ssoMissing.push("client id");
        if (!savedOidc && !oidc.clientSecret?.trim()) ssoMissing.push("client secret");
        if (!oidc.returnUrl?.trim()) ssoMissing.push("return address");
    }

    const onSave = async (): Promise<boolean> => {
        if (!model || version === null) return false;
        setSaving(true);
        try {
            const resp = await API.updateSystemConfigPart({
                configValue: { ...model, type: "auth" },
                configVersion: version,
            });
            if (!resp.success) {
                toast.error(resp.error?.message ?? "Failed to update settings");
                return false;
            }
            const fresh = await API.getSystemConfigPart({ part: "auth" });
            if (fresh.success) {
                setRes(fresh);
                setModel(fresh.configValue as AuthModel);
                setVersion(fresh.configVersion);
            } else {
                const stored: AuthModel =
                    model.sso?.method === "oidc"
                        ? { ...model, sso: { ...(model.sso as OidcAuthModel), clientSecret: "" } }
                        : model;
                setModel(stored);
                setRes((prev) =>
                    prev
                        ? { ...prev, configValue: stored, configVersion: resp.configVersion }
                        : prev,
                );
                setVersion(resp.configVersion);
            }
            invalidatePasswordHelp();
            toast.success(
                `Authentication settings have been updated. ${uiText("config.appliesImmediately")}`,
            );
            return true;
        } catch (e) {
            toast.error(errorText(e, "Failed to update settings"));
            return false;
        } finally {
            setSaving(false);
        }
    };

    const passwordNote = !passwordsAllowed
        ? uiText("auth.passwordsOff")
        : !showSso
          ? undefined
          : savedOidc
            ? uiText("auth.keepPasswordsOn")
            : uiText("auth.passwordsNeedSso");
    const showPasswordSwitch = showSso || !passwordsAllowed;

    const { dialog: unsavedDialog } = useUnsavedChanges({
        isDirty: () => dirty,
        onSave: canSave && builtin && ssoMissing.length === 0 ? onSave : undefined,
        what: "page",
    });

    return (
        <Card>
            <CardHeader>
                <ModuleCardTitle title="Authentication" />
                <UpdatedBy obj={res} />
            </CardHeader>
            <CardContent className="space-y-6">
                {loading && (
                    <div className="space-y-2">
                        <div className="h-5 w-56 animate-pulse rounded bg-muted" />
                        <div className="h-9 w-full animate-pulse rounded bg-muted" />
                        <div className="h-9 w-full animate-pulse rounded bg-muted" />
                        <div className="h-40 w-full animate-pulse rounded bg-muted" />
                    </div>
                )}

                {!loading && model && builtin && (
                    <>
                        <Panel title="All sign-in methods">
                            <SubHeading title={ft("cookie")} help={fh("cookie")} />
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <NumberField
                                    id="cookie-max-age"
                                    label={ft("max_age")}
                                    help={fh("max_age")}
                                    value={model.cookie?.max_age ?? 0}
                                    onChange={(v) =>
                                        updateCookie("max_age", clampInt(v, 0, 31_536_000))
                                    }
                                />
                                <TextField
                                    id="cookie-domain"
                                    label={ft("domain")}
                                    help={fh("domain")}
                                    value={model.cookie?.domain ?? ""}
                                    onChange={(v) => updateCookie("domain", v)}
                                />
                                <SwitchField
                                    id="cookie-secure"
                                    label={ft("secure")}
                                    help={fh("secure")}
                                    checked={!!model.cookie?.secure}
                                    onCheckedChange={(v) => updateCookie("secure", v)}
                                />
                                <div className={FIELD}>
                                    <FieldLabel htmlFor="cookie-samesite" help={fh("samesite")}>
                                        {ft("samesite")}
                                    </FieldLabel>
                                    <Select
                                        value={model.cookie?.samesite ?? ""}
                                        onValueChange={(v) =>
                                            updateCookie("samesite", v as CookieModelSamesite)
                                        }
                                    >
                                        <SelectTrigger id="cookie-samesite" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Lax">Lax</SelectItem>
                                            <SelectItem value="Strict">Strict</SelectItem>
                                            <SelectItem value="None">None</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className={FIELD}>
                                    <FieldLabel
                                        htmlFor="integration-token-max-age"
                                        help={fh("integrationTokenMaxAgeDays")}
                                    >
                                        {ft("integrationTokenMaxAgeDays")}
                                    </FieldLabel>
                                    <Input
                                        id="integration-token-max-age"
                                        type="number"
                                        value={model.integrationTokenMaxAgeDays ?? ""}
                                        placeholder={uiText("placeholder.neverExpires")}
                                        onChange={(e) =>
                                            setModel((prev) =>
                                                prev
                                                    ? {
                                                          ...prev,
                                                          integrationTokenMaxAgeDays: e.target.value
                                                              ? clampInt(e.target.value, 1, 100_000)
                                                              : null,
                                                      }
                                                    : prev,
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </Panel>

                        <Panel
                            title={ft("builtinAuth")}
                            help={fh("builtinAuth")}
                            open={passwordOpen}
                            onOpenChange={setPasswordOpen}
                            note={passwordNote}
                            controlLabel={
                                showPasswordSwitch
                                    ? passwordsAllowed
                                        ? "Allowed"
                                        : "Not allowed"
                                    : undefined
                            }
                            control={
                                showPasswordSwitch ? (
                                    <Switch
                                        aria-label={ft("isBuiltinAllowed")}
                                        checked={passwordsAllowed}
                                        disabled={passwordsAllowed && !savedOidc}
                                        onCheckedChange={(on) =>
                                            on
                                                ? setPasswordsAllowed(true)
                                                : setConfirmPasswordsOff(true)
                                        }
                                    />
                                ) : undefined
                            }
                        >
                            <SubHeading title="Sessions" />
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <NumberField
                                    id="builtin-max-inactivity"
                                    label={ft("maxInactivityMinutes")}
                                    help={fh("maxInactivityMinutes")}
                                    value={builtin.maxInactivityMinutes ?? 0}
                                    onChange={(v) =>
                                        updateMethod(
                                            "maxInactivityMinutes",
                                            clampInt(v, 1, 100_000),
                                        )
                                    }
                                />
                                <NumberField
                                    id="builtin-reauthenticate"
                                    label={ft("reauthenticateAfterMinutes")}
                                    help={fh("reauthenticateAfterMinutes")}
                                    value={builtin.reauthenticateAfterMinutes ?? 0}
                                    onChange={(v) =>
                                        updateMethod(
                                            "reauthenticateAfterMinutes",
                                            clampInt(v, 1, 100_000),
                                        )
                                    }
                                />
                                <NumberField
                                    id="builtin-email-code"
                                    label={ft("emailCodeActiveMinutes")}
                                    help={fh("emailCodeActiveMinutes")}
                                    value={builtin.emailCodeActiveMinutes ?? 0}
                                    onChange={(v) =>
                                        updateMethod(
                                            "emailCodeActiveMinutes",
                                            clampInt(v, 1, 100_000),
                                        )
                                    }
                                />
                                <NumberField
                                    id="builtin-password-change"
                                    label={ft("mustChangePasswordEveryDays")}
                                    help={fh("mustChangePasswordEveryDays")}
                                    value={builtin.mustChangePasswordEveryDays ?? 0}
                                    onChange={(v) =>
                                        updateMethod(
                                            "mustChangePasswordEveryDays",
                                            clampInt(v, 0, 3650),
                                        )
                                    }
                                />
                                <TextField
                                    id="builtin-email-domain"
                                    label={ft("emailDomain")}
                                    help={fh("emailDomain")}
                                    value={builtin.emailDomain ?? ""}
                                    placeholder="example.com"
                                    onChange={(v) => updateMethod("emailDomain", v || null)}
                                />
                            </div>

                            <SubHeading title={ft("password")} help={fh("password")} />
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <NumberField
                                    id="password-min-length"
                                    label={ft("minLength")}
                                    help={fh("minLength")}
                                    value={builtin.password?.minLength ?? 0}
                                    onChange={(v) =>
                                        updatePassword("minLength", clampInt(v, 4, 4096))
                                    }
                                />
                                <NumberField
                                    id="password-max-length"
                                    label={ft("maxLength")}
                                    help={fh("maxLength")}
                                    value={builtin.password?.maxLength ?? 0}
                                    onChange={(v) =>
                                        updatePassword("maxLength", clampInt(v, 4, 4096))
                                    }
                                />
                                <NumberField
                                    id="password-min-upper"
                                    label={ft("minUpper")}
                                    help={fh("minUpper")}
                                    value={builtin.password?.minUpper ?? 0}
                                    onChange={(v) =>
                                        updatePassword("minUpper", clampInt(v, 0, 100))
                                    }
                                />
                                <NumberField
                                    id="password-min-lower"
                                    label={ft("minLower")}
                                    help={fh("minLower")}
                                    value={builtin.password?.minLower ?? 0}
                                    onChange={(v) =>
                                        updatePassword("minLower", clampInt(v, 0, 100))
                                    }
                                />
                                <NumberField
                                    id="password-min-numbers"
                                    label={ft("minNumbers")}
                                    help={fh("minNumbers")}
                                    value={builtin.password?.minNumbers ?? 0}
                                    onChange={(v) =>
                                        updatePassword("minNumbers", clampInt(v, 0, 100))
                                    }
                                />
                                <NumberField
                                    id="password-min-special"
                                    label={ft("minSpecialChars")}
                                    help={fh("minSpecialChars")}
                                    value={builtin.password?.minSpecialChars ?? 0}
                                    onChange={(v) =>
                                        updatePassword("minSpecialChars", clampInt(v, 0, 100))
                                    }
                                />
                                <div className="sm:col-span-2 lg:col-span-3">
                                    <TextField
                                        id="password-rules"
                                        label={ft("passwordRules")}
                                        help={fh("passwordRules")}
                                        value={builtin.password?.passwordRules ?? ""}
                                        onChange={(v) => updatePassword("passwordRules", v)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <EmailTemplate
                                    id="new-user-email"
                                    title={ft("newUserEmail")}
                                    subjectLabel={ft("subject")}
                                    bodyLabel={ft("bodyHtml")}
                                    bodyHelp={fh("bodyHtml")}
                                    value={builtin.newUserEmail ?? EMPTY_EMAIL}
                                    onChange={(k, v) => updateEmailTemplate("newUserEmail", k, v)}
                                />
                                <EmailTemplate
                                    id="password-reset-email"
                                    title={ft("forgotPasswordEmail")}
                                    subjectLabel={ft("subject")}
                                    bodyLabel={ft("bodyHtml")}
                                    bodyHelp={fh("bodyHtml")}
                                    value={builtin.forgotPasswordEmail ?? EMPTY_EMAIL}
                                    onChange={(k, v) =>
                                        updateEmailTemplate("forgotPasswordEmail", k, v)
                                    }
                                />
                            </div>
                        </Panel>

                        {showSso ? (
                            <Panel
                                sectionRef={ssoSectionRef}
                                title={ssoTitle}
                                help={fh("sso")}
                                open={!!model.sso}
                                controlLabel={model.sso ? "On" : "Off"}
                                control={
                                    <Switch
                                        aria-label={ssoTitle}
                                        checked={!!model.sso}
                                        disabled={!!model.sso && !passwordsAllowed}
                                        onCheckedChange={setSsoOn}
                                    />
                                }
                            >
                                {otherSso ? (
                                    <p className="text-sm text-muted-foreground">
                                        This account uses {model.sso?.method} single sign-on, which
                                        this page cannot edit yet.
                                    </p>
                                ) : null}

                                {oidc ? (
                                    <>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <TextField
                                                id="oidc-issuer"
                                                label={ft("issuer")}
                                                help={fh("issuer")}
                                                value={oidc.issuer ?? ""}
                                                maxLength={MAX_LENGTHS.OIDC_ISSUER.max}
                                                placeholder="https://login.example.com"
                                                invalid={ssoMissing.includes("issuer")}
                                                onChange={(v) => updateOidc("issuer", v)}
                                            />
                                            <TextField
                                                id="oidc-client-id"
                                                label={ft("clientId")}
                                                help={fh("clientId")}
                                                value={oidc.clientId ?? ""}
                                                maxLength={MAX_LENGTHS.OIDC_CLIENT_ID.max}
                                                invalid={ssoMissing.includes("client id")}
                                                onChange={(v) => updateOidc("clientId", v)}
                                            />
                                            <TextField
                                                id="oidc-client-secret"
                                                type="password"
                                                autoComplete="new-password"
                                                label={ft("clientSecret")}
                                                help={fh("clientSecret")}
                                                value={oidc.clientSecret ?? ""}
                                                maxLength={MAX_LENGTHS.OIDC_CLIENT_SECRET.max}
                                                invalid={ssoMissing.includes("client secret")}
                                                note={
                                                    savedOidc
                                                        ? uiText("auth.clientSecretStored")
                                                        : undefined
                                                }
                                                onChange={(v) => updateOidc("clientSecret", v)}
                                            />
                                            <TextField
                                                id="oidc-return-url"
                                                label={ft("returnUrl")}
                                                help={fh("returnUrl")}
                                                value={oidc.returnUrl ?? ""}
                                                maxLength={MAX_LENGTHS.OIDC_RETURN_URL.max}
                                                placeholder={
                                                    typeof window === "undefined"
                                                        ? ""
                                                        : `${window.location.origin}${window.location.pathname}`
                                                }
                                                invalid={ssoMissing.includes("return address")}
                                                note={uiText("auth.returnUrlMatch")}
                                                onChange={(v) => updateOidc("returnUrl", v)}
                                            />
                                        </div>

                                        {ssoMissing.length > 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                Enter the {listed(ssoMissing)} to save single
                                                sign-on.
                                            </p>
                                        ) : null}

                                        <Fold
                                            id="oidc-more"
                                            title="More settings"
                                            open={moreOidcOpen}
                                            onOpenChange={setMoreOidcOpen}
                                        >
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className={FIELD}>
                                                    <FieldLabel
                                                        htmlFor="oidc-scopes"
                                                        help={fh("scopes")}
                                                    >
                                                        {ft("scopes")}
                                                    </FieldLabel>
                                                    <ListInput
                                                        id="oidc-scopes"
                                                        separator=" "
                                                        value={oidc.scopes}
                                                        placeholder="openid email profile"
                                                        onChange={(v) => updateOidc("scopes", v)}
                                                    />
                                                </div>
                                                <div className={FIELD}>
                                                    <FieldLabel
                                                        htmlFor="oidc-domains"
                                                        help={fh("allowedEmailDomains")}
                                                    >
                                                        {ft("allowedEmailDomains")}
                                                    </FieldLabel>
                                                    <ListInput
                                                        id="oidc-domains"
                                                        separator=", "
                                                        value={oidc.allowedEmailDomains}
                                                        placeholder="example.com"
                                                        onChange={(v) =>
                                                            updateOidc("allowedEmailDomains", v)
                                                        }
                                                    />
                                                </div>
                                                <TextField
                                                    id="oidc-email-claim"
                                                    label={ft("emailClaim")}
                                                    help={fh("emailClaim")}
                                                    value={oidc.emailClaim ?? ""}
                                                    maxLength={MAX_LENGTHS.OIDC_EMAIL_CLAIM.max}
                                                    onChange={(v) => updateOidc("emailClaim", v)}
                                                />
                                                <TextField
                                                    id="oidc-name-claim"
                                                    label={ft("nameClaim")}
                                                    help={fh("nameClaim")}
                                                    value={oidc.nameClaim ?? ""}
                                                    maxLength={MAX_LENGTHS.OIDC_NAME_CLAIM.max}
                                                    onChange={(v) => updateOidc("nameClaim", v)}
                                                />
                                                <div className={FIELD}>
                                                    <FieldLabel
                                                        htmlFor="oidc-provisioning"
                                                        help={fh("provisioning")}
                                                    >
                                                        {ft("provisioning")}
                                                    </FieldLabel>
                                                    <Select
                                                        value={
                                                            oidc.provisioning ??
                                                            SsoProvisioning.reject
                                                        }
                                                        onValueChange={(v) =>
                                                            updateOidc(
                                                                "provisioning",
                                                                v as SsoProvisioning,
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="oidc-provisioning"
                                                            className="w-full"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem
                                                                value={SsoProvisioning.reject}
                                                            >
                                                                Refuse the sign-in
                                                            </SelectItem>
                                                            <SelectItem
                                                                value={SsoProvisioning.createUser}
                                                            >
                                                                Add them as a user
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <SwitchField
                                                    id="oidc-verified-email"
                                                    label={ft("requireVerifiedEmail")}
                                                    help={fh("requireVerifiedEmail")}
                                                    checked={oidc.requireVerifiedEmail ?? true}
                                                    onCheckedChange={(v) =>
                                                        updateOidc("requireVerifiedEmail", v)
                                                    }
                                                />
                                            </div>
                                        </Fold>

                                        <p className="text-sm text-muted-foreground">
                                            {uiText("auth.removingPeople")}
                                        </p>
                                    </>
                                ) : null}
                            </Panel>
                        ) : null}
                    </>
                )}
            </CardContent>

            {unsavedDialog}
            <ActionBar
                onUpdate={onSave}
                dirty={dirty}
                busy={saving}
                disabled={!canSave || !builtin || ssoMissing.length > 0}
                message={ssoMissing.length > 0 ? "Single sign-on is not complete." : undefined}
            />

            <AlertDialog open={confirmPasswordsOff} onOpenChange={setConfirmPasswordsOff}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Turn off password sign-in?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {uiText("auth.turnOffPasswords")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep it on</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => setPasswordsAllowed(false)}
                        >
                            Turn off password sign-in
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

function clampInt(val: string, min: number, max: number): number {
    const n = parseInt(val, 10);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
}

function listed(items: string[]): string {
    return items.length < 2
        ? (items[0] ?? "")
        : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function Panel(props: {
    title: string;
    help?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    control?: ReactNode;
    controlLabel?: string;
    note?: string;
    sectionRef?: RefObject<HTMLDivElement | null>;
    children: ReactNode;
}) {
    const {
        title,
        help,
        open = true,
        onOpenChange,
        control,
        controlLabel,
        note,
        sectionRef,
        children,
    } = props;
    const heading = (
        <HoverTip tip={help}>
            <h3 className="text-base font-semibold leading-none tracking-tight">{title}</h3>
        </HoverTip>
    );
    return (
        <Collapsible open={open} onOpenChange={onOpenChange}>
            <div ref={sectionRef} className="scroll-mt-16 rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                    {onOpenChange ? (
                        <CollapsibleTrigger asChild>
                            <button
                                type="button"
                                className="flex min-w-0 items-center gap-2 text-left"
                            >
                                <ChevronRight
                                    className={cn(
                                        "h-4 w-4 shrink-0 transition-transform",
                                        open && "rotate-90",
                                    )}
                                    aria-hidden
                                />
                                {heading}
                            </button>
                        </CollapsibleTrigger>
                    ) : (
                        heading
                    )}
                    {control ? (
                        <div className="flex shrink-0 items-center gap-2">
                            {controlLabel ? (
                                <span aria-hidden className="text-sm text-muted-foreground">
                                    {controlLabel}
                                </span>
                            ) : null}
                            {control}
                        </div>
                    ) : null}
                </div>
                {note ? (
                    <p className={cn("mt-2 text-sm text-muted-foreground", onOpenChange && "pl-6")}>
                        {note}
                    </p>
                ) : null}
                <CollapsibleContent className="mt-4 space-y-4">{children}</CollapsibleContent>
            </div>
        </Collapsible>
    );
}

function SubHeading({ title, help }: { title: string; help?: string }) {
    return (
        <FieldLabel help={help} className="text-sm font-semibold">
            {title}
        </FieldLabel>
    );
}

function Fold(props: {
    id: string;
    title: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
}) {
    const { id, title, open, onOpenChange, children } = props;
    return (
        <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-xl border">
            <CollapsibleTrigger asChild>
                <button
                    type="button"
                    aria-controls={`${id}-content`}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
                >
                    <ChevronRight
                        className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90")}
                        aria-hidden
                    />
                    {title}
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent id={`${id}-content`} className="border-t px-4 py-4">
                {children}
            </CollapsibleContent>
        </Collapsible>
    );
}

function EmailTemplate(props: {
    id: string;
    title: string;
    subjectLabel: string;
    bodyLabel: string;
    bodyHelp?: string;
    value: EmailFormat;
    onChange: (key: keyof EmailFormat, value: string) => void;
}) {
    const { id, title, subjectLabel, bodyLabel, bodyHelp, value, onChange } = props;
    const [open, setOpen] = useState(false);
    return (
        <Fold id={id} title={title} open={open} onOpenChange={setOpen}>
            <div className="grid gap-4">
                <TextField
                    id={`${id}-subject`}
                    label={subjectLabel}
                    value={value.subject ?? ""}
                    onChange={(v) => onChange("subject", v)}
                />
                <div className="space-y-1.5">
                    <FieldLabel htmlFor={`${id}-body`} help={bodyHelp}>
                        {bodyLabel}
                    </FieldLabel>
                    <Textarea
                        id={`${id}-body`}
                        className="min-h-40 font-mono text-xs"
                        value={value.bodyHtml ?? ""}
                        onChange={(e) => onChange("bodyHtml", e.target.value)}
                    />
                </div>
            </div>
        </Fold>
    );
}

const FIELD = "row-span-2 grid grid-rows-subgrid gap-y-1.5";

function NumberField(props: {
    id: string;
    label: string;
    help?: string;
    value: number;
    onChange: (value: string) => void;
}) {
    const { id, label, help, value, onChange } = props;
    return (
        <div className={FIELD}>
            <FieldLabel htmlFor={id} help={help}>
                {label}
            </FieldLabel>
            <Input id={id} type="number" value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}

function SwitchField(props: {
    id: string;
    label: string;
    help?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    const { id, label, help, checked, onCheckedChange } = props;
    return (
        <div className={FIELD}>
            <FieldLabel htmlFor={id} help={help}>
                {label}
            </FieldLabel>
            <div className="flex h-9 items-center">
                <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
            </div>
        </div>
    );
}

function TextField(props: {
    id: string;
    label: string;
    help?: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    autoComplete?: string;
    maxLength?: number;
    placeholder?: string;
    invalid?: boolean;
    note?: string;
}) {
    const {
        id,
        label,
        help,
        value,
        onChange,
        type,
        autoComplete,
        maxLength,
        placeholder,
        invalid,
        note,
    } = props;
    const [visited, setVisited] = useState(false);
    return (
        <div className={FIELD}>
            <FieldLabel htmlFor={id} help={help}>
                {label}
            </FieldLabel>
            <div className="space-y-1.5">
                <Input
                    id={id}
                    type={type ?? "text"}
                    autoComplete={autoComplete}
                    value={value}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    aria-invalid={(invalid && visited) || undefined}
                    onBlur={() => setVisited(true)}
                    onChange={(e) => onChange(e.target.value)}
                />
                {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
            </div>
        </div>
    );
}

function parseList(text: string): string[] {
    return text
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function ListInput(props: {
    id: string;
    value: string[] | undefined;
    onChange: (next: string[]) => void;
    separator: string;
    placeholder?: string;
}) {
    const { id, value, onChange, separator, placeholder } = props;
    const joined = (value ?? []).join(separator);
    const [text, setText] = useState(joined);
    const [lastJoined, setLastJoined] = useState(joined);
    if (joined !== lastJoined) {
        setLastJoined(joined);
        if (parseList(text).join(separator) !== joined) setText(joined);
    }
    return (
        <Input
            id={id}
            value={text}
            placeholder={placeholder}
            onChange={(e) => {
                const next = parseList(e.target.value);
                setText(e.target.value);
                setLastJoined(next.join(separator));
                onChange(next);
            }}
        />
    );
}
