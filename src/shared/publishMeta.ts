export function metaFieldLabel(field: string): string {
    switch (field) {
        case "agentTitle":
            return "Title";
        case "maxTime":
            return "Max time";
        case "maxCost":
            return "Max cost";
    }
    return field;
}
