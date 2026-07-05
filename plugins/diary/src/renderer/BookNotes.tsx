import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@nib/shell';
import type { BookDto, BookLookupHit, BookNoteDto, BookStatus } from '../shared';
import { diaryApi } from './api';

const styles = `
.nib-books { display: flex; height: 100%; min-width: 0; }
.nib-books-shelf {
  width: 290px;
  flex: none;
  border-right: 1px solid var(--nib-border);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.nib-books-shelf-head { padding: 14px 14px 12px; border-bottom: 1px solid var(--nib-border); }
.nib-books-add {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  justify-content: center;
  border: none;
  background: var(--nib-book);
  color: #fff;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 9px 0;
  border-radius: 9px;
  cursor: default;
}
.nib-books-filters { display: flex; gap: 6px; margin-top: 12px; }
.nib-books-filter {
  border: 1px solid var(--nib-border);
  background: var(--nib-chip);
  font: inherit;
  font-size: 11px;
  color: var(--nib-ink-2);
  border-radius: 20px;
  padding: 3px 11px;
  cursor: default;
}
.nib-books-filter[data-active='true'] { background: var(--nib-book); color: #fff; border-color: transparent; font-weight: 600; }
.nib-books-list { flex: 1; overflow-y: auto; padding: 10px; }
.nib-book-row {
  display: flex;
  gap: 12px;
  padding: 11px;
  border-radius: 11px;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  cursor: default;
}
.nib-book-row[data-active='true'] { background: color-mix(in srgb, var(--nib-book) 12%, transparent); }
.nib-book-row:hover { background: color-mix(in srgb, var(--nib-book) 8%, transparent); }
.nib-book-cover {
  width: 40px;
  height: 56px;
  flex: none;
  border-radius: 5px;
  object-fit: cover;
  background: linear-gradient(150deg, #3E6187, #2F4d6d);
  box-shadow: 0 4px 10px -3px rgba(40, 30, 20, 0.35);
}
.nib-book-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
}
.nib-book-row-title { font-size: 13px; font-weight: 700; color: var(--nib-ink); line-height: 1.25; }
.nib-book-row-author { font-size: 11px; color: var(--nib-muted); margin-top: 1px; }
.nib-book-row-meta { display: flex; align-items: center; gap: 6px; margin-top: 7px; }
.nib-book-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  color: var(--nib-book);
  background: color-mix(in srgb, var(--nib-book) 13%, transparent);
  border-radius: 5px;
  padding: 1px 6px;
}
.nib-book-status { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 9.5px; color: var(--nib-faint); }
.nib-books-detail { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.nib-books-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--nib-muted); font-size: 13px; }
.nib-book-header { display: flex; gap: 20px; padding: 26px 30px 20px; border-bottom: 1px solid var(--nib-border); }
.nib-book-header-cover {
  width: 84px;
  height: 120px;
  flex: none;
  border-radius: 8px;
  object-fit: cover;
  background: linear-gradient(150deg, #3E6187, #2F4d6d);
  box-shadow: 0 12px 26px -8px rgba(40, 30, 20, 0.4);
}
.nib-book-header-title { font-size: 23px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; color: var(--nib-ink); }
.nib-book-header-sub { font-size: 13px; color: var(--nib-muted); margin-top: 3px; }
.nib-book-header-row { display: flex; align-items: center; gap: 8px; margin: 13px 0 0; flex-wrap: wrap; }
.nib-book-statusbtn {
  display: flex;
  align-items: center;
  gap: 5px;
  border: none;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--nib-book);
  background: color-mix(in srgb, var(--nib-book) 12%, transparent);
  border-radius: 20px;
  padding: 4px 12px;
  cursor: default;
}
.nib-book-header-actions { display: flex; flex-direction: column; gap: 8px; flex: none; }
.nib-book-newnote {
  display: flex;
  align-items: center;
  gap: 7px;
  border: none;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: #fff;
  background: var(--nib-book);
  border-radius: 9px;
  padding: 8px 13px;
  cursor: default;
}
.nib-book-remove {
  border: 1px solid var(--nib-border-strong);
  background: transparent;
  font: inherit;
  font-size: 11.5px;
  color: var(--nib-muted);
  border-radius: 9px;
  padding: 7px 13px;
  cursor: default;
}
.nib-book-notes { flex: 1; overflow-y: auto; padding: 22px 30px; }
.nib-book-note { display: flex; gap: 16px; margin-bottom: 22px; }
.nib-book-note-gutter { width: 48px; flex: none; text-align: right; padding-top: 2px; }
.nib-book-note-page { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; font-weight: 600; color: var(--nib-book); }
.nib-book-note-date { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 9.5px; color: var(--nib-faint); margin-top: 2px; }
.nib-book-note-body { flex: 1; min-width: 0; }
.nib-book-note-highlight {
  border-left: 3px solid var(--nib-book);
  padding-left: 16px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--nib-ink-2);
  font-style: italic;
}
.nib-book-note-reflection {
  display: flex;
  gap: 9px;
  margin-top: 12px;
  background: var(--nib-surface);
  border: 1px solid var(--nib-border);
  border-radius: 10px;
  padding: 11px 13px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--nib-ink-2);
}
.nib-book-note-plain {
  background: var(--nib-paper);
  border: 1px solid var(--nib-border-strong);
  border-radius: 11px;
  padding: 13px 15px;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--nib-ink-2);
}
.nib-book-note-remove { border: none; background: transparent; color: var(--nib-faint); font-size: 13px; cursor: default; margin-left: auto; }
.nib-book-composer {
  border-top: 1px solid var(--nib-border);
  padding: 14px 30px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--nib-surface);
}
.nib-book-composer-row { display: flex; gap: 8px; }
.nib-book-composer input, .nib-book-composer textarea {
  font: inherit;
  font-size: 13px;
  border: 1px solid var(--nib-border-strong);
  border-radius: 8px;
  background: var(--nib-paper);
  padding: 8px 10px;
  color: var(--nib-ink);
  outline: none;
}
.nib-book-composer textarea { min-height: 54px; resize: vertical; width: 100%; }
.nib-book-composer .page { width: 90px; }
.nib-book-composer .hl { flex: 1; }
.nib-book-composer-actions { display: flex; gap: 8px; justify-content: flex-end; }
.nib-book-composer-actions button {
  border: none;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  border-radius: 8px;
  padding: 7px 14px;
  cursor: default;
}
.nib-book-composer-actions .save { background: var(--nib-book); color: #fff; }
.nib-book-composer-actions .cancel { background: var(--nib-chip); color: var(--nib-ink-2); }
.nib-book-add {
  padding: 12px;
  border-bottom: 1px solid var(--nib-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nib-book-add input {
  font: inherit;
  font-size: 12.5px;
  border: 1px solid var(--nib-border-strong);
  border-radius: 8px;
  background: var(--nib-paper);
  padding: 7px 10px;
  color: var(--nib-ink);
  outline: none;
}
.nib-book-hit {
  display: flex;
  gap: 9px;
  align-items: center;
  border: 1px solid var(--nib-border);
  background: var(--nib-paper);
  border-radius: 8px;
  padding: 7px 9px;
  font: inherit;
  font-size: 12px;
  color: var(--nib-ink);
  cursor: default;
  text-align: left;
}
.nib-book-hit:hover { border-color: var(--nib-book); }
.nib-book-hit-cover { width: 26px; height: 38px; border-radius: 3px; object-fit: cover; background: var(--nib-chip); flex: none; }
`;

