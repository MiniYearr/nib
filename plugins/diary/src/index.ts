import { app, ipcMain } from 'electron';
import { join } from 'node:path';
import type { NibPluginContext, NibPluginModule, NibRecord, SearchHit } from '@nib/plugin-api';
import {
  BOOK_NOTE_TYPE,
  BOOK_TYPE,
  DIARY_CHANNELS as CH,
  DIARY_TYPE,
  MEDIA_TYPE,
  MODULE_ID,
  type MediaItemDto,
  type MediaLookupHit,
} from './shared';
import { registerBookHandlers } from './books';
import { DiaryStore } from './store';

export { DIARY_TYPE, MODULE_ID };

const AUTO_LOCK_MS = 10 * 60_000;
const MAX_COVER_BYTES = 1_500_000;
const PROVIDER_SERVICES = ['nib.media-anilist.lookup', 'nib.media-tvmaze.lookup'];

export async function fetchCoverDataUri(
  url: string | undefined,
  maxBytes = MAX_COVER_BYTES,
): Promise<string | undefined> {
  if (!url || !url.startsWith('https://')) return undefined;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > maxBytes) return undefined;
    const mime = response.headers.get('content-type') ?? 'image/jpeg';
    return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  } catch {
    return undefined;
  }
}

function mediaRecordToDto(record: NibRecord): MediaItemDto {
  const props = record.props as Omit<MediaItemDto, 'id' | 'title'>;
  return { id: record.id, title: record.title, ...props };
}

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

const diaryPlugin: NibPluginModule = {
  manifest: {
    id: MODULE_ID,
    name: 'Diary',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    description:
      'A diary hub: an encrypted journal, a completed-media log, and book notes.',
    permissions: [
      'scheduler',
      `records:read:${MEDIA_TYPE}`,
      `records:write:${MEDIA_TYPE}`,
      `records:read:${BOOK_TYPE}`,
      `records:write:${BOOK_TYPE}`,
      `records:read:${BOOK_NOTE_TYPE}`,
      `records:write:${BOOK_NOTE_TYPE}`,
      ...PROVIDER_SERVICES.map((service) => `services:call:${service}`),
      'services:call:nib.media-openlibrary.lookup',
    ],
    contributes: {
      recordTypes: [
        { type: DIARY_TYPE, title: 'Diary entry' },
        { type: MEDIA_TYPE, title: 'Media log item' },
        { type: BOOK_TYPE, title: 'Book' },
        { type: BOOK_NOTE_TYPE, title: 'Book note' },
      ],
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
    handle(CH.entryCount, () => (store.isUnlocked() ? store.listEntries().length : null));
    handle(CH.onThisDay, () => store.onThisDay(todayStr()));
    handle(CH.setEntryLock, (id: string, password: string) => store.setEntryLock(id, password));
    handle(CH.unlockEntryBody, (id: string, password: string) =>
      store.unlockEntryBody(id, password),
    );
    handle(CH.removeEntryLock, (id: string, password: string) =>
      store.removeEntryLock(id, password),
    );
    // The media log lives in the shared (unencrypted) data layer, so it's
    // always accessible and app-wide searchable even while Entries are locked.
    handle(CH.mediaList, () =>
      ctx.records
        .list({ type: MEDIA_TYPE, limit: 5000 })
        .map(mediaRecordToDto)
        .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)),
    );
    handle(CH.mediaRemove, (id: string) => ctx.records.softDelete(id));
    handle(
      CH.mediaAdd,
      async (input: Omit<MediaItemDto, 'id' | 'coverDataUri'> & { coverUrl?: string }) => {
        const coverDataUri = await fetchCoverDataUri(input.coverUrl);
        const record = ctx.records.create({
          type: MEDIA_TYPE,
          title: input.title,
          props: {
            kind: input.kind,
            year: input.year,
            source: input.source,
            url: input.url,
            completedAt: input.completedAt,
            coverDataUri,
          },
        });
        return mediaRecordToDto(record);
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

    registerBookHandlers(ctx, fetchCoverDataUri);

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
