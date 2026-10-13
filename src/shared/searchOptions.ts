export const SearchBehavior = {
    executeTopMatch: "executeTopMatch",
    executeOnlyMatch: "executeOnlyMatch",
    showResults: "showResults",
} as const;
export type SearchBehavior = (typeof SearchBehavior)[keyof typeof SearchBehavior];

export const FollowupBehavior = {
    executeTopMatch: "executeTopMatch",
    executeOnlyMatch: "executeOnlyMatch",
    showResults: "showResults",
    executePrevious: "executePrevious",
} as const;
export type FollowupBehavior = (typeof FollowupBehavior)[keyof typeof FollowupBehavior];

export type SearchOptions = {
    tag: string;
    searchBehavior: SearchBehavior;
    followupBehavior: FollowupBehavior;
};

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
    tag: "",
    searchBehavior: SearchBehavior.executeTopMatch,
    followupBehavior: FollowupBehavior.executeTopMatch,
};

const TAG_PATTERN = /^(?:|[a-z0-9]+(?:_[a-z0-9]+)*)$/;
const TAG_MAX = 16;

function oneOf<T extends string>(allowed: Record<string, T>, value: unknown, fallback: T): T {
    return typeof value === "string" && Object.values(allowed).includes(value as T)
        ? (value as T)
        : fallback;
}

export function readSearchOptions(
    raw: unknown,
    fallback: SearchOptions = DEFAULT_SEARCH_OPTIONS,
): SearchOptions {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...fallback };
    const obj = raw as Record<string, unknown>;

    const options: SearchOptions = {
        tag:
            typeof obj.tag === "string" && obj.tag.length <= TAG_MAX && TAG_PATTERN.test(obj.tag)
                ? obj.tag
                : fallback.tag,
        searchBehavior: oneOf(SearchBehavior, obj.searchBehavior, fallback.searchBehavior),
        followupBehavior: oneOf(FollowupBehavior, obj.followupBehavior, fallback.followupBehavior),
    };

    const ignored = (["tag", "searchBehavior", "followupBehavior"] as const).filter(
        (key) => obj[key] !== undefined && obj[key] !== options[key],
    );
    if (ignored.length > 0) {
        console.warn(
            `Search2o: search setting ${ignored.map((k) => `${k}=${JSON.stringify(obj[k])}`).join(", ")} ` +
                `is not valid and was ignored.`,
        );
    }
    return options;
}
