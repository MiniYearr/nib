import { ipcMain, webContents } from 'electron';
import type { NibCore } from '@nib/core';

export function registerIpc(core: NibCore): void {
  ipcMain.handle('nib:commands.list', () => core.commands.list());
  ipcMain.handle('nib:commands.execute', (_event, id: unknown) =>
    core.commands.execute(String(id)),
  );
  ipcMain.handle('nib:search', (_event, query: unknown) => core.data.search(String(query)));

  ipcMain.handle('nib:records.list', (_event, options) => core.data.list(options));
  ipcMain.handle('nib:records.get', (_event, id: string) => core.data.get(id));
  ipcMain.handle('nib:records.create', (_event, moduleId: string, input) =>
    core.data.create(moduleId, input),
  );
  ipcMain.handle('nib:records.update', (_event, moduleId: string, id: string, patch) =>
    core.data.update(moduleId, id, patch),
  );
  ipcMain.handle('nib:records.softDelete', (_event, moduleId: string, id: string) =>
    core.data.softDelete(moduleId, id),
  );
  ipcMain.handle('nib:records.listVersions', (_event, recordId: string) =>
    core.data.listVersions(recordId),
  );
  ipcMain.handle('nib:records.getVersion', (_event, versionId: number) =>
    core.data.getVersion(versionId),
  );
  ipcMain.handle(
    'nib:records.restoreVersion',
    (_event, moduleId: string, recordId: string, versionId: number) =>
      core.data.restoreVersion(moduleId, recordId, versionId),
  );
  ipcMain.handle('nib:records.listTags', () => core.data.listTags());

  core.bus.on('*', (event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send('nib:event', event);
    }
  });
}
