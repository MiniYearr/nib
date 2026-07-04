# Nib — Technology Stack & Architecture Plan

## Context

Nib is a new open-source, local-first desktop notepad app being planned from a blank slate. Its defining idea: **everything is a plugin** — notepad, to-dos, diary, and the sprite AI assistant are all removable modules registering into one shared local data layer through the same plugin API that third-party developers use. This document records the chosen stack for all 14 planning items, the rationale, how the pieces connect, and the phased build order. All contested decisions were made explicitly with the project owner across three Q&A rounds.

**Pre-implementation steps:**
1. Import the design canvas from Claude Design project `b5153d52-9980-4eea-8783-a6853af4432d` (file `Nib Design Canvas.dc.html`) via DesignSync — read it for UI direction, store it under `design/`. *(Done — `design/Nib Design Canvas.dc.html` + `design/support.js`.)*
2. `git init` the directory. *(Done.)*
3. This file. *(Done.)*

### Design canvas summary (v1, "Extensible Smart Notepad App")

Thirteen boards covering every planned surface: app shell, notepad (tabs, Markdown ⇄ Rich toggle, version-history timeline with diff), to-do time-blocking day view (recurrence, streaks, subtasks, "ask Nib to plan my day"), diary lock screen + entry view (mood tag, per-entry lock, voice-to-text, "on this day", completed-media shelf), the sprite with **five states** (idle / walking / thinking / celebrating / nudging — click to talk, switchable mode), memory inspector (facts grouped by source module, per-fact delete — matches the hybrid facts-table design), command palette (any plugin's actions), plugin manager (core & third-party in one list with manifest metadata), a third-party plugin-card pattern, and dark-mode variants.

Tokens to carry into the theme system: **Figtree** (UI/body, 400–800) + **JetBrains Mono** (metadata, manifests, dev surfaces); warm paper `#FBFAF7` on `#E9E4DA`, ink `#26221D`, one warm accent (terracotta `#BF6B44`, templated as `--accent`) for all interactive elements *and* the sprite, sage `#6E8B6A` for streaks, purple `#8A6BC8` as the diary module color; 8px grid, radius 8–14, Windows titlebar chrome, full dark twin ("deep warm charcoal, same accent"). Lucide icons at stroke-width 1.9. Sprite is a geometric rounded-rectangle with dot eyes and an antenna — no limbs; animation keyframes (`nib-bob`, `nib-blink`, `nib-walk`, `nib-think`, `nib-cheer`, `nib-spark`) are prototyped in the canvas itself.

## Decisions at a glance

| # | Item | Decision |
|---|------|----------|
| 1 | Desktop shell | **Electron** (latest stable) — main window + separate transparent sprite overlay window |
| 2 | Languages | **TypeScript everywhere**; plugins are JS/TS |
| 3 | Local storage | **SQLite via better-sqlite3 + FTS5**; unified index across notes/tasks/diary; snapshot-based note versions; oplog from day one |
| 4 | Diary encryption | Separate **encrypted diary DB** (SQLCipher-compatible build), Argon2id + XChaCha20-Poly1305; per-entry lock = second app-level encryption layer; **invisible-while-locked** semantics |
| 5 | Plugin system | JSON manifest (VS Code-shaped); third-party plugins in **Chromium-sandboxed renderer processes** with a brokered, permissioned RPC API; diary deny-by-default |
| 6 | AI integration | **llama.cpp `llama-server` sidecar** (owner's GGUF model), OpenAI-compatible localhost API, **BYO-endpoint** for other users; memory = **structured facts table + sqlite-vec embeddings (hybrid)** |
| 7 | Proactive behavior | Core **event bus + persistent scheduler**; assistant rules propose nudges; IPC to sprite overlay |
| 8 | Editor | **Markdown is source of truth**; TipTap (rich view) + CodeMirror 6 (source view), unified/remark serialization |
| 9 | Voice-to-text | **Local whisper.cpp** (models downloaded on demand); Win+H works as zero-code fallback |
| 10 | Media metadata | **Keyless APIs first** (AniList, TVmaze) + optional user keys (TMDB, RAWG/IGDB); each provider is a plugin; client-side calls |
| 11 | Sync | **Self-hosted Docker sync server** (later phase); per-record oplog + HLC timestamps from day one; field-level LWW, conflict copies for note bodies |
| 12 | OS scope / packaging | **Cross-platform in CI from day one, Windows-first polish**; electron-builder + electron-updater via GitHub Releases |
| 13 | Repo & testing | **pnpm monorepo**; core modules literally built as plugins; Vitest + Playwright-for-Electron |
| 14 | Command palette | Core **command registry** fed by plugin manifests (lazy activation) + dynamic providers; cmdk UI |

## Process topology

```
Electron main process ("core")
├─ Data layer: better-sqlite3 (nib.db) + attached diary.db when unlocked
├─ Permission engine + plugin host broker (RPC over MessagePorts)
├─ Event bus + persistent scheduler (nudges, recurrence materialization)
├─ Sidecar manager: llama-server (GGUF), whisper.cpp — spawned child processes
└─ Sync engine (later): pushes/pulls oplog to self-hosted server
   │
   ├─ Renderer: main window (React shell + core module UIs, trusted)
   ├─ Renderer: sprite overlay (transparent, always-on-top, click-through)
   ├─ Renderer(s): sandboxed third-party plugin hosts (no Node, per-plugin session)
   └─ WebContentsViews: third-party plugin UI panels (same sandbox/session)
```

## The stack, item by item

### 1. Desktop shell — Electron + two-window design
Electron chosen over Tauri 2 (would require custom per-OS native code for per-pixel click-through and a from-scratch plugin process model, plus Rust for core contributions) and .NET/WinUI (Windows-locked, weaker editor ecosystem).

- **Main window**: normal app window, React shell hosting module UIs.
- **Sprite overlay**: separate frameless `BrowserWindow` — `transparent: true`, `alwaysOnTop`, `skipTaskbar`, sized to the sprite's roaming region. Click-through via `setIgnoreMouseEvents(true, { forward: true })`; the renderer hit-tests the cursor against the sprite's opaque pixels and toggles interactivity so the sprite is clickable but the transparent area isn't. The type-in box is part of this window, shown above the sprite. This is the established desktop-pet pattern; capabilities are feature-flagged per OS (Linux/Wayland degrades gracefully).

### 2. Languages — TypeScript end to end
Core, UI, and plugins are all TypeScript/JavaScript — the single most approachable plugin language for outside contributors, and one toolchain for the whole monorepo. Native needs (SQLite, crypto, inference) come from prebuilt binary packages or spawned sidecars, not hand-written native code.

### 3. Local storage — SQLite + FTS5, envelope schema, oplog
Node's built-in **`node:sqlite`** (`DatabaseSync`) in the main process only; renderers and plugins access data exclusively through the data-layer API.

> **Amended during Phase 1 (2026-07-04):** the plan originally specified `better-sqlite3`, but it ships no prebuilt binary for Electron 43 (compiling one requires a full MSVC toolchain on every contributor machine, and the Node-ABI/Electron-ABI split breaks either tests or the app). Verified empirically that both Node 24 and Electron 43's bundled Node expose `node:sqlite` with FTS5 (SQLite 3.53): same synchronous API shape, zero native modules, identical engine in tests and at runtime. `node:sqlite` also supports loadable extensions (`allowExtension`), which Phase 5 needs for sqlite-vec — verify then.

- **Envelope schema**: every record from any module shares `id (uuidv7), type, title, body_md, tags[], created_at, updated_at, module_id` + a JSON `props` column for module-specific fields (recurrence rules, mood, media metadata). Plugins register their record types with a JSON Schema for `props`; the data layer validates writes.
- **Unified search**: one FTS5 table indexes `title/body/tags` across all record types → notes, tasks, and diary entries answer a single query with type facets. Tags live in a normalized table so tag queries span modules.
- **Note versions**: `versions` table storing full snapshots on save-points (debounced), diff-compacted for older history.
- **Sync-readiness**: every mutation also appends to an `oplog` table (record id, field-level patch, HLC timestamp, device id) from day one — sync bolts on later without a storage rewrite.
- **To-do recurrence**: store RFC 5545-style rules via the `rrule` library; scheduler materializes upcoming occurrences.

### 4. Diary encryption — encrypted store + per-entry layer, invisible while locked
Chosen semantics: **locked diary is invisible** to search and the assistant.

- **Whole-diary lock**: diary content lives in a *separate* database file (`diary.db`) encrypted at the file level using `better-sqlite3-multiple-ciphers` (SQLite3MultipleCiphers build). Key = Argon2id(diary password) via libsodium. The diary's own FTS index and any assistant memory derived from diary entries live *inside* this DB. Unlocking `ATTACH`es it; global search then UNIONs its FTS results. Locking detaches and zeroes keys in main-process memory; auto-lock on idle.
- **Per-entry lock**: entry body additionally encrypted app-level with XChaCha20-Poly1305, key = Argon2id(per-entry password). These entries are **never indexed anywhere** and never enter assistant memory.
- Nothing about diary contents (including its index) exists in plaintext on disk.

### 5. Plugin system — manifest + hard sandbox + brokered permissions
Chosen model: hard sandbox — the diary guarantee is enforcement, not policy.

- **Manifest** (`nib-plugin.json`): `id, name, version, minAppVersion, permissions, contributes { commands, panels, recordTypes, hooks, settings }, activationEvents`. Deliberately VS Code-shaped.
- **Execution**: each third-party plugin runs in a hidden Chromium-**sandboxed** renderer (`sandbox: true, contextIsolation: true, nodeIntegration: false`, dedicated `session` partition per plugin). No filesystem, no Node, no direct DB. A preload bridge exposes exactly one object (`nib.*`) whose calls travel over MessagePorts to the main-process broker, which validates every call against granted permissions. The Chromium sandbox is the security boundary.
- **Permissions**: declared in manifest, granted by the user at install (and revocable). Scoped like `records:read:task`, `records:write:own-types`, `events:subscribe:task.*`, `network:api.example.com`, `diary:read` (deny-by-default, extra-prominent consent UI). Network enforcement happens in main via per-plugin-session `webRequest` filtering to declared domains — a plugin cannot exfiltrate silently.
- **What plugins can register**: commands (→ palette), UI panels (rendered as `WebContentsView`s in the same sandboxed session, framework-agnostic for authors), record types + JSON Schemas (→ shared data layer, searchable/taggable automatically), event hooks (data-layer events filtered by permission), settings pages.
- **Core modules use the identical `nib.*` API and manifest format** but ship in-repo and run trusted (in-process) — same pattern, different transport. This keeps "core modules and plugins feel the same" true while third-party stays sandboxed.

### 6. AI integration — llama.cpp sidecar, BYO endpoint, hybrid memory
The owner's model is GGUF; the assistant is BYO-endpoint for everyone else.

- **Inference**: the assistant module spawns and manages `llama-server` (llama.cpp) as a child process pointed at the configured GGUF file, on a random localhost port, speaking the OpenAI-compatible API. The *contract* is "any OpenAI-compatible endpoint" — other users point Nib at Ollama/LM Studio/llama.cpp instead; process management is just a convenience adapter.
- **Memory (hybrid)**: a `facts` table (fact text, subject, source record id, module, timestamp) — this is what powers the **memory inspector** with per-fact view/delete — plus embeddings in **sqlite-vec** for fuzzy recall, generated via `llama-server`'s `/v1/embeddings` with a small embedding GGUF (e.g. nomic-embed-text). Retrieval = structured filters + vector similarity, merged. Facts sourced from diary entries live inside the encrypted diary DB (per item 4); deleting a fact deletes its vector.
- **Modes** (planning coach / quick assistant) are system-prompt + tool-scope presets stored as data, so users/plugins can add modes.
- The assistant reaches module data through the same permissioned data-layer API as plugins (it holds broad grants by default; the inspector and permission UI make that visible and revocable).

### 7. Proactive behavior — events + scheduler → sprite
- **Event bus** in core publishes every data mutation (`task.completed`, `record.created`, …) — plugins subscribe per permissions.
- **Persistent scheduler** in core (jobs survive restarts; also drives recurrence materialization and "on this day").
- The assistant registers **rule-based triggers** (task untouched N days, streak about to break, overdue plan review). Fired rules become *candidate* nudges; the local model phrases/prioritizes them; a throttle + quiet-hours policy gates delivery. Delivery is plain IPC from main to the sprite overlay window (sprite animates, speech bubble appears). No polling anywhere.

### 8. Editor — TipTap + CodeMirror over canonical Markdown
Markdown (CommonMark + GFM tables/task lists + highlights + wikilinks) is the stored format. The toggle switches two views over the same text: **TipTap** (ProseMirror) for WYSIWYG with its schema constrained 1:1 to our extension set — that constraint is what keeps round-tripping lossless — and **CodeMirror 6** for raw source. Serialization via unified/remark. Quick-switcher and tabs live in the notepad plugin; the palette (item 14) handles global switching too.

### 9. Voice-to-text — local whisper.cpp
Diary audio never leaves the machine. Spawn whisper.cpp (or use the `smart-whisper` binding — decide by maintenance state at implementation) with small/base models (75–500 MB) downloaded on first use; GPU users can select larger models. Push-to-talk in diary entries and the sprite's type-in box. Windows Win+H dictation remains a zero-code fallback.

### 10. Media metadata — keyless-first provider plugins
Each source is a plugin with `network:` permission scoped to its own domain (dogfooding the plugin API): **AniList** (anime — keyless GraphQL) and **TVmaze** (TV — keyless) work out of the box; **TMDB** (movies/richer art) and **RAWG or IGDB** (games) activate when the user pastes a free personal key. Calls are client-side; cover art is cached locally so the log stays viewable offline. Known gap: games lookup is weak until a key is added — surfaced in UI, not hidden.

### 11. Optional sync — self-hosted server, oplog-based
Ships late (Phase 7) but is designed for from day one via the oplog (item 3).

- **Server**: small Node (Hono/Fastify) + SQLite service in a single Docker container; per-user token auth; clients push/pull oplog entries. Payloads optionally end-to-end encrypted with a key derived from a sync passphrase (server never sees plaintext).
- **Conflicts**: field-level last-writer-wins using HLC timestamps for structured records; for note *bodies*, concurrent edits produce a conflict copy ("keep both") rather than silent loss — simpler and more predictable than CRDTs, and doesn't force CRDT semantics onto plugin-defined types.

### 12. Packaging & OS scope
Cross-platform (win/mac/linux) **compiles in CI from day one** (GitHub Actions matrix) so Windows-isms never bake in; only **Windows is polished and officially shipped** initially. `electron-vite` for dev/build, `electron-builder` for NSIS installer, `electron-updater` + GitHub Releases for auto-update. Code-signing deferred until the project matures.

### 13. Repo structure & testing
pnpm workspaces monorepo:

```
nib/
├─ apps/desktop           # Electron entry: electron-vite glue for main/preload/renderer
├─ packages/core          # main-process: data layer, broker, events, scheduler, crypto
├─ packages/plugin-api    # the `nib.*` types + docs — the ONLY import a plugin needs
├─ packages/shell         # React main window chrome, palette UI, settings
├─ packages/overlay       # sprite overlay renderer
├─ plugins/notepad        # core modules ARE plugins (manifest + nib.* API)
├─ plugins/todo
├─ plugins/diary
├─ plugins/assistant
├─ plugins/media-*        # metadata providers (anilist, tvmaze, tmdb, rawg)
├─ plugin-template/       # copy-me starter for third-party authors
├─ sync-server/           # later phase, Docker
└─ design/                # imported Nib Design Canvas + derived specs
```

Testing: **Vitest** for unit (data layer, permission engine, recurrence, serialization round-trip property tests), **Playwright for Electron** for E2E. ESLint + Prettier; TypeDoc published for `plugin-api`. React 19, Node 22 LTS, latest stable Electron at scaffold time.

### 14. Command palette
Core owns a **command registry**. Plugin manifests declare commands up front, so the palette lists every plugin's commands *without loading the plugin* (lazy activation on invoke — VS Code's model). Runtime-registered dynamic commands (e.g. "Open note: {title}") come from provider callbacks over RPC. Palette UI built on `cmdk` with fuzzy matching; the quick-switcher is the same registry filtered to note-switch commands.

## Phased build order

Each phase produces something the next phase plugs into.

- **Phase 0 — Foundation**: `git init`; design canvas import (after `/design-login`); `plan.md`; monorepo scaffold; CI matrix (build + test on 3 OSes); Electron shell boots an empty main window.
- **Phase 1 — Core spine** *(everything else depends on this)*: data layer (envelope schema, FTS5, versions, oplog, tags), event bus, scheduler, command registry + cmdk palette, plugin loader for **trusted in-repo plugins** (manifest parsing, `nib.*` API, permission engine in "log-only" mode).
- **Phase 2 — Notepad plugin**: proves the spine — TipTap/CodeMirror editor with lossless toggle, tabs + quick-switcher, tags, global FTS search UI, version history, **Markdown/JSON export-import for notes**.
- **Phase 3 — To-do plugin**: record types beyond text — rrule recurrence, subtasks/checklists, time-blocking day view (dnd-kit), habit streaks + milestone celebration; scheduler gets real load.
- **Phase 4 — Diary plugin + crypto**: encrypted diary.db, whole-diary + per-entry locks, invisible-while-locked search semantics, mood tags, "on this day" (scheduler), whisper.cpp voice entries, media-log with AniList/TVmaze provider plugins (first `network:` permission users).
- **Phase 5 — Assistant**: llama-server sidecar manager + BYO endpoint config, sprite overlay window (transparent/click-through), chat box, hybrid memory + **memory inspector**, modes; then proactive rules → nudge pipeline → sprite delivery.
- **Phase 6 — Third-party hardening**: sandboxed plugin renderer host, permission-grant UI (enforce mode on), per-plugin session network filtering, `plugin-template` + `plugin-api` docs published, external plugin install flow.
- **Phase 7 — Sync**: Docker sync server, client sync engine over the existing oplog, conflict copies, E2E-encryption option. Full-app JSON export/import rounds out.
- **Phase 8 — Ship**: installer, auto-update, onboarding, Windows polish pass; mac/linux go from "compiles" to "usable" as contributors appear.

## Verification

- **Unit (Vitest)**: markdown round-trip property tests (TipTap ⇄ MD ⇄ CodeMirror lossless); recurrence expansion against known RFC 5545 cases; permission engine allow/deny matrix; oplog merge/LWW cases.
- **E2E (Playwright for Electron)**: create note → appears in palette quick-switch and FTS; task + diary + note all matching one search query; version history restore; palette executes a command from an *unloaded* plugin.
- **Security checks (scripted)**: open `diary.db` raw and grep for known plaintext (must be absent, locked and unlocked-on-disk); sandboxed test plugin attempts `diary:read` without grant → denied + audit-logged; test plugin fetches an undeclared domain → blocked at session level.
- **Overlay (manual)**: sprite visible over other apps; clicks pass through transparent regions; sprite itself clickable; type-in box focuses.
- **AI (manual + fixture)**: point at llama-server with the owner's GGUF; assistant answers a question requiring notes+tasks context; memory inspector shows the derived fact; deleting it removes recall; stalled-task fixture triggers exactly one nudge at the sprite within throttle rules.
