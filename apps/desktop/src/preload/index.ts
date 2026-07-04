import { contextBridge, ipcRenderer } from 'electron';
import { matchesPattern, type NibEvent, type NibWindowApi } from '@nib/plugin-api';

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
  events: {
    on: (pattern, fn) => {
      const listener: Listener = { pattern, fn };
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  },
  runtime: {
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
  },
};

contextBridge.exposeInMainWorld('nib', api);
