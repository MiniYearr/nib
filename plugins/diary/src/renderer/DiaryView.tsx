import { useCallback, useEffect, useState } from 'react';
import { Icon, type ModuleViewProps } from '@nib/shell';
import {
  BOOK_NOTE_TYPE,
  BOOK_TYPE,
  DIARY_TYPE,
  MEDIA_TYPE,
  type DiarySection,
  type DiaryStatus,
} from '../shared';
import { diaryApi } from './api';
import { BookNotes } from './BookNotes';
import { EntriesSection } from './EntriesSection';
import { MediaShelf } from './MediaShelf';

const styles = `
.nib-diary { display: flex; flex-direction: column; height: 100%; min-width: 0; }
.nib-diary-gate {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  user-select: none;
}
.nib-diary-gate-icon {
  width: 52px; height: 52px; border-radius: 15px;
  background: rgba(138, 107, 200, 0.15);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
}
.nib-diary-gate h2 { margin: 0; font-size: 19px; letter-spacing: -0.015em; }
.nib-diary-gate p { margin: 0; font-size: 12.5px; color: var(--nib-muted); max-width: 40ch; text-align: center; line-height: 1.5; }
.nib-diary-gate input {
  width: 260px;
  font: inherit;
  font-size: 13.5px;
  padding: 9px 12px;
  border: 1px solid var(--nib-border-strong);
  border-radius: 9px;
  background: var(--nib-paper);
  outline: none;
  text-align: center;
}
.nib-diary-gate input:focus { border-color: var(--nib-diary); }
.nib-diary-gate button {
  width: 260px;
  border: none;
  background: var(--nib-diary);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 0;
  border-radius: 9px;
  cursor: default;
}
.nib-diary-gate button:disabled { opacity: 0.5; }
.nib-diary-error { color: var(--nib-danger); font-size: 12px; min-height: 16px; }
.nib-diary-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--nib-border);
  flex: none;
}
.nib-diary-tab {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  padding: 6px 12px;
  border-radius: 8px;
  color: var(--nib-ink-2);
  cursor: default;
}
.nib-diary-tab[data-active='true'] { background: rgba(138, 107, 200, 0.14); color: var(--nib-ink); font-weight: 600; }
.nib-diary-lock-btn {
  margin-left: auto;
  border: 1px solid var(--nib-border-strong);
  background: transparent;
  font: inherit;
  font-size: 11.5px;
  padding: 5px 10px;
  border-radius: 8px;
  color: var(--nib-ink-2);
  cursor: default;
}
.nib-diary-lock-btn:hover { background: rgba(138, 107, 200, 0.1); color: var(--nib-ink); }
.nib-diary-body { flex: 1; display: flex; min-height: 0; }
.nib-diary-list {
  width: 250px;
  flex: none;
  overflow-y: auto;
  border-right: 1px solid var(--nib-border);
  padding: 10px 10px 30px;
}
.nib-diary-new {
  width: 100%;
  border: 1px dashed rgba(138, 107, 200, 0.5);
  background: transparent;
  color: var(--nib-diary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 0;
  border-radius: 9px;
  cursor: default;
  margin-bottom: 8px;
}
.nib-diary-new:hover { background: rgba(138, 107, 200, 0.08); }
.nib-diary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  font: inherit;
  padding: 8px 9px;
  border-radius: 9px;
  cursor: default;
}
.nib-diary-item[data-active='true'] { background: rgba(138, 107, 200, 0.13); }
.nib-diary-item-mood { flex: none; font-size: 15px; width: 20px; text-align: center; }
.nib-diary-item-text { min-width: 0; flex: 1; }
.nib-diary-item-title {
  font-size: 12.5px;
  color: var(--nib-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nib-diary-item-date { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; color: var(--nib-section); }
.nib-diary-item-lock { flex: none; font-size: 11px; }
.nib-diary-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow-y: auto; }
.nib-diary-otd {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px 0;
  flex-wrap: wrap;
  flex: none;
}
.nib-diary-otd-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nib-diary);
}
.nib-diary-otd-chip {
  border: 1px solid rgba(138, 107, 200, 0.35);
  background: rgba(138, 107, 200, 0.08);
  font: inherit;
  font-size: 11.5px;
  color: var(--nib-ink-2);
  padding: 4px 10px;
  border-radius: 999px;
  cursor: default;
}
.nib-diary-otd-chip:hover { background: rgba(138, 107, 200, 0.16); }
.nib-diary-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nib-muted);
  font-size: 13px;
}
.nib-entry { display: flex; flex-direction: column; gap: 10px; padding: 14px 22px 40px; flex: 1; }
.nib-entry-meta { display: flex; align-items: center; gap: 10px; }
.nib-entry-meta input[type='date'] {
  font: inherit;
  font-size: 12px;
  border: 1px solid var(--nib-border-strong);
  border-radius: 7px;
  background: var(--nib-paper);
  padding: 4px 8px;
  color: var(--nib-ink);
}
.nib-entry-moods { display: flex; gap: 3px; }
.nib-entry-mood {
  border: none;
  background: transparent;
  font-size: 16px;
  padding: 3px 5px;
  border-radius: 7px;
  cursor: default;
  filter: grayscale(1);
  opacity: 0.55;
}
.nib-entry-mood[data-active='true'] { filter: none; opacity: 1; background: rgba(138, 107, 200, 0.12); }
.nib-entry-mood:hover { filter: none; opacity: 1; }
.nib-entry-actions { margin-left: auto; display: flex; gap: 8px; }
.nib-entry-action {
  border: 1px solid var(--nib-border-strong);
  background: transparent;
  font: inherit;
  font-size: 11px;
  padding: 4px 9px;
  border-radius: 7px;
  color: var(--nib-ink-2);
  cursor: default;
}
.nib-entry-action:hover { background: var(--nib-border); color: var(--nib-ink); }
.nib-entry-title {
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nib-ink);
}
.nib-entry-title::placeholder { color: var(--nib-placeholder); }
.nib-entry-body {
  flex: 1;
  min-height: 260px;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  line-height: 1.65;
  color: var(--nib-ink);
  resize: none;
}
.nib-entry-sealed {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px dashed rgba(138, 107, 200, 0.4);
  border-radius: 12px;
  padding: 30px;
}
.nib-entry-sealed p { margin: 0; font-size: 12.5px; color: var(--nib-muted); }
.nib-entry-sealed input {
  font: inherit;
  font-size: 12.5px;
  padding: 7px 10px;
  border: 1px solid var(--nib-border-strong);
  border-radius: 8px;
  background: var(--nib-paper);
  outline: none;
  text-align: center;
  width: 220px;
}
.nib-entry-sealed-actions { display: flex; gap: 8px; }
.nib-entry-sealed button {
  border: none;
  background: var(--nib-diary);
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 8px;
  cursor: default;
}
.nib-entry-sealed button[data-secondary='true'] { background: transparent; color: var(--nib-diary); border: 1px solid rgba(138, 107, 200, 0.4); }
.nib-entry-revealed {
  flex: 1;
  white-space: pre-wrap;
  font: inherit;
  font-size: 14px;
  line-height: 1.65;
  color: var(--nib-ink);
  background: rgba(138, 107, 200, 0.05);
  border-radius: 12px;
  padding: 16px 18px;
  overflow-y: auto;
}
.nib-entry-lockrow { display: flex; align-items: center; gap: 8px; }
.nib-entry-lockrow input {
  font: inherit;
  font-size: 12px;
  padding: 5px 9px;
  border: 1px solid var(--nib-border-strong);
  border-radius: 7px;
  background: var(--nib-paper);
  outline: none;
  width: 180px;
}
.nib-media { padding: 16px 20px 40px; overflow-y: auto; flex: 1; }
.nib-media-add { display: flex; gap: 8px; margin-bottom: 14px; align-items: center; flex-wrap: wrap; }
.nib-media-add input[type='text'] {
  font: inherit;
  font-size: 13px;
  padding: 7px 11px;
  border: 1px solid var(--nib-border-strong);
  border-radius: 9px;
  background: var(--nib-paper);
  outline: none;
  width: 260px;
}
.nib-media-add select, .nib-media-add button {
  font: inherit;
  font-size: 12px;
  padding: 7px 11px;
  border: 1px solid var(--nib-border-strong);
  border-radius: 9px;
  background: var(--nib-paper);
  color: var(--nib-ink);
  cursor: default;
}
.nib-media-add button { background: var(--nib-accent); border-color: var(--nib-accent); color: #fff; font-weight: 600; }
.nib-media-add button[data-secondary='true'] { background: transparent; border-color: var(--nib-border-strong); color: var(--nib-ink-2); font-weight: 400; }
.nib-media-hits { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
.nib-media-hit {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--nib-border-strong);
  background: var(--nib-paper);
  font: inherit;
  font-size: 12.5px;
  padding: 8px 12px;
  border-radius: 9px;
  cursor: default;
  text-align: left;
}
.nib-media-hit:hover { border-color: rgba(191, 107, 68, 0.5); background: rgba(191, 107, 68, 0.06); }
.nib-media-hit-source {
  margin-left: auto;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  color: var(--nib-info);
  background: rgba(107, 124, 155, 0.12);
  padding: 2px 6px;
  border-radius: 5px;
}
.nib-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
.nib-media-card {
  background: var(--nib-paper);
  border: 1px solid var(--nib-border-strong);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}
.nib-media-cover { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; display: block; background: var(--nib-chip); }
.nib-media-cover-fallback {
  width: 100%;
  aspect-ratio: 2 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  background: var(--nib-chip);
}
.nib-media-card-body { padding: 8px 10px 10px; }
.nib-media-card-title { font-size: 12px; font-weight: 600; color: var(--nib-ink); line-height: 1.3; }
.nib-media-card-meta { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; color: var(--nib-muted); margin-top: 3px; }
.nib-media-card-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  border: none;
  background: rgba(38, 34, 29, 0.55);
  color: #fff;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  font-size: 11px;
  cursor: default;
  opacity: 0;
}
.nib-media-card:hover .nib-media-card-remove { opacity: 1; }
.nib-diary-home { padding: 30px 36px 40px; overflow-y: auto; height: 100%; }
.nib-diary-home-title { font-size: 27px; font-weight: 800; letter-spacing: -0.02em; color: var(--nib-ink); }
.nib-diary-home-sub { font-size: 13.5px; color: var(--nib-muted); margin: 3px 0 24px; }
.nib-diary-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; max-width: 900px; }
.nib-diary-card {
  background: var(--nib-paper);
  border: 1px solid var(--nib-border);
  border-radius: 15px;
  padding: 22px;
  text-align: left;
  cursor: default;
  min-height: 156px;
  display: flex;
  flex-direction: column;
  font: inherit;
}
.nib-diary-card:hover { border-color: var(--nib-border-strong); }
.nib-diary-card-top { display: flex; align-items: center; gap: 13px; margin-bottom: 14px; }
.nib-diary-card-icon { width: 46px; height: 46px; border-radius: 13px; display: flex; align-items: center; justify-content: center; flex: none; }
.nib-diary-card-title { font-size: 17px; font-weight: 700; color: var(--nib-ink); }
.nib-diary-card-desc { font-size: 12px; color: var(--nib-muted); }
.nib-diary-card-arrow { margin-left: auto; color: var(--nib-faint); }
.nib-diary-card-foot { margin-top: auto; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; color: var(--nib-muted); display: flex; gap: 12px; align-items: center; }
.nib-diary-card-add {
  border: 1.5px dashed var(--nib-border-strong);
  background: var(--nib-surface);
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--nib-muted);
}
.nib-diary-crumb { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--nib-border); flex: none; }
.nib-diary-crumb-back { border: none; background: transparent; font: inherit; cursor: default; color: var(--nib-ink-2); display: flex; align-items: center; gap: 5px; font-size: 13px; }
.nib-diary-crumb-current { font-size: 13px; font-weight: 600; color: var(--nib-ink); }
.nib-diary-crumb-lock { margin-left: auto; border: 1px solid var(--nib-border-strong); background: transparent; border-radius: 8px; padding: 5px 11px; font: inherit; font-size: 11.5px; color: var(--nib-muted); cursor: default; }
.nib-diary-section { flex: 1; min-height: 0; display: flex; flex-direction: column; }
`;

