import { SysVariables } from "@/orval/search2o.schemas";
import { uiText } from "@/shared/uiText";

export const OPTIONAL_SYS_VARIABLES: SysVariables[] = Object.values(SysVariables);

const ALWAYS_AVAILABLE = ["inputs", "query", "secret"];

export function alwaysAvailableSysVariables(
    optional: readonly string[] = OPTIONAL_SYS_VARIABLES,
): string[] {
    return ALWAYS_AVAILABLE.filter((name) => !optional.includes(name));
}

export function sysVariableHelp(name: string): string {
    return (
        {
            userEmail: uiText("sysVariables.userEmail"),
            userSession: uiText("sysVariables.userSession"),
            serverIp: uiText("sysVariables.serverIp"),
            cookies: uiText("sysVariables.cookies"),
            inputs: uiText("sysVariables.inputs"),
            query: uiText("sysVariables.query"),
            secret: uiText("sysVariables.secret"),
        }[name] ?? ""
    );
}
