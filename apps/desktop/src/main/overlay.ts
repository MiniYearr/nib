import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';

const OVERLAY_HEIGHT = 420;

/**
 * The sprite's roaming strip: a transparent, always-on-top, click-through
 * window along the bottom of the work area. The renderer hit-tests forwarded
 * mouse moves and asks us to re-enable input only over the sprite/chat.
 */
export function createOverlayWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();

  const overlay = new BrowserWindow({
    x: workArea.x,
    y: workArea.y + workArea.height - OVERLAY_HEIGHT,
    width: workArea.width,
    height: OVERLAY_HEIGHT,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    show: false,
    title: 'Nib Sprite',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.once('ready-to-show', () => overlay.showInactive());

  ipcMain.handle('nib.overlay:set-interactive', (_event, interactive: unknown) => {
    if (!overlay.isDestroyed()) {
      overlay.setIgnoreMouseEvents(!interactive, { forward: true });
    }
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    void overlay.loadURL(`${rendererUrl}/overlay.html`);
  } else {
    void overlay.loadFile(join(__dirname, '../renderer/overlay.html'));
  }

  return overlay;
}
