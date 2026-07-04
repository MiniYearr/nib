import { app } from 'electron';
import type { NibCore } from '@nib/core';

/**
 * End-to-end self-check used by `NIB_SMOKE=1 pnpm dev` until Playwright E2E
 * lands with the notepad module: exercises command execution, the data layer,
 * and FTS through the same code paths the palette uses, then quits.
 */
export async function runSmokeTest(core: NibCore): Promise<void> {
  try {
    await core.commands.execute('nib.sample.create-sample-note');
    const hits = core.data.search('sample');
    const commandCount = core.commands.list().length;
    console.log(
      `[nib:smoke] commands=${commandCount} searchHits=${hits.length} ` +
        `firstHit=${JSON.stringify(hits[0]?.record.title ?? null)}`,
    );
    console.log(hits.length > 0 ? '[nib:smoke] PASS' : '[nib:smoke] FAIL');
  } catch (error) {
    console.error('[nib:smoke] FAIL', error);
  } finally {
    app.quit();
  }
}
