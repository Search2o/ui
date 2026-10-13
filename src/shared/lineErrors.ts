export function errorsByLine(text: string, errors: Record<string, string>): (string | null)[] {
    return text.split("\n").map((line) => {
        const key = line.trim();
        return key && Object.hasOwn(errors, key) ? errors[key] : null;
    });
}
