import { expect, test } from '@playwright/test';
import { launchNib } from './helpers';

test('boots the shell with the notepad module active', async () => {
  const { app, window } = await launchNib();
  await expect(window).toHaveTitle('Nib');
  await expect(window.locator('.nib-sidebar-module', { hasText: 'Notepad' })).toBeVisible();
  await expect(window.locator('.nib-notepad-empty')).toBeVisible();
  await app.close();
});

test('creates a note, edits it, toggles source view, and finds it in search', async () => {
  const { app, window } = await launchNib();

  await window.click('.nib-notepad-new');
  await window.fill('.nib-note-title', 'Phoenix plan');
  await window.click('.nib-rich-editor .ProseMirror');
  await window.keyboard.type('Rise from the ashes');

  await expect(window.locator('.nib-notepad-tab-title')).toHaveText('Phoenix plan');

  await window.click('.nib-tb-modes button:has-text("Markdown")');
  await expect(window.locator('.nib-source-editor')).toContainText('Rise from the ashes');

  await window.keyboard.press('Control+Shift+F');
  await window.fill('.nib-search input', 'ashes');
  await expect(window.locator('.nib-search-item-title')).toHaveText('Phoenix plan');
  await window.keyboard.press('Enter');
  await expect(window.locator('.nib-search-backdrop')).toHaveCount(0);
  await expect(window.locator('.nib-note-title')).toHaveValue('Phoenix plan');

  await app.close();
});

test('command palette executes a plugin command end to end', async () => {
  const { app, window } = await launchNib();

  await window.keyboard.press('Control+K');
  await expect(window.locator('.nib-palette')).toBeVisible();
  await window.keyboard.type('Create sample note');
  await window.keyboard.press('Enter');

  // The sample plugin writes a real record; the notepad module does not own
  // it visually, so verify through global search.
  await window.keyboard.press('Control+Shift+F');
  await window.fill('.nib-search input', 'sample');
  await expect(window.locator('.nib-search-item-title').first()).toContainText('Sample note');

  await app.close();
});

test('notes persist across app relaunches', async () => {
  const first = await launchNib();
  await first.window.click('.nib-notepad-new');
  await first.window.fill('.nib-note-title', 'Survivor');
  await first.window.click('.nib-rich-editor .ProseMirror');
  await first.window.keyboard.type('Still here after restart');
  await expect(first.window.locator('.nib-notepad-tab-title')).toHaveText('Survivor');
  await first.app.close();

  const second = await launchNib(first.userData);
  await second.window.keyboard.press('Control+P');
  await expect(second.window.locator('[cmdk-item]', { hasText: 'Survivor' })).toBeVisible();
  await second.window.keyboard.press('Enter');
  await expect(second.window.locator('.nib-note-title')).toHaveValue('Survivor');
  await expect(second.window.locator('.nib-rich-editor')).toContainText(
    'Still here after restart',
  );
  await second.app.close();
});
