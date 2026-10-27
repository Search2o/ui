<p align="center">
  <a href="https://search2o.com">
    <img src="https://search2o.com/images/og6.png" alt="Search2o: a platform to build, run, and use AI agents, with a search interface" width="600">
  </a>
</p>

**Website:** [search2o.com](https://search2o.com) · **Source:** [GitHub](https://github.com/Search2o/ui) · **Docs:** [search2o.com/docs](https://search2o.com/docs/index.html) · **Skill:** [Search2o-skill](https://github.com/Search2o/search2o-skill)

This repository contains the **Search2o UI**: the React web interface of the Search2o Agent Server. The agent server on PyPI already bundles a built copy of it.

Many parts of this UI were generated with AI, against the agent server's REST API, so it is not actively supported. Please feel free to clone and adapt the UI, especially the end user search interface, for your needs.

## Getting started

The UI needs a running Search2o Agent Server. Install and start one first, following the [agent server's Getting started](https://github.com/Search2o/agent-server#getting-started).

You need Node.js 22.18 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server sends `/api` to the agent server at `http://localhost:9020`. To use a server somewhere else, set `API_TARGET` in `.env.local`:

```
API_TARGET=http://localhost:9020
```

The first time, click **New user / Forgot password** on the sign-in dialog and enter the email you created your Search2o account with. A code is emailed to that address and no other. Enter the code, choose a password, and sign in.

## Building and deploying

```bash
npm run build
```

The build goes into `dist/`, and `npm run preview` serves it locally. The build does not type-check; `npx tsc -p tsconfig.app.json --noEmit` does.

Serve the whole `dist` tree, including `dist/monaco/`: the editor is self-hosted and does not load without it.

A built UI finds its server at runtime, from a `<meta>` tag in `index.html`, so one build works against any server:

```html
<meta name="search2o-ui-config" content='{ "apiBase": "" }' />
```

Leave `apiBase` empty when the UI is served from the same origin as the agent server. Otherwise set it to the server's URL, and allow the UI's origin in the server's CORS settings. Every other setting comes from the agent server.

## Project layout

```
src/
  modules/     One file per screen, lazy-loaded through src/shared/moduleRegistry.ts
  shared/      Cross-module components, hooks and helpers
  orval/       Generated API client — do not edit by hand
  schema/      openapi.json, fetched verbatim from the server
  components/  Vendored shadcn/ui primitives — kept unmodified
  hooks/ lib/  Vendored shadcn/ui support files
```

## How it works

There is no client-side router. Navigation is an in-memory module switcher (`src/shared/uistate.ts`): `openModule(key, payload)` sets the active module, every module is a lazy import in `src/shared/moduleRegistry.ts`, and a module can install a navigation guard to protect unsaved work (the draft editor uses this).

Every server call goes through the generated Orval client, which in turn goes through one fetcher (`src/shared/orvalFetcher.ts`) that applies the configured base URL and timeout, sends credentials, and turns transport failures into the same `{ success, error: { message } }` envelope the API itself returns, so callers only ever handle one shape. A failed call is a returned value, never a thrown exception; anything that reaches a `catch` is this application breaking rather than the server refusing.

### The editor

Agent definitions are JSONC (comments and trailing commas are allowed) and are edited in Monaco. Completion is driven entirely by the agent JSON schema, which the agent server serves, so new commands and fields appear without a UI release.

Monaco is **self-hosted**: the build copies `monaco-editor/min/vs` into `dist/monaco/vs` and the loader points there, so the editor makes no third-party request and works in air-gapped deployments.

Two things to know before changing this: never add a static `import "monaco-editor"` (it re-bundles ~2.5 MB the app does not use, since the editor is loaded through the AMD loader), and upgrade `monaco-editor` together with `@monaco-editor/loader` (which `@monaco-editor/react` brings in). The loader reads the module that Monaco's `min/vs` build exports, and that shape has changed between Monaco releases.

## Conventions

- **Types come from the server.** Use the generated types in `src/orval`; do not redeclare API shapes locally. The one exception is `src/shared/agentSchema.ts`, which types the agent JSON schema: that is a document the server serves, not part of the REST API.
- **Check `success` on every response.** The API answers with `{ success, error: { message, cause, data }, ... }`; show `error.message` when it is false. **Only the server's words reach the reader**: an internal fault is logged and the module's own copy is shown instead, via `errorText()` in `src/shared/apiError.ts`.
- **Vendored code stays vendored.** `src/components`, `src/hooks` and `src/lib` come from shadcn/ui and are kept unmodified so upstream updates remain easy to apply.
