export const MODULE_ID = 'nib.diary';
export const DIARY_TYPE = 'diary-entry';

export const MOODS = [
  { id: 'great', emoji: '😄', label: 'Great' },
  { id: 'good', emoji: '🙂', label: 'Good' },
  { id: 'meh', emoji: '😐', label: 'Meh' },
  { id: 'low', emoji: '😔', label: 'Low' },
  { id: 'awful', emoji: '😞', label: 'Awful' },
] as const;

export type DiaryStatus = 'uninitialized' | 'locked' | 'unlocked';

export interface DiaryEntryDto {
  id: string;
  /** 'YYYY-MM-DD' the entry is about. */
  date: string;
  title: string;
  /** Empty string while the entry's own lock is engaged. */
  bodyMd: string;
  mood?: string;
  createdAt: number;
  updatedAt: number;
  /** True when a per-entry lock seals the body behind its own passphrase. */
  locked: boolean;
}

export type MediaKind = 'game' | 'show' | 'anime' | 'movie' | 'other';

export interface MediaItemDto {
  id: string;
  kind: MediaKind;
  title: string;
  year?: number;
  /** Cover art cached as a data URI — sealed in the diary, viewable offline. */
  coverDataUri?: string;
  source?: string;
  url?: string;
  /** 'YYYY-MM-DD' the user finished it. */
  completedAt: string;
}

export interface MediaLookupHit {
  source: string;
  kind: MediaKind;
  title: string;
  year?: number;
  coverUrl?: string;
  url?: string;
}

/** IPC channels the diary's main side registers; renderer calls via window.nib.invoke. */
export const DIARY_CHANNELS = {
  status: 'nib.diary:status',
  setup: 'nib.diary:setup',
  unlock: 'nib.diary:unlock',
  lock: 'nib.diary:lock',
  list: 'nib.diary:list',
  create: 'nib.diary:create',
  update: 'nib.diary:update',
  remove: 'nib.diary:remove',
  onThisDay: 'nib.diary:onThisDay',
  setEntryLock: 'nib.diary:setEntryLock',
  unlockEntryBody: 'nib.diary:unlockEntryBody',
  removeEntryLock: 'nib.diary:removeEntryLock',
  mediaList: 'nib.diary:media.list',
  mediaAdd: 'nib.diary:media.add',
  mediaRemove: 'nib.diary:media.remove',
  mediaLookup: 'nib.diary:media.lookup',
} as const;
