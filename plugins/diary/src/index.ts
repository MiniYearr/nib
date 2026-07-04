import { app, ipcMain } from 'electron';
import { join } from 'node:path';
import type { NibPluginContext, NibPluginModule, SearchHit } from '@nib/plugin-api';
import {
  DIARY_CHANNELS as CH,
  DIARY_TYPE,
  MODULE_ID,
  type MediaItemDto,
  type MediaLookupHit,
} from './shared';
import { DiaryStore } from './store';

export { DIARY_TYPE, MODULE_ID };

const AUTO_LOCK_MS = 10 * 60_000;
const MAX_COVER_BYTES = 1_500_000;
const PROVIDER_SERVICES = ['nib.media-anilist.lookup', 'nib.media-tvmaze.lookup'];

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function next9am(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

async function fetchCoverDataUri(url: string | undefined): Promise<string | undefined> {
  if (!url || !url.startsWith('https://')) return undefined;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_COVER_BYTES) return undefined;
    const mime = response.headers.get('content-type') ?? 'image/jpeg';
    return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  } catch {
    return undefined;
  }
}

const diaryPlugin: NibPluginModule = {
  manifest: {
    id: MODULE_ID,
    name: 'Diary',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    description:
      'Encrypted journal with mood tags, per-entry locks, on-this-day, and a completed-media log.',
    permissions: [
      'scheduler',
      ...PROVIDER_SERVICES.map((service) => `services:call:${service}`),
    ],
    contributes: {
      recordTypes: [{ type: DIARY_TYPE, title: 'Diary entry' }],
      commands: [{ id: 'lock', title: 'Lock diary' }],
    },
  },

  activate(ctx: NibPluginContext) {
    const store = new DiaryStore(join(app.getPath('userData'), 'diary.db'));
    let autoLockTimer: NodeJS.Timeout | undefined;

    const emitStatus = () =>
      ctx.events.emit(`${MODULE_ID}.status`, { status: store.status() });

    const lockNow = () => {
      if (!store.isUnlocked()) return;
      store.lock();
      clearTimeout(autoLockTimer);
      emitStatus();
      ctx.log.info('diary locked');
    };

    const touchAutoLock = () => {
      clearTimeout(autoLockTimer);
      if (store.isUnlocked()) autoLockTimer = setTimeout(lockNow, AUTO_LOCK_MS);
    };

    const handle = (channel: string, fn: (...args: never[]) => unknown) => {
      ipcMain.handle(channel, (_event, ...args) => {
        touchAutoLock();
        return fn(...(args as never[]));
      });
    };

    handle(CH.status, () => store.status());
    handle(CH.setup, async (password: string) => {
      await store.setup(password);
      emitStatus();
    });
    handle(CH.unlock, async (password: string) => {
      const ok = await store.unlock(password);
      if (ok) {
        emitStatus();
        touchAutoLock();
      }
      return ok;
    });
    handle(CH.lock, () => lockNow());
    handle(CH.list, () => store.listEntries());
    handle(CH.create, (input: { date: string; title?: string; bodyMd?: string; mood?: string }) =>
      store.createEntry(input),
    );
    handle(
      CH.update,
      (id: string, patch: { date?: string; title?: string; bodyMd?: string; mood?: string | null }) =>
        store.updateEntry(id, patch),
    );
    handle(CH.remove, (id: string) => store.deleteEntry(id));
    handle(CH.onThisDay, () => store.onThisDay(todayStr()));
    handle(CH.setEntryLock, (id: string, password: string) => store.setEntryLock(id, password));
    handle(CH.unlockEntryBody, (id: string, password: string) =>
      store.unlockEntryBody(id, password),
    );
    handle(CH.removeEntryLock, (id: string, password: string) =>
      store.removeEntryLock(id, password),
    );
    handle(CH.mediaList, () => store.listMedia());
    handle(CH.mediaRemove, (id: string) => store.deleteMedia(id));
    handle(
      CH.mediaAdd,
      async (input: Omit<MediaItemDto, 'id' | 'coverDataUri'> & { coverUrl?: string }) => {
        const coverDataUri = await fetchCoverDataUri(input.coverUrl);
        return store.addMedia({
          kind: input.kind,
          title: input.title,
          year: input.year,
          source: input.source,
          url: input.url,
          completedAt: input.completedAt,
          coverDataUri,
        });
      },
    );
    handle(CH.mediaLookup, async (title: string) => {
      const results = await Promise.allSettled(
        PROVIDER_SERVICES.map((service) => ctx.services.call(service, { title })),
      );
      return results
        .filter(
          (result): result is PromiseFulfilledResult<MediaLookupHit[]> =>
            result.status === 'fulfilled' && Array.isArray(result.value),
        )
        .flatMap((result) => result.value);
    });

    ctx.searchProviders.register((query): SearchHit[] => {
      if (!store.isUnlocked()) return [];
      return store.search(query).map((hit) => ({
        record: {
          id: hit.id,
          type: DIARY_TYPE,
          moduleId: MODULE_ID,
          title: hit.title || `Diary · ${hit.date}`,
          bodyMd: '',
          props: { date: hit.date },
          tags: [],
          createdAt: 0,
          updatedAt: 0,
          deletedAt: null,
        },
        snippet: hit.snippet,
        rank: hit.rank,
      }));
    });

    ctx.commands.register({
      id: 'lock',
      title: 'Lock diary',
      category: 'Diary',
      run: () => lockNow(),
    });

    ctx.scheduler.onJob('on-this-day', () => {
      if (store.isUnlocked()) {
        const hits = store.onThisDay(todayStr());
        if (hits.length > 0) {
          ctx.events.emit(`${MODULE_ID}.on-this-day`, {
            date: todayStr(),
            count: hits.length,
          });
        }
      }
      ctx.scheduler.schedule({ kind: 'on-this-day', runAt: next9am(), unique: true });
    });
    ctx.scheduler.schedule({ kind: 'on-this-day', runAt: next9am(), unique: true });
  },
};

export default diaryPlugin;
