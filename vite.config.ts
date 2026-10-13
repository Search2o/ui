import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const proxyTarget = env.API_TARGET || "http://localhost:9020";
    return {
        plugins: [
            react(),
            tailwind(),
            viteStaticCopy({
                targets: [
                    {
                        src: "node_modules/monaco-editor/min/vs/**/*",
                        dest: "monaco/vs",
                        rename: { stripBase: 4 },
                    },
                ],
            }),
        ],
        resolve: { alias: { "@": path.resolve(__dirname, "src") } },
        base: "./",
        server: {
            proxy: { "/api": { target: proxyTarget, changeOrigin: true } },
        },
    };
});
