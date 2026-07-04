import {
  DIARY_CHANNELS as CH,
  type DiaryEntryDto,
  type DiaryStatus,
  type MediaItemDto,
  type MediaKind,
  type MediaLookupHit,
} from '../shared';

function inv<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!window.nib) return Promise.reject(new Error('nib bridge unavailable'));
  return window.nib.invoke(channel, ...args) as Promise<T>;
}

export const diaryApi = {
  status: () => inv<DiaryStatus>(CH.status),
  setup: (password: string) => inv<void>(CH.setup, password),
  unlock: (password: string) => inv<boolean>(CH.unlock, password),
  lock: () => inv<void>(CH.lock),
  list: () => inv<DiaryEntryDto[]>(CH.list),
  create: (input: { date: string; title?: string; bodyMd?: string; mood?: string }) =>
    inv<DiaryEntryDto>(CH.create, input),
  update: (
    id: string,
    patch: { date?: string; title?: string; bodyMd?: string; mood?: string | null },
  ) => inv<DiaryEntryDto>(CH.update, id, patch),
  remove: (id: string) => inv<void>(CH.remove, id),
  onThisDay: () => inv<DiaryEntryDto[]>(CH.onThisDay),
  setEntryLock: (id: string, password: string) => inv<DiaryEntryDto>(CH.setEntryLock, id, password),
  unlockEntryBody: (id: string, password: string) =>
    inv<string>(CH.unlockEntryBody, id, password),
  removeEntryLock: (id: string, password: string) =>
    inv<DiaryEntryDto>(CH.removeEntryLock, id, password),
  mediaList: () => inv<MediaItemDto[]>(CH.mediaList),
  mediaAdd: (input: {
    kind: MediaKind;
    title: string;
    year?: number;
    source?: string;
    url?: string;
    coverUrl?: string;
    completedAt: string;
  }) => inv<MediaItemDto>(CH.mediaAdd, input),
  mediaRemove: (id: string) => inv<void>(CH.mediaRemove, id),
  mediaLookup: (title: string) => inv<MediaLookupHit[]>(CH.mediaLookup, title),
};

export function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
