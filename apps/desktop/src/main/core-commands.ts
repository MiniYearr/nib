import { app, BrowserWindow } from 'electron';
import type { NibCore } from '@nib/core';

export function registerCoreCommands(core: NibCore): void {
  const targetWindow = (): BrowserWindow | undefined =>
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];

  core.commands.register({
    id: 'nib.core.reload-window',
    title: 'Reload window',
    category: 'Nib',
    moduleId: 'nib.core',
    run: () => targetWindow()?.webContents.reload(),
  });

  core.commands.register({
    id: 'nib.core.toggle-devtools',
    title: 'Toggle developer tools',
    category: 'Nib',
    moduleId: 'nib.core',
    run: () => targetWindow()?.webContents.toggleDevTools(),
  });

  core.commands.register({
    id: 'nib.core.quit',
    title: 'Quit Nib',
    category: 'Nib',
    moduleId: 'nib.core',
    run: () => app.quit(),
  });
}
