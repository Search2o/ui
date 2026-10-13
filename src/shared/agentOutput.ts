export function showsEmptyAnswerNotice(args: {
    running: boolean;
    partCount: number;
    progressText?: string;
    finalSuccess?: boolean;
    resultCode?: string;
}): boolean {
    const { running, partCount, progressText, finalSuccess, resultCode } = args;
    if (running) return false;
    if (resultCode === "ask") return false;
    if (partCount > 0) return false;
    if (progressText?.trim()) return false;
    return finalSuccess !== false;
}
