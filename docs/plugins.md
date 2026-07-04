# Writing Nib plugins

Nib is built entirely out of plugins — the notepad, to-do, diary, and assistant
are the same kind of module a third-party developer writes. This guide covers
**third-party plugins**, which run in a hard sandbox.

## Anatomy

A plugin is a folder containing:

- **`nib-plugin.json`** — the manifest.
- **`main.js`** — plain JavaScript (no build step, no imports) that runs in the
  sandbox and uses the global `nib` object.

Start from [`plugin-template/`](../plugin-template).

## Manifest

```jsonc
{
  "id": "com.example.my-plugin",     // reverse-domain, unique
  "name": "My Plugin",
  "version": "1.0.0",                 // semver
  "minAppVersion": "0.1.0",
  "description": "What it does.",
  "author": "You",
  "permissions": ["records:read:note"],
  "contributes": {
    "commands": [{ "id": "do-thing", "title": "My Plugin: do the thing" }]
  }
}
```

## Permissions

Permissions are colon-separated scopes. The user reviews and grants them at
install; **sensitive ones are off by default**.

| Scope | Grants |
|-------|--------|
| `records:read:<type>` | Read records of a type (`note`, `task`, …) |
| `records:write:<type>` | Create/edit/delete records of a type *(sensitive)* |
| `records:read:*` | Read every record type *(sensitive)* |
| `events:subscribe:<pattern>` | Receive events (`record.*`, `nib.todo.milestone`, …) |
| `network:<domain>` | Make network requests to a domain and its subdomains *(sensitive)* |
| `scheduler` | Schedule background jobs |
| `services:call:<id>` | Call another plugin's service |
| `diary:read` | *(sensitive — deny unless fully trusted)* |

The sandbox is the real boundary: an ungranted call is denied, and network
requests to undeclared domains are blocked at the session level. The diary lives
in its own encrypted store outside the shared data layer, so a plugin cannot
reach it regardless.

## The `nib` API

Every method returns a `Promise`.

```js
// Records (the shared data layer)
await nib.records.list({ type: 'note' });      // -> NibRecord[]
await nib.records.get(id);                       // -> NibRecord | undefined
await nib.records.create({ type: 'note', title: 'Hi', bodyMd: '', tags: [] });
await nib.records.update(id, { title: 'Renamed' });
await nib.records.softDelete(id);
await nib.records.search('query', { types: ['note'] });

// Commands (appear in the ⌘K palette)
nib.commands.register('do-thing', 'My Plugin: do the thing', async () => { /* ... */ });

// Events
const off = nib.events.on('record.created', (event) => { /* event.type, event.payload */ });
nib.events.emit('com.example.my-plugin.something', { any: 'payload' }); // must be namespaced

// Logging (shows in the app's console)
nib.log('hello from my plugin');
```

## A record

```ts
interface NibRecord {
  id: string;
  type: string;        // "note", "task", "diary-entry", or your own
  moduleId: string;    // who created it
  title: string;
  bodyMd: string;      // Markdown body
  props: Record<string, unknown>;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
```

Records you create are searchable, taggable, and versioned like any built-in
module's data — that's what makes a plugin "feel native."
