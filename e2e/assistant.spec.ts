import { expect, test } from '@playwright/test';
import { FAKE_FACT, FAKE_REPLY, startFakeAi } from './fake-ai';
import { launchNibWithOverlay } from './helpers';

test('sprite chat streams a reply and the fact lands in the memory inspector', async () => {
  const ai = await startFakeAi();
  const { app, main, overlay } = await launchNibWithOverlay({ NIB_AI_ENDPOINT: ai.baseUrl });

  try {
    await overlay.locator('.nib-sprite').click({ force: true });
    await expect(overlay.locator('.nib-chat')).toBeVisible();
    await expect(overlay.locator('.nib-chat-status')).toHaveText('● connected');

    await overlay.fill('.nib-chat-input input', 'Hello there, remember me');
    await overlay.keyboard.press('Enter');
    await expect(overlay.locator('.nib-chat-msg[data-role="assistant"]')).toHaveText(FAKE_REPLY);

    await main.click('.nib-sidebar-module:has-text("Assistant")');
    await expect(main.locator('.nib-fact-text')).toContainText(FAKE_FACT);

    await main.click('.nib-fact button');
    await expect(main.locator('.nib-assistant-empty')).toBeVisible();
  } finally {
    await app.close();
    ai.close();
  }
});

test('chat without a model shows a friendly error instead of hanging', async () => {
  const { app, overlay } = await launchNibWithOverlay({
    NIB_AI_ENDPOINT: 'http://127.0.0.1:9/v1',
  });
  try {
    await overlay.locator('.nib-sprite').click({ force: true });
    await overlay.fill('.nib-chat-input input', 'anyone home?');
    await overlay.keyboard.press('Enter');
    await expect(overlay.locator('.nib-chat-msg[data-role="error"]')).toContainText(
      /No model connected|failed/i,
    );
  } finally {
    await app.close();
  }
});
