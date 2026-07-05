import { contextBridge, ipcRenderer } from 'electron';
import type { NibEvent, NibWindowApi } from '@nib/plugin-api';

// Inlined (not imported) so this sandboxed preload stays a single self-contained
// CJS file — sandboxed preloads cannot require() split chunks.
function matchesPattern(pattern: string, type: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) return type.startsWith(pattern.slice(0, -1));
  return pattern === type;
}

type Listener = { pattern: string; fn: (event: NibEvent) => void };
const listeners = new Set<Listener>();

ipcRenderer.on('nib:event', (_ipcEvent, event: NibEvent) => {
  for (const listener of [...listeners]) {
    if (matchesPattern(listener.pattern, event.type)) listener.fn(event);
  }
});

const api: NibWindowApi = {
  commands: {
    list: () => ipcRenderer.invoke('nib:commands.list'),
    execute: (id) => ipcRenderer.invoke('nib:commands.execute', id),
  },
  search: (query) => ipcRenderer.invoke('nib:search', query),
  records: {
    list: (options) => ipcRenderer.invoke('nib:records.list', options),
    get: (id) => ipcRenderer.invoke('nib:records.get', id),
    create: (moduleId, input) => ipcRenderer.invoke('nib:records.create', moduleId, input),
    update: (moduleId, id, patch) => ipcRenderer.invoke('nib:records.update', moduleId, id, patch),
    softDelete: (moduleId, id) => ipcRenderer.invoke('nib:records.softDelete', moduleId, id),
    listVersions: (recordId) => ipcRenderer.invoke('nib:records.listVersions', recordId),
    getVersion: (versionId) => ipcRenderer.invoke('nib:records.getVersion', versionId),
    restoreVersion: (moduleId, recordId, versionId) =>
      ipcRenderer.invoke('nib:records.restoreVersion', moduleId, recordId, versionId),
    listTags: () => ipcRenderer.invoke('nib:records.listTags'),
  },
  events: {
    on: (pattern, fn) => {
      const listener: Listener = { pattern, fn };
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: (moduleId, type, payload) => {
      void ipcRenderer.invoke('nib:events.emit', moduleId, type, payload);
    },
  },
  services: {
    call: (serviceId, payload) => ipcRenderer.invoke('nib:services.call', serviceId, payload),
  },
  win: {
    minimize: () => void ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => void ipcRenderer.invoke('window:toggle-maximize'),
    close: () => void ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
    onMaximizeChange: (handler) => {
      const listener = (_event: unknown, maximized: boolean) => handler(maximized);
      ipcRenderer.on('window:maximized-changed', listener);
      return () => ipcRenderer.removeListener('window:maximized-changed', listener);
    },
  },
  invoke: (channel, ...args) => {
    if (!/^nib\.[a-z0-9-]+:[a-zA-Z0-9.-]+$/.test(channel)) {
      return Promise.reject(new Error(`invalid module channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  runtime: {
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
  },
};

contextBridge.exposeInMainWorld('nib', api);
