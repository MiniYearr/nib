import { expect, test } from '@playwright/test';
import { FAKE_FACT, FAKE_REPLY, startFakeAi } from './fake-ai';
import { launchNib } from './helpers';

test('the in-window sprite pops from the dock, chats, and the fact lands in memory', async () => {
  const ai = await startFakeAi();
  const { app, window } = await launchNib(undefined, { NIB_AI_ENDPOINT: ai.baseUrl });

  try {
    // Nib starts docked in the sidebar (not wandering). Click the dock to pop it out.
    await expect(window.locator('.nib-stage')).toHaveCount(0);
    await window.click('.nib-dock');
    await expect(window.locator('.nib-stage .nib-sprite')).toBeVisible();

    // Left-click the sprite opens the chat.
    await window.locator('.nib-stage .nib-sprite').click({ force: true });
    await expect(window.locator('.nib-chat')).toBeVisible();
    await expect(window.locator('.nib-chat-status')).toHaveText('● connected');

    await window.fill('.nib-chat-input input', 'Hello there, remember me');
    await window.keyboard.press('Enter');
    await expect(window.locator('.nib-chat-msg[data-role="assistant"]')).toHaveText(FAKE_REPLY);

    await window.click('.nib-sidebar-module:has-text("Assistant")');
    await expect(window.locator('.nib-fact-text')).toContainText(FAKE_FACT);
    await window.click('.nib-fact button');
    await expect(window.locator('.nib-assistant-empty')).toBeVisible();
  } finally {
    await app.close();
    ai.close();
  }
});

test('right-clicking the wandering sprite sends it back to the dock', async () => {
  const { app, window } = await launchNib();
  try {
    await window.click('.nib-dock');
    await expect(window.locator('.nib-stage .nib-sprite')).toBeVisible();
    await window.locator('.nib-stage .nib-sprite').click({ force: true, button: 'right' });
    await expect(window.locator('.nib-stage')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('chat without a model shows a friendly error instead of hanging', async () => {
  const { app, window } = await launchNib(undefined, { NIB_AI_ENDPOINT: 'http://127.0.0.1:9/v1' });
  try {
    await window.click('.nib-dock');
    await window.locator('.nib-stage .nib-sprite').click({ force: true });
    await window.fill('.nib-chat-input input', 'anyone home?');
    await window.keyboard.press('Enter');
    await expect(window.locator('.nib-chat-msg[data-role="error"]')).toContainText(
      /No model connected|failed/i,
    );
  } finally {
    await app.close();
  }
});
