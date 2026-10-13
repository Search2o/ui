import type { AccountModel, UpdateAccountModel } from "@/orval/search2o.schemas";

export type AccountFields = Pick<
    AccountModel,
    "accountName" | "billingEmail" | "accountContactEmail"
>;

export function accountUpdatePayload(
    edited: AccountFields,
    loaded: AccountFields,
): UpdateAccountModel {
    const payload: UpdateAccountModel = { accountName: (edited.accountName ?? "").trim() };

    const changed = (key: "billingEmail" | "accountContactEmail") =>
        (edited[key] ?? "").trim() !== (loaded[key] ?? "").trim();

    if (changed("billingEmail")) payload.billingEmail = (edited.billingEmail ?? "").trim();
    if (changed("accountContactEmail")) {
        payload.accountContactEmail = (edited.accountContactEmail ?? "").trim();
    }
    return payload;
}
