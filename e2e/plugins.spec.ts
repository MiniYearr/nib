import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { launchNib } from './helpers';

const FIXTURE = resolve(process.cwd(), 'e2e', 'fixtures', 'test-plugin');

async function runCommand(window: Awaited<ReturnType<typeof launchNib>>['window'], title: string) {
  await window.keyboard.press('Control+K');
  await expect(window.locator('.nib-palette')).toBeVisible();
  await window.keyboard.type(title);
  await window.locator('[cmdk-item]', { hasText: title }).first().click();
}

test('a sandboxed plugin can be installed, granted, and run within its permissions', async () => {
  // The fixture is installed (not enabled) at boot via NIB_INSTALL_PLUGIN.
  const { app, window } = await launchNib(undefined, { NIB_INSTALL_PLUGIN: FIXTURE });

  await window.click('.nib-sidebar-module:has-text("Plugins")');
  const card = window.locator('.nib-plugin-card', { hasText: 'Sandbox Probe' });
  await expect(card).toBeVisible();

  // The requested diary:read permission is sensitive and off by default.
  const diaryPerm = card.locator('.nib-plugin-perm', { hasText: 'diary' });
  await expect(diaryPerm.locator('input')).not.toBeChecked();

  // Grant note write (already on as non-sensitive? write is sensitive → ensure on).
  const noteWrite = card.locator('.nib-plugin-perm', { hasText: 'Create, edit and delete “note”' });
  if (!(await noteWrite.locator('input').isChecked())) await noteWrite.locator('input').click();

  await card.locator('.nib-plugin-toggle').click();
  await expect(card.locator('.nib-plugin-toggle')).toHaveText('Enabled');

  // Granted action: the plugin writes a note that shows up in the notepad.
  await runCommand(window, 'Probe: write an allowed note');
  await window.click('.nib-sidebar-module:has-text("Notepad")');
  await window.keyboard.press('Control+P');
  await expect(
    window.locator('[cmdk-item]', { hasText: 'Note from the sandbox' }),
  ).toBeVisible();
  await window.keyboard.press('Escape');

  // Forbidden action: task write was never granted, so it is denied — and the
  // plugin proves it by writing a "BLOCKED" note instead of a task.
  await runCommand(window, 'Probe: attempt a forbidden write');
  await window.keyboard.press('Control+Shift+F');
  await window.fill('.nib-search input', 'BLOCKED');
  await expect(window.locator('.nib-search-item-title')).toHaveText('BLOCKED: task write was denied');

  // And no task record was ever created.
  await window.fill('.nib-search input', 'should never exist');
  await expect(window.locator('.nib-search-empty')).toBeVisible();
  await window.fill('.nib-search input', 'LEAK');
  await expect(window.locator('.nib-search-empty')).toBeVisible();

  await app.close();
});