const NEXT_STATUS: Record<BookStatus, BookStatus> = {
  reading: 'finished',
  finished: 'wishlist',
  wishlist: 'reading',
};

function AddBook({ onAdded, onCancel }: { onAdded(): void; onCancel(): void }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<BookLookupHit[]>();
  const [busy, setBusy] = useState(false);

  const lookup = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      setHits(await diaryApi.bookLookup(query.trim()));
    } finally {
      setBusy(false);
    }
  };

  const add = async (hit?: BookLookupHit) => {
    setBusy(true);
    try {
      await diaryApi.bookAdd({
        title: hit?.title ?? query.trim(),
        author: hit?.author,
        year: hit?.year,
        pages: hit?.pages,
        coverUrl: hit?.coverUrl,
      });
      onAdded();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nib-book-add">
      <input
        autoFocus
        placeholder="Book title or author…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && void lookup()}
      />
      {hits?.map((hit, index) => (
        <button key={index} className="nib-book-hit" onClick={() => void add(hit)}>
          {hit.coverUrl ? (
            <img className="nib-book-hit-cover" src={hit.coverUrl} alt="" />
          ) : (
            <span className="nib-book-hit-cover" />
          )}
          <span>
            {hit.title}
            {hit.author ? ` · ${hit.author}` : ''}
            {hit.year ? ` (${hit.year})` : ''}
          </span>
        </button>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="nib-books-add" disabled={busy || !query.trim()} onClick={() => void lookup()}>
          Look up
        </button>
        <button
          className="nib-books-filter"
          disabled={busy || !query.trim()}
          onClick={() => void add()}
        >
          Add manually
        </button>
        <button className="nib-books-filter" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function BookNotes() {
  const [books, setBooks] = useState<BookDto[]>([]);
  const [filter, setFilter] = useState<'all' | BookStatus>('all');
  const [selectedId, setSelectedId] = useState<string>();
  const [notes, setNotes] = useState<BookNoteDto[]>([]);
  const [adding, setAdding] = useState(false);
  const [composing, setComposing] = useState(false);
  const [highlight, setHighlight] = useState('');
  const [page, setPage] = useState('');
  const [noteText, setNoteText] = useState('');

  const refreshBooks = useCallback(async () => {
    const list = await diaryApi.booksList();
    setBooks(list);
    setSelectedId((current) => current ?? list[0]?.id);
  }, []);

  useEffect(() => {
    void refreshBooks();
  }, [refreshBooks]);

  const refreshNotes = useCallback(async (bookId: string) => {
    setNotes(await diaryApi.bookNotesList(bookId));
  }, []);

  useEffect(() => {
    if (selectedId) void refreshNotes(selectedId);
    else setNotes([]);
  }, [selectedId, refreshNotes]);

  const selected = books.find((book) => book.id === selectedId);
  const filtered = books.filter((book) => filter === 'all' || book.status === filter);

  const cycleStatus = async () => {
    if (!selected) return;
    await diaryApi.bookUpdate(selected.id, { status: NEXT_STATUS[selected.status] });
    void refreshBooks();
  };

  const removeBook = async () => {
    if (!selected) return;
    await diaryApi.bookRemove(selected.id);
    setSelectedId(undefined);
    void refreshBooks();
  };

  const saveNote = async () => {
    if (!selected || !noteText.trim()) return;
    await diaryApi.bookNoteAdd({
      bookId: selected.id,
      page: page ? Number(page) : undefined,
      highlight: highlight.trim() || undefined,
      note: noteText.trim(),
    });
    setHighlight('');
    setPage('');
    setNoteText('');
    setComposing(false);
    void refreshNotes(selected.id);
    void refreshBooks();
  };

  return (
    <div className="nib-books">
      <style>{styles}</style>
      <div className="nib-books-shelf">
        <div className="nib-books-shelf-head">
          <button className="nib-books-add" onClick={() => setAdding((open) => !open)}>
            <Icon name="plus" size={14} />
            Add a book
          </button>
          <div className="nib-books-filters">
            {(['all', 'reading', 'finished'] as const).map((key) => (
              <button
                key={key}
                className="nib-books-filter"
                data-active={filter === key}
                onClick={() => setFilter(key)}
              >
                {key === 'all' ? 'All' : key[0]!.toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {adding && (
          <AddBook
            onAdded={() => {
              setAdding(false);
              void refreshBooks();
            }}
            onCancel={() => setAdding(false)}
          />
        )}
        <div className="nib-books-list">
          {filtered.map((book) => (
            <button
              key={book.id}
              className="nib-book-row"
              data-active={book.id === selectedId}
              onClick={() => setSelectedId(book.id)}
            >
              {book.coverDataUri ? (
                <img className="nib-book-cover" src={book.coverDataUri} alt="" />
              ) : (
                <span className="nib-book-cover nib-book-cover-fallback">
                  <Icon name="book-marked" size={16} />
                </span>
              )}
              <span style={{ minWidth: 0, flex: 1 }}>
                <div className="nib-book-row-title">{book.title}</div>
                {book.author && <div className="nib-book-row-author">{book.author}</div>}
                <div className="nib-book-row-meta">
                  <span className="nib-book-chip">
                    <Icon name="highlighter" size={9} />
                    {book.noteCount}
                  </span>
                  <span className="nib-book-status">{book.status}</span>
                </div>
              </span>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="nib-books-detail">
          <div className="nib-book-header">
            {selected.coverDataUri ? (
              <img className="nib-book-header-cover" src={selected.coverDataUri} alt="" />
            ) : (
              <span className="nib-book-header-cover nib-book-cover-fallback">
                <Icon name="book-marked" size={28} />
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nib-book-header-title">{selected.title}</div>
              <div className="nib-book-header-sub">
                {[selected.author, selected.year, selected.pages && `${selected.pages} pp`]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div className="nib-book-header-row">
                <button className="nib-book-statusbtn" onClick={() => void cycleStatus()}>
                  <Icon name="book-open-text" size={12} />
                  {selected.status}
                </button>
              </div>
            </div>
            <div className="nib-book-header-actions">
              <button className="nib-book-newnote" onClick={() => setComposing((open) => !open)}>
                <Icon name="plus" size={14} />
                New note
              </button>
              <button className="nib-book-remove" onClick={() => void removeBook()}>
                Remove
              </button>
            </div>
          </div>

          {composing && (
            <div className="nib-book-composer">
              <div className="nib-book-composer-row">
                <input
                  className="page"
                  placeholder="Page"
                  value={page}
                  onChange={(event) => setPage(event.target.value.replace(/\D/g, ''))}
                />
                <input
                  className="hl"
                  placeholder="Highlight / quote (optional)"
                  value={highlight}
                  onChange={(event) => setHighlight(event.target.value)}
                />
              </div>
              <textarea
                placeholder="Your note or reflection…"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
              />
              <div className="nib-book-composer-actions">
                <button className="cancel" onClick={() => setComposing(false)}>
                  Cancel
                </button>
                <button className="save" onClick={() => void saveNote()}>
                  Save note
                </button>
              </div>
            </div>
          )}

          <div className="nib-book-notes">
            {notes.length === 0 && (
              <div style={{ color: 'var(--nib-muted)', fontSize: 13 }}>
                No notes yet — capture a highlight or a reflection.
              </div>
            )}
            {notes.map((note) => (
              <div key={note.id} className="nib-book-note">
                <div className="nib-book-note-gutter">
                  <div className="nib-book-note-page">{note.page ? `p.${note.page}` : 'note'}</div>
                  <div className="nib-book-note-date">
                    {new Date(note.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="nib-book-note-body">
                  {note.highlight ? (
                    <>
                      <div className="nib-book-note-highlight">“{note.highlight}”</div>
                      {note.note && (
                        <div className="nib-book-note-reflection">
                          <Icon name="pen-line" size={14} style={{ color: 'var(--nib-accent)' }} />
                          <span>{note.note}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="nib-book-note-plain">{note.note}</div>
                  )}
                </div>
                <button
                  className="nib-book-note-remove"
                  onClick={() => void diaryApi.bookNoteRemove(note.id).then(() => refreshNotes(selected.id))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="nib-books-detail">
          <div className="nib-books-empty">Add a book to start keeping notes.</div>
        </div>
      )}
    </div>
  );
}
