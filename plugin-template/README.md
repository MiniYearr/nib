# Nib plugin template

A copy-me starting point for a third-party Nib plugin. A plugin is just a folder
with two files:

| File | What it is |
|------|------------|
| `nib-plugin.json` | The manifest — id, version, requested permissions, contributed commands |
| `main.js` | Plain JavaScript that runs in a sandbox and talks to the app via the global `nib` |

## Try it

1. Copy this folder somewhere.
2. In Nib, open **Plugins → Install plugin** and pick the folder.
3. Review the permissions it asks for and turn on the ones you're comfortable
   with (sensitive ones are off by default), then click **Enable**.
4. Open the command palette (`Ctrl/Cmd+K`) and run **Word Count: tally words in
   all notes**.

## The sandbox

Your plugin runs in an isolated process with **no Node, no filesystem, and no
network access** unless you declare a `network:<domain>` permission and the user
grants it. Every call through `nib` is checked against the permissions actually
granted — a plugin literally cannot read data it wasn't given, including the
encrypted diary.

See [`docs/plugins.md`](../docs/plugins.md) for the full API and permission
reference.
