export class ApiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ApiError";
    }
}

export function errorText(e: unknown, fallback: string): string {
    if (e instanceof ApiError && e.message.trim()) return e.message;
    console.error("Internal error shown to the reader as:", fallback, e);
    return fallback;
}
