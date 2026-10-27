import type { UserRole } from "@/orval/search2o.schemas";

export const ROLE_LABELS: Record<UserRole, string> = {
    user: "User",
    developer: "Developer",
    admin: "Administrator",
    owner: "Account Owner",
};

export function roleLabel(role: string | null | undefined): string {
    if (!role) return "";
    return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}
