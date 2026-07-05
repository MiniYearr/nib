import { ipcMain } from 'electron';
import type { NibPluginContext, NibRecord } from '@nib/plugin-api';
import {
  BOOK_CHANNELS as BC,
  BOOK_NOTE_TYPE,
  BOOK_TYPE,
  type BookDto,
  type BookLookupHit,
  type BookNoteDto,
  type BookStatus,
} from './shared';

const OPENLIBRARY_SERVICE = 'nib.media-openlibrary.lookup';

interface BookProps {
  author?: string;
  year?: number;
  pages?: number;
  coverDataUri?: string;
  status: BookStatus;
}

interface BookNoteProps {
  bookId: string;
  page?: number;
  highlight?: string;
}

function bookToDto(record: NibRecord, noteCount: number): BookDto {
  const props = record.props as unknown as BookProps;
  return {
    id: record.id,
    title: record.title,
    author: props.author,
    year: props.year,
    pages: props.pages,
    coverDataUri: props.coverDataUri,
    status: props.status ?? 'reading',
    tags: record.tags,
    noteCount,
    createdAt: record.createdAt,
  };
}

function noteToDto(record: NibRecord): BookNoteDto {
  const props = record.props as unknown as BookNoteProps;
  return {
    id: record.id,
    bookId: props.bookId,
    page: props.page,
    highlight: props.highlight,
    note: record.bodyMd,
    tags: record.tags,
    createdAt: record.createdAt,
  };
}

type FetchCover = (url: string | undefined) => Promise<string | undefined>;

/**
 * Book-notes storage on top of the shared data layer: books and their
 * highlights/notes are ordinary records (unencrypted, globally searchable),
 * so a note surfaces in app-wide search the moment it's written.
 */
export function registerBookHandlers(ctx: NibPluginContext, fetchCover: FetchCover): void {
  const countNotes = (): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const record of ctx.records.list({ type: BOOK_NOTE_TYPE, limit: 10_000 })) {
      const { bookId } = record.props as unknown as BookNoteProps;
      counts.set(bookId, (counts.get(bookId) ?? 0) + 1);
    }
    return counts;
  };

  ipcMain.handle(BC.list, () => {
    const counts = countNotes();
    return ctx.records
      .list({ type: BOOK_TYPE, limit: 5000 })
      .map((record) => bookToDto(record, counts.get(record.id) ?? 0))
      .sort((a, b) => b.createdAt - a.createdAt);
  });

  ipcMain.handle(
    BC.add,
    async (
      _event,
      input: {
        title: string;
        author?: string;
        year?: number;
        pages?: number;
        coverUrl?: string;
        status?: BookStatus;
        tags?: string[];
      },
    ) => {
      const coverDataUri = await fetchCover(input.coverUrl);
      const record = ctx.records.create({
        type: BOOK_TYPE,
        title: input.title,
        tags: input.tags ?? [],
        props: {
          author: input.author,
          year: input.year,
          pages: input.pages,
          coverDataUri,
          status: input.status ?? 'reading',
        },
      });
      return bookToDto(record, 0);
    },
  );

  ipcMain.handle(
    BC.update,
    (_event, id: string, patch: { status?: BookStatus; tags?: string[]; title?: string }) => {
      const existing = ctx.records.get(id);
      if (!existing) throw new Error('book not found');
      const props = existing.props as unknown as BookProps;
      const updated = ctx.records.update(id, {
        title: patch.title ?? existing.title,
        tags: patch.tags ?? existing.tags,
        props: { ...props, status: patch.status ?? props.status },
      });
      const counts = countNotes();
      return bookToDto(updated, counts.get(id) ?? 0);
    },
  );

  ipcMain.handle(BC.remove, (_event, id: string) => {
    for (const note of ctx.records.list({ type: BOOK_NOTE_TYPE, limit: 10_000 })) {
      if ((note.props as unknown as BookNoteProps).bookId === id) ctx.records.softDelete(note.id);
    }
    ctx.records.softDelete(id);
  });

  ipcMain.handle(BC.lookup, async (_event, query: string): Promise<BookLookupHit[]> => {
    if (!query.trim()) return [];
    try {
      const hits = await ctx.services.call(OPENLIBRARY_SERVICE, { title: query });
      return Array.isArray(hits) ? (hits as BookLookupHit[]) : [];
    } catch {
      return [];
    }
  });

  ipcMain.handle(BC.notesList, (_event, bookId: string) =>
    ctx.records
      .list({ type: BOOK_NOTE_TYPE, limit: 10_000 })
      .filter((record) => (record.props as unknown as BookNoteProps).bookId === bookId)
      .map(noteToDto)
      .sort((a, b) => b.createdAt - a.createdAt),
  );

  ipcMain.handle(
    BC.noteAdd,
    (
      _event,
      input: { bookId: string; page?: number; highlight?: string; note: string; tags?: string[] },
    ) => {
      const record = ctx.records.create({
        type: BOOK_NOTE_TYPE,
        // Title carries the searchable gist (highlight or note).
        title: (input.highlight || input.note).slice(0, 120),
        bodyMd: input.note,
        tags: input.tags ?? [],
        props: { bookId: input.bookId, page: input.page, highlight: input.highlight },
      });
      return noteToDto(record);
    },
  );

  ipcMain.handle(BC.noteRemove, (_event, id: string) => ctx.records.softDelete(id));
}
