export const MODULE_ID = 'nib.diary';
export const DIARY_TYPE = 'diary-entry';
export const MEDIA_TYPE = 'media-item';
export const BOOK_TYPE = 'book';
export const BOOK_NOTE_TYPE = 'book-note';

export type DiarySection = 'home' | 'entries' | 'media' | 'books';

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

export type BookStatus = 'reading' | 'finished' | 'wishlist';

export interface BookDto {
  id: string;
  title: string;
  author?: string;
  year?: number;
  pages?: number;
  coverDataUri?: string;
  status: BookStatus;
  tags: string[];
  noteCount: number;
  createdAt: number;
}

export interface BookNoteDto {
  id: string;
  bookId: string;
  /** Optional page/location the highlight/note is about. */
  page?: number;
  /** A verbatim highlight/quote (rendered italic), if this is a highlight. */
  highlight?: string;
  /** The user's own note/reflection. */
  note: string;
  tags: string[];
  createdAt: number;
}

export interface BookLookupHit {
  title: string;
  author?: string;
  year?: number;
  pages?: number;
  coverUrl?: string;
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
  entryCount: 'nib.diary:entryCount',
  mediaList: 'nib.diary:media.list',
  mediaAdd: 'nib.diary:media.add',
  mediaRemove: 'nib.diary:media.remove',
  mediaLookup: 'nib.diary:media.lookup',
} as const;

export const BOOK_CHANNELS = {
  list: 'nib.diary:books.list',
  add: 'nib.diary:books.add',
  update: 'nib.diary:books.update',
  remove: 'nib.diary:books.remove',
  lookup: 'nib.diary:books.lookup',
  notesList: 'nib.diary:books.notes.list',
  noteAdd: 'nib.diary:books.notes.add',
  noteRemove: 'nib.diary:books.notes.remove',
} as const;
