import { expect, test } from '@playwright/test';
import { launchNib } from './helpers';

async function setupDiary(window: Awaited<ReturnType<typeof launchNib>>['window']) {
  await window.click('.nib-sidebar-module:has-text("Diary")');
  await window.getByPlaceholder('Passphrase', { exact: true }).fill('velvet lantern 9');
  await window.getByPlaceholder('Repeat passphrase').fill('velvet lantern 9');
  await window.click('button:has-text("Create diary")');
  await expect(window.locator('.nib-diary-new')).toBeVisible();
}

test('diary: setup, write, searchable unlocked, invisible locked', async () => {
  const { app, window } = await launchNib();
  await setupDiary(window);

  await window.click('.nib-diary-new');
  await window.fill('.nib-entry-title', 'Harbor thoughts');
  await window.locator('.nib-entry-title').blur();
  await window.fill('.nib-entry-body', 'The quiet harbor glowed tonight.');
  await window.locator('.nib-entry-body').blur();

  await window.keyboard.press('Control+Shift+F');
  await window.fill('.nib-search input', 'harbor');
  await expect(window.locator('.nib-search-item-title')).toHaveText('Harbor thoughts');
  await window.keyboard.press('Enter');
  await expect(window.locator('.nib-entry-title')).toHaveValue('Harbor thoughts');

  await window.click('.nib-diary-lock-btn');
  await expect(window.getByText('Diary is locked')).toBeVisible();

  await window.keyboard.press('Control+Shift+F');
  await window.fill('.nib-search input', 'harbor');
  await expect(window.locator('.nib-search-empty')).toBeVisible();
  await window.keyboard.press('Escape');

  await window.getByPlaceholder('Passphrase', { exact: true }).fill('wrong password');
  await window.click('button:has-text("Unlock")');
  await expect(window.locator('.nib-diary-error')).toHaveText('Wrong passphrase');

  await window.getByPlaceholder('Passphrase', { exact: true }).fill('velvet lantern 9');
  await window.click('button:has-text("Unlock")');
  await expect(window.locator('.nib-diary-item-title')).toHaveText('Harbor thoughts');

  await app.close();
});

test('per-entry lock seals the body behind a second passphrase', async () => {
  const { app, window } = await launchNib();
  await setupDiary(window);

  await window.click('.nib-diary-new');
  await window.fill('.nib-entry-body', 'EmeraldMarker deepest feelings');
  await window.locator('.nib-entry-body').blur();

  await window.click('button:has-text("Lock entry")');
  await window.getByPlaceholder('Entry passphrase').fill('inner sanctum');
  await window.click('button:has-text("Seal body")');
  await expect(window.locator('.nib-entry-sealed')).toBeVisible();

  await window.keyboard.press('Control+Shift+F');
  await window.fill('.nib-search input', 'EmeraldMarker');
  await expect(window.locator('.nib-search-empty')).toBeVisible();
  await window.keyboard.press('Escape');

  await window.getByPlaceholder('Entry passphrase').fill('not the password');
  await window.click('button:has-text("Reveal")');
  await expect(window.locator('.nib-entry-sealed .nib-diary-error')).toHaveText(
    'Wrong entry passphrase',
  );

  await window.getByPlaceholder('Entry passphrase').fill('inner sanctum');
  await window.click('button:has-text("Reveal")');
  await expect(window.locator('.nib-entry-revealed')).toContainText(
    'EmeraldMarker deepest feelings',
  );

  await app.close();
});
