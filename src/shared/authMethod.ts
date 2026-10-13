import { AuthMethod } from "@/orval/search2o.schemas";

export type SignInPlan = {
    password: boolean;
    sso: boolean;
    unsupported: string[];
};

export function signInPlan(methods: readonly string[] | null | undefined): SignInPlan {
    if (!methods || methods.length === 0) return { password: true, sso: false, unsupported: [] };
    const plan: SignInPlan = { password: false, sso: false, unsupported: [] };
    for (const method of methods) {
        if (method === AuthMethod.builtin) plan.password = true;
        else if (method === AuthMethod.oidc) plan.sso = true;
        else plan.unsupported.push(method);
    }
    return plan;
}
