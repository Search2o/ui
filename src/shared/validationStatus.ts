export type AssistMode = "ai" | "validate";

export type ValidationStatus = "validating" | "failed" | "validated" | "notValidated";

export function validationStatus({
    running,
    failed,
    validated,
}: {
    running: boolean;
    failed: boolean;
    validated: boolean;
}): ValidationStatus {
    if (running) return "validating";
    if (failed) return "failed";
    if (validated) return "validated";
    return "notValidated";
}
