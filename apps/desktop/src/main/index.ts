import { app, BrowserWindow, Menu, shell } from 'electron';
import { join } from 'node:path';
import { createCore, type NibCore } from '@nib/core';
import assistantPlugin from '@nib/plugin-assistant';
import diaryPlugin from '@nib/plugin-diary';
import anilistPlugin from '@nib/plugin-media-anilist';
import tvmazePlugin from '@nib/plugin-media-tvmaze';
import notepadPlugin from '@nib/plugin-notepad';
import todoPlugin from '@nib/plugin-todo';
import samplePlugin from '@nib/plugin-sample';
import { trustedContents } from './broadcast';
import { registerCoreCommands } from './core-commands';
import { registerIpc } from './ipc';
import { ThirdPartyPluginHost } from './plugin-host';
import { runSmokeTest } from './smoke';
import { registerWindowControls, wireMaximizeEvents } from './window-controls';

let core: NibCore | undefined;
let pluginHost: ThirdPartyPluginHost | undefined;

const firstPartyPlugins = [
  notepadPlugin,
  todoPlugin,
  diaryPlugin,
  assistantPlugin,
  anilistPlugin,
  tvmazePlugin,
  samplePlugin,
];

const userDataOverride = process.env['NIB_USER_DATA'];
if (userDataOverride) app.setPath('userData', userDataOverride);

// No native application menu — the app owns its chrome (custom title bar).
Menu.setApplicationMenu(null);

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: '#FBFAF7',
    title: 'Nib',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Capture the id up front — reading window.webContents after 'closed' throws
  // ("Object has been destroyed") and would wedge app shutdown.
  const contentsId = window.webContents.id;
  trustedContents.add(contentsId);
  wireMaximizeEvents(window);
  window.on('closed', () => {
    trustedContents.delete(contentsId);
    // The main window is the app: closing it quits. Tear down hidden plugin
    // windows first so nothing keeps the process alive.
    pluginHost?.stopAll();
    if (process.platform !== 'darwin') app.quit();
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
  registerWindowControls();

  const result = await core.loadPlugins(firstPartyPlugins);
  for (const failure of result.errors) {
    console.error(`[nib] plugin "${failure.pluginId}" failed to load`, failure.error);
  }
  core.start();

  if (process.env['NIB_SMOKE'] === '1') {
    await runSmokeTest(core);
    return;
  }

  pluginHost = new ThirdPartyPluginHost(core, app.getPath('userData'));
  pluginHost.setFirstParty(
    firstPartyPlugins.map((plugin) => ({
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      description: plugin.manifest.description,
      permissions: plugin.manifest.permissions,
    })),
  );
  pluginHost.registerIpc();
  pluginHost.startEnabled();

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  pluginHost?.stopAll();
  pluginHost = undefined;
  core?.dispose();
  core = undefined;
});
