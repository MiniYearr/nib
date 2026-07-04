import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { createCore, type NibCore } from '@nib/core';
import diaryPlugin from '@nib/plugin-diary';
import anilistPlugin from '@nib/plugin-media-anilist';
import tvmazePlugin from '@nib/plugin-media-tvmaze';
import notepadPlugin from '@nib/plugin-notepad';
import todoPlugin from '@nib/plugin-todo';
import samplePlugin from '@nib/plugin-sample';
import { registerCoreCommands } from './core-commands';
import { registerIpc } from './ipc';
import { runSmokeTest } from './smoke';

let core: NibCore | undefined;

const userDataOverride = process.env['NIB_USER_DATA'];
if (userDataOverride) app.setPath('userData', userDataOverride);

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#FBFAF7',
    title: 'Nib',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(async () => {
  core = createCore({ dbPath: join(app.getPath('userData'), 'nib.db') });
  registerIpc(core);
  registerCoreCommands(core);

  const result = await core.loadPlugins([
    notepadPlugin,
    todoPlugin,
    diaryPlugin,
    anilistPlugin,
    tvmazePlugin,
    samplePlugin,
  ]);
  for (const failure of result.errors) {
    console.error(`[nib] plugin "${failure.pluginId}" failed to load`, failure.error);
  }
  core.start();

  if (process.env['NIB_SMOKE'] === '1') {
    await runSmokeTest(core);
    return;
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  core?.dispose();
  core = undefined;
});
