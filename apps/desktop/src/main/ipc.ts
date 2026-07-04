import { ipcMain, webContents } from 'electron';
import type { NibCore } from '@nib/core';

export function registerIpc(core: NibCore): void {
  ipcMain.handle('nib:commands.list', () => core.commands.list());
  ipcMain.handle('nib:commands.execute', (_event, id: unknown) =>
    core.commands.execute(String(id)),
  );
  ipcMain.handle('nib:search', (_event, query: unknown) => core.data.search(String(query)));

  core.bus.on('*', (event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send('nib:event', event);
    }
  });
}
