import { useMemo } from "react";
import type * as monacoT from "monaco-editor";
import { useSession } from "@/shared/useSession";

export function defineMonacoThemes(m: typeof monacoT): void {
    const colors = {
        "editor.background": "#00000000",
        "editorGutter.background": "#00000000",
    };
    m.editor.defineTheme("search2o-light", { base: "vs", inherit: true, rules: [], colors });
    m.editor.defineTheme("search2o-dark", { base: "vs-dark", inherit: true, rules: [], colors });
}

export function useMonacoTheme(): string {
    const { theme } = useSession();
    return useMemo(() => {
        const systemDark =
            theme === "system" &&
            typeof document !== "undefined" &&
            document.documentElement.classList.contains("dark");
        return theme === "dark" || systemDark ? "search2o-dark" : "search2o-light";
    }, [theme]);
}
