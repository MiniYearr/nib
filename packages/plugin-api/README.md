# @nib/plugin-api

The types and helpers every Nib module builds against — the single import a
plugin needs.

- **First-party modules** (in `plugins/`) import `NibPluginModule`,
  `NibPluginContext`, and the record/manifest types directly and run trusted,
  in-process.
- **Third-party plugins** don't import this package at all — they get a runtime
  `nib` global in the sandbox that mirrors the same shapes. See
  [`docs/plugins.md`](../../docs/plugins.md) and
  [`plugin-template/`](../../plugin-template).

## Highlights

- `PluginManifest`, `validateManifest(value)` — manifest schema + validation.
- `NibRecord`, `NewRecordInput`, `RecordPatch`, `SearchHit` — the shared
  envelope every module's data lives in.
- `NibPluginContext` — the `nib.*` surface a first-party module receives at
  `activate()`: `records`, `events`, `commands`, `scheduler`, `services`,
  `searchProviders`, `log`.
- `matchesPattern(pattern, type)` — the event-pattern matcher used by the bus,
  the permission engine, and the bridges.
- `describePermission`, `isSensitivePermission`, `hostAllowed`, `networkDomains`
  — permission-scope helpers powering the install-time grant UI and the
  per-plugin network filter.

This package ships TypeScript source and is consumed across Node, DOM, and
sandbox contexts, so it stays free of environment-specific globals.
