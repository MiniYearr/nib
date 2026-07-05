import { expect, test } from '@playwright/test';
import { launchNib } from './helpers';

test('creates a task, renames it, and completes it', async () => {
  const { app, window } = await launchNib();

  await window.click('.nib-sidebar-module:has-text("To-do")');
  await window.click('.nib-task-add');

  await expect(window.locator('.nib-task-detail')).toBeVisible();
  await window.fill('.nib-task-detail-title', 'Water the plants');
  await window.locator('.nib-task-detail-title').blur();

  const row = window.locator('.nib-task-card', { hasText: 'Water the plants' });
  await expect(row).toBeVisible();

  await row.locator('input[type="checkbox"]').click();
  await expect(row.locator('.nib-task-title')).toHaveAttribute('data-done', 'true');

  await app.close();
});

test('a daily habit shows its recurrence and starts a streak', async () => {
  const { app, window } = await launchNib();

  await window.click('.nib-sidebar-module:has-text("To-do")');
  await window.click('.nib-task-add');
  await window.fill('.nib-task-detail-title', 'Morning stretch');
  await window.locator('.nib-task-detail-title').blur();

  await window.locator('.nib-recur select').first().selectOption('daily');
  await expect(window.locator('.nib-recur-text')).toContainText('every day');
  const habitToggle = window.locator('.nib-task-detail-habit input');
  await habitToggle.click();
  await expect(habitToggle).toBeChecked();

  const row = window.locator('.nib-task-card', { hasText: 'Morning stretch' });
  await expect(row.locator('.nib-task-chip', { hasText: 'Every day' })).toBeVisible();

  await row.locator('input[type="checkbox"]').click();
  await expect(row.locator('.nib-task-chip-streak')).toHaveText('1');

  await app.close();
});

test('tasks and search work across modules', async () => {
  const { app, window } = await launchNib();

  await window.click('.nib-sidebar-module:has-text("To-do")');
  await window.click('.nib-task-add');
  await window.fill('.nib-task-detail-title', 'Refill the aquarium');
  await window.locator('.nib-task-detail-title').blur();

  await window.keyboard.press('Control+Shift+F');
  await window.fill('.nib-search input', 'aquarium');
  await expect(window.locator('.nib-search-item-title')).toHaveText('Refill the aquarium');
  await window.keyboard.press('Enter');

  // Search routes the task to the to-do module and opens its detail panel.
  await expect(window.locator('.nib-task-detail-title')).toHaveValue('Refill the aquarium');

  await app.close();
});
