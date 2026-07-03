# Nib

A local-first, plugin-based "everything notepad" — part notepad, part to-do system, part locked diary, with a small AI companion that lives *on* the screen. Every feature, including the core ones, is a toggleable module over one shared data layer.

**Status: Phase 0 — foundation.** The stack, architecture, and build order are documented in [plan.md](plan.md); the visual direction lives in [`design/`](design/).

## Layout

| Path | What it is |
|------|------------|
| `apps/desktop` | Electron entry — main process, preload, renderer glue |
| `packages/core` | Shared data layer, plugin broker, events, scheduler *(lands in Phase 1)* |
| `packages/plugin-api` | The `nib.*` types every plugin (core or third-party) builds against |
| `packages/shell` | React UI for the main window |
| `plugins/` | The core modules themselves — notepad, to-do, diary, assistant *(land in Phases 2–5)* |

## Development

```sh
pnpm install
pnpm dev        # launch the desktop app with HMR
pnpm test       # unit tests (Vitest)
pnpm typecheck  # per-package tsc --noEmit
pnpm lint
pnpm build
```

Requires Node ≥ 20.19 (22 LTS or newer recommended) and pnpm.
