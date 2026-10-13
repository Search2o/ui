import { AgentServerRoute } from "@/orval/search2o.schemas";
import { uiText } from "@/shared/uiText";

export const AGENT_SERVER_ROUTES = Object.values(AgentServerRoute);

export function routeHelp(route: string): string {
    switch (route) {
        case AgentServerRoute.auth:
            return uiText("servers.route.auth");
        case AgentServerRoute.exec:
            return uiText("servers.route.exec");
        case AgentServerRoute.user:
            return uiText("servers.route.user");
        case AgentServerRoute.dev:
            return uiText("servers.route.dev");
        case AgentServerRoute.admin:
            return uiText("servers.route.admin");
        case AgentServerRoute.reports:
            return uiText("servers.route.reports");
        case AgentServerRoute.owner:
            return uiText("servers.route.owner");
        default:
            return "";
    }
}

export const ROUTES_THE_UI_NEEDS: readonly string[] = [
    AgentServerRoute.auth,
    AgentServerRoute.user,
];

export function routesMissingForUi(routes: readonly string[] | null | undefined): string[] {
    if (routes == null) return [];
    return ROUTES_THE_UI_NEEDS.filter((r) => !routes.includes(r));
}
