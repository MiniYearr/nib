import { expect, test } from '@playwright/test';
import { launchNib } from './helpers';

test('dark mode toggles from the customize modal and persists across relaunch', async () => {
  const first = await launchNib();
  await first.window.click('.nib-titlebar [title="Customize Nib"]');
  await expect(first.window.locator('.nib-settings-modal')).toBeVisible();
  await first.window.click('.nib-theme-toggle button:has-text("Dark")');
  await expect(first.window.locator('html')).toHaveAttribute('data-theme', 'dark');
  await first.window.keyboard.press('Escape');
  await first.app.close();

  const second = await launchNib(first.userData);
  await expect(second.window.locator('html')).toHaveAttribute('data-theme', 'dark');
  await second.app.close();
});

test('the sidebar collapses to an icon rail from the title bar', async () => {
  const { app, window } = await launchNib();
  await expect(window.locator('.nib-sidebar')).toHaveAttribute('data-collapsed', 'false');
  await window.click('.nib-titlebar [title="Toggle sidebar"]');
  await expect(window.locator('.nib-sidebar')).toHaveAttribute('data-collapsed', 'true');
  // Module icons remain reachable while collapsed.
  await expect(window.locator('.nib-sidebar-module').first()).toBeVisible();
  await app.close();
});
