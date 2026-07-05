import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const desktopDir = resolve(process.cwd(), 'apps', 'desktop');
const require = createRequire(join(desktopDir, 'package.json'));

export interface LaunchedApp {
  app: ElectronApplication;
  window: Page;
  userData: string;
}

/** Launches the built app (single window) against an isolated data dir. */
export async function launchNib(
  userData?: string,
  extraEnv: Record<string, string> = {},
): Promise<LaunchedApp> {
  const dataDir = userData ?? mkdtempSync(join(tmpdir(), 'nib-e2e-'));
  const app = await electron.launch({
    executablePath: require('electron') as unknown as string,
    args: [desktopDir],
    env: { ...process.env, NIB_USER_DATA: dataDir, ...extraEnv },
  });
  const window = await app.firstWindow();
  // React must be mounted (sidebar rendered) before tests send global shortcuts,
  // otherwise keydown listeners are not attached yet and the key press is lost.
  await window.locator('.nib-sidebar').waitFor();
  return { app, window, userData: dataDir };
}
