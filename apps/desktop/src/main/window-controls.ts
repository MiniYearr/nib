import { BrowserWindow, ipcMain } from 'electron';

/**
 * Window control IPC for the frameless custom title bar. The renderer draws the
 * min/maximize/close buttons and calls these; we push maximize state back so
 * the maximize/restore icon can stay in sync.
 */
export function registerWindowControls(): void {
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle('window:is-maximized', (event) =>
    Boolean(BrowserWindow.fromWebContents(event.sender)?.isMaximized()),
  );
}

/** Emit maximize-state changes to a window so its title bar icon updates. */
export function wireMaximizeEvents(window: BrowserWindow): void {
  const send = () => {
    if (!window.isDestroyed()) {
      window.webContents.send('window:maximized-changed', window.isMaximized());
    }
  };
  window.on('maximize', send);
  window.on('unmaximize', send);
}