const SECTION_LABEL: Record<Exclude<DiarySection, 'home'>, string> = {
  entries: 'Entries',
  media: 'Media log',
  books: 'Book notes',
};

export function DiaryView({ openRequest }: ModuleViewProps) {
  const [section, setSection] = useState<DiarySection>('home');
  const [status, setStatus] = useState<DiaryStatus>('locked');
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [mediaCount, setMediaCount] = useState(0);
  const [bookCount, setBookCount] = useState(0);

  const refreshCounts = useCallback(async () => {
    setEntryCount(await diaryApi.entryCount());
    setMediaCount((await diaryApi.mediaList()).length);
    setBookCount((await diaryApi.booksList()).length);
  }, []);

  useEffect(() => {
    void diaryApi.status().then(setStatus);
    void refreshCounts();
    if (!window.nib) return;
    return window.nib.events.on('nib.diary.status', (event) => {
      const next = (event.payload as { status: DiaryStatus }).status;
      setStatus(next);
      void refreshCounts();
    });
  }, [refreshCounts]);

  // A global-search hit routed here jumps to the section that owns its type.
  useEffect(() => {
    if (!openRequest) return;
    const type = openRequest.record.type;
    if (type === DIARY_TYPE) setSection('entries');
    else if (type === MEDIA_TYPE) setSection('media');
    else if (type === BOOK_TYPE || type === BOOK_NOTE_TYPE) setSection('books');
  }, [openRequest]);

  if (section === 'home') {
    return (
      <div className="nib-diary">
        <style>{styles}</style>
        <div className="nib-diary-home">
          <div className="nib-diary-home-title">Your diary</div>
          <div className="nib-diary-home-sub">
            Pick a section. Only your journal entries are locked behind a passphrase.
          </div>
          <div className="nib-diary-cards">
            <button className="nib-diary-card" onClick={() => setSection('entries')}>
              <div className="nib-diary-card-top">
                <span
                  className="nib-diary-card-icon"
                  style={{ background: 'color-mix(in srgb, var(--nib-diary) 14%, transparent)' }}
                >
                  <Icon name="notebook-pen" size={22} style={{ color: 'var(--nib-diary)' }} />
                </span>
                <span style={{ flex: 1 }}>
                  <div className="nib-diary-card-title">Entries</div>
                  <div className="nib-diary-card-desc">Your encrypted daily journal</div>
                </span>
                <Icon name="arrow-up-right" size={18} className="nib-diary-card-arrow" />
              </div>
              <div className="nib-diary-card-foot">
                {status === 'uninitialized'
                  ? 'not set up yet'
                  : entryCount === null
                    ? '🔒 locked'
                    : `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
              </div>
            </button>

            <button className="nib-diary-card" onClick={() => setSection('media')}>
              <div className="nib-diary-card-top">
                <span
                  className="nib-diary-card-icon"
                  style={{ background: 'var(--nib-accent-soft)' }}
                >
                  <Icon name="library" size={22} style={{ color: 'var(--nib-accent)' }} />
                </span>
                <span style={{ flex: 1 }}>
                  <div className="nib-diary-card-title">Media log</div>
                  <div className="nib-diary-card-desc">Games, shows, anime</div>
                </span>
                <Icon name="arrow-up-right" size={18} className="nib-diary-card-arrow" />
              </div>
              <div className="nib-diary-card-foot">
                {mediaCount} {mediaCount === 1 ? 'title' : 'titles'} · covers auto-fetched
              </div>
            </button>

            <button className="nib-diary-card" onClick={() => setSection('books')}>
              <div className="nib-diary-card-top">
                <span
                  className="nib-diary-card-icon"
                  style={{ background: 'color-mix(in srgb, var(--nib-book) 14%, transparent)' }}
                >
                  <Icon name="book-marked" size={22} style={{ color: 'var(--nib-book)' }} />
                </span>
                <span style={{ flex: 1 }}>
                  <div className="nib-diary-card-title">Book notes</div>
                  <div className="nib-diary-card-desc">Highlights &amp; reflections</div>
                </span>
                <Icon name="arrow-up-right" size={18} className="nib-diary-card-arrow" />
              </div>
              <div className="nib-diary-card-foot">
                {bookCount} {bookCount === 1 ? 'book' : 'books'} · in shared search
              </div>
            </button>

            <div className="nib-diary-card nib-diary-card-add">
              <Icon name="plus" size={22} style={{ color: 'var(--nib-accent)' }} />
              <div className="nib-diary-card-title" style={{ marginTop: 10 }}>
                Add a section
              </div>
              <div className="nib-diary-card-desc" style={{ maxWidth: '28ch' }}>
                Letters, dreams, a gratitude log — install one from the plugin library
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nib-diary">
      <style>{styles}</style>
      <div className="nib-diary-crumb">
        <button className="nib-diary-crumb-back" onClick={() => setSection('home')}>
          <Icon name="chevron-left" size={15} />
          Diary
        </button>
        <Icon name="chevron-right" size={13} style={{ color: 'var(--nib-faint)' }} />
        <span className="nib-diary-crumb-current">{SECTION_LABEL[section]}</span>
        {section === 'entries' && status === 'unlocked' && (
          <button className="nib-diary-crumb-lock" onClick={() => void diaryApi.lock()}>
            🔒 Lock
          </button>
        )}
      </div>
      <div className="nib-diary-section">
        {section === 'entries' && <EntriesSection openRequest={openRequest} />}
        {section === 'media' && <MediaShelf />}
        {section === 'books' && <BookNotes />}
      </div>
    </div>
  );
}
