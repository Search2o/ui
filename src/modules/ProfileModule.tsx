import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/shared/useSession";
import * as API from "@/orval/search2o";
import type { ThemeType, UserProfileModel } from "@/orval/search2o.schemas";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/shared/PasswordInput";
import { PasswordHelpHint } from "@/shared/PasswordHelpHint";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { IntegrationTokens } from "@/shared/IntegrationTokens";
import { uiText } from "@/shared/uiText";

export default function ProfileModule() {
    const { setTheme, user, setUser } = useSession();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pwdSaving, setPwdSaving] = useState(false);

    const [pwdOld, setPwdOld] = useState("");
    const [pwdNew, setPwdNew] = useState("");

    const [nameDraft, setNameDraft] = useState("");
    const [tokenMaxAgeDays, setTokenMaxAgeDays] = useState<number | null | undefined>(undefined);
    const [themeDraft, setThemeDraft] = useState<ThemeType>("system");

    const isPlainUser = user?.role === "user";
    const canSaveProfile = nameDraft.trim().length > 0 && !saving;

    const loadProfile = useCallback(async () => {
        try {
            setLoading(true);
            const resp = await API.getUserProfile();
            if (resp?.success === false) {
                toast.error(resp.error?.message || "Failed to load profile");
                return;
            }
            setTokenMaxAgeDays(resp.integrationTokenMaxAgeDays ?? null);
            const u = resp.user;
            const nextUser: UserProfileModel = {
                email: u?.email ?? "",
                userName: u?.userName ?? "",
                role: u?.role ?? "user",
                uiPref: {
                    theme: u?.uiPref?.theme ?? "system",
                    lang: u?.uiPref?.lang ?? "English",
                },
            };
            setUser(nextUser);
            setNameDraft(nextUser.userName ?? "");
            setThemeDraft(nextUser.uiPref?.theme ?? "system");
            if (nextUser.uiPref?.theme) setTheme(nextUser.uiPref.theme);
        } catch {
            toast.error("Unable to load profile");
        } finally {
            setLoading(false);
        }
    }, [setTheme, setUser]);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    function handleThemeChange(nextTheme: ThemeType) {
        setThemeDraft(nextTheme);
        setTheme(nextTheme);
    }

    async function handleSaveProfile() {
        if (!user) return;
        try {
            setSaving(true);
            const resp = await API.updateUserProfile({
                userName: nameDraft.trim(),
                uiPref: { theme: themeDraft, lang: user.uiPref?.lang },
            });
            if (resp?.success === false) {
                toast.error(resp.error?.message || "Failed to update profile");
                return;
            }
            await loadProfile();
            toast.success("Profile updated");
        } catch {
            toast.error("Failed to update profile");
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdatePassword() {
        if (!pwdOld || !pwdNew) {
            toast.error(uiText("validate.passwordBoth"));
            return;
        }
        try {
            setPwdSaving(true);
            const resp = await API.changePassword({
                currentPassword: pwdOld,
                newPassword: pwdNew,
            });
            if (resp?.success === false) {
                toast.error(resp.error?.message || "Failed to update password");
                return;
            }
            setPwdOld("");
            setPwdNew("");
            toast.success("Password has been updated");
        } catch {
            toast.error("Failed to update password");
        } finally {
            setPwdSaving(false);
        }
    }

    return (
        <div className="w-full grid gap-6">
            <Card className="shadow-sm">
                <CardHeader>
                    <ModuleCardTitle title="Profile" />
                </CardHeader>
                <CardContent className="grid gap-5">
                    <div className="grid max-w-4xl gap-5 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                value={user?.email ?? ""}
                                readOnly
                                disabled
                                aria-readonly
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="userName">Display name</Label>
                            <Input
                                id="userName"
                                value={nameDraft}
                                onChange={(e) => setNameDraft(e.target.value)}
                                placeholder={uiText("placeholder.displayName")}
                            />
                        </div>

                        {!isPlainUser && (
                            <div className="grid gap-2">
                                <Label htmlFor="role">Role</Label>
                                <Input id="role" value={user?.role ?? ""} readOnly disabled />
                            </div>
                        )}
                    </div>

                    <Separator />

                    <div className="grid gap-3">
                        <h3 className="text-base font-medium">UI Preferences</h3>
                        <div className="grid max-w-4xl gap-5 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="theme">Theme</Label>
                                <Select
                                    value={themeDraft}
                                    onValueChange={(val: ThemeType) => handleThemeChange(val)}
                                >
                                    <SelectTrigger id="theme" className="w-full">
                                        <SelectValue placeholder="Select theme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">Light</SelectItem>
                                        <SelectItem value="dark">Dark</SelectItem>
                                        <SelectItem value="system">System</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            onClick={handleSaveProfile}
                            disabled={!canSaveProfile || loading}
                            variant="outline"
                        >
                            <Save className="h-4 w-4" />
                            {saving ? "Updating…" : "Update profile"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Update your account password.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5">
                    <div className="grid max-w-4xl items-start gap-5 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="currentPassword">Current password</Label>
                            <PasswordInput
                                id="currentPassword"
                                value={pwdOld}
                                onChange={(e) => setPwdOld(e.target.value)}
                                placeholder="Enter current password"
                                autoComplete="current-password"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="newPassword">New password</Label>
                            <PasswordInput
                                id="newPassword"
                                value={pwdNew}
                                onChange={(e) => setPwdNew(e.target.value)}
                                placeholder="Enter new password"
                                autoComplete="new-password"
                            />
                            <PasswordHelpHint />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            onClick={handleUpdatePassword}
                            disabled={pwdSaving}
                            variant="outline"
                        >
                            <Save className="h-4 w-4" />
                            {pwdSaving ? "Updating…" : "Update password"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <IntegrationTokens maxAgeDays={tokenMaxAgeDays} />
        </div>
    );
}
