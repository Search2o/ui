import type { ValidateDraftResponseModel } from "@/orval/search2o.schemas";

export function runStartedConversation(resp: ValidateDraftResponseModel): boolean {
    return !!resp.convid;
}
