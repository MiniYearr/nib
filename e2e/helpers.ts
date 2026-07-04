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

/**
 * Launches the built app against an isolated data dir. The sprite overlay is
 * disabled by default so single-window suites stay simple — assistant specs
 * use launchNibWithOverlay.
 */
export async function launchNib(
  userData?: string,
  extraEnv: Record<string, string> = {},
): Promise<LaunchedApp> {
  const dataDir = userData ?? mkdtempSync(join(tmpdir(), 'nib-e2e-'));
  const app = await electron.launch({
    executablePath: require('electron') as unknown as string,
    args: [desktopDir],
    env: { ...process.env, NIB_USER_DATA: dataDir, NIB_NO_OVERLAY: '1', ...extraEnv },
  });
  const window = await app.firstWindow();
  // React must be mounted (sidebar rendered) before tests send global shortcuts,
  // otherwise keydown listeners are not attached yet and the key press is lost.
  await window.locator('.nib-sidebar').waitFor();
  return { app, window, userData: dataDir };
}

export interface LaunchedAppWithOverlay {
  app: ElectronApplication;
  main: Page;
  overlay: Page;
  userData: string;
}

export async function launchNibWithOverlay(
  extraEnv: Record<string, string> = {},
): Promise<LaunchedAppWithOverlay> {
  const dataDir = mkdtempSync(join(tmpdir(), 'nib-e2e-'));
  const app = await electron.launch({
    executablePath: require('electron') as unknown as string,
    args: [desktopDir],
    env: { ...process.env, NIB_USER_DATA: dataDir, ...extraEnv },
  });

  let main: Page | undefined;
  let overlay: Page | undefined;
  const deadline = Date.now() + 15_000;
  while ((!main || !overlay) && Date.now() < deadline) {
    for (const page of app.windows()) {
      const url = page.url();
      if (url.includes('overlay')) overlay = page;
      else if (url.includes('index')) main = page;
    }
    if (!main || !overlay) await new Promise((r) => setTimeout(r, 200));
  }
  if (!main || !overlay) throw new Error('expected both main and overlay windows');

  await main.locator('.nib-sidebar').waitFor();
  await overlay.locator('.nib-sprite').waitFor();
  return { app, main, overlay, userData: dataDir };
}
