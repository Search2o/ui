import { loader } from "@monaco-editor/react";

const docDir = document.baseURI.replace(/[^/]*$/, "");
loader.config({ paths: { vs: `${docDir}monaco/vs` } });
