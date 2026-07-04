import { contextBridge, ipcRenderer } from 'electron';
import type { NibEvent } from '@nib/plugin-api';
import {
  PLUGIN_EVENT,
  PLUGIN_INVOKE_COMMAND,
  PLUGIN_RPC_CHANNEL,
} from '../main/plugin-shared';

// Inlined so this sandboxed preload stays a single self-contained CJS file.
function matchesPattern(pattern: string, type: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) return type.startsWith(pattern.slice(0, -1));
  return pattern === type;
}

/**
 * The ENTIRE surface a sandboxed third-party plugin can touch. No Node, no
 * require, no direct DB or filesystem — every call is an async RPC the
 * main-process broker validates against the permissions the user granted.
 */

const commandCallbacks = new Map<string, () => void | Promise<void>>();
const eventHandlers = new Set<{ pattern: string; fn: (event: NibEvent) => void }>();

ipcRenderer.on(PLUGIN_INVOKE_COMMAND, (_event, id: string) => {
  void commandCallbacks.get(id)?.();
});

ipcRenderer.on(PLUGIN_EVENT, (_event, nibEvent: NibEvent) => {
  for (const handler of [...eventHandlers]) {
    if (matchesPattern(handler.pattern, nibEvent.type)) handler.fn(nibEvent);
  }
});

const rpc = (method: string, payload?: unknown): Promise<unknown> =>
  ipcRenderer.invoke(PLUGIN_RPC_CHANNEL, method, payload);

contextBridge.exposeInMainWorld('nib', {
  records: {
    list: (options?: unknown) => rpc('records.list', options),
    get: (id: string) => rpc('records.get', id),
    create: (input: unknown) => rpc('records.create', input),
    update: (id: string, patch: unknown) => rpc('records.update', { id, patch }),
    softDelete: (id: string) => rpc('records.softDelete', id),
    search: (query: string, options?: unknown) => rpc('records.search', { query, options }),
  },
  commands: {
    register(id: string, title: string, run: () => void | Promise<void>) {
      commandCallbacks.set(id, run);
      return rpc('commands.register', { id, title });
    },
  },
  events: {
    on(pattern: string, fn: (event: NibEvent) => void) {
      const handler = { pattern, fn };
      eventHandlers.add(handler);
      void rpc('events.on', { pattern });
      return () => eventHandlers.delete(handler);
    },
    emit: (type: string, payload: unknown) => rpc('events.emit', { type, payload }),
  },
  log: (...parts: unknown[]) => rpc('log', parts.map(String).join(' ')),
});
