import { useCallback, useEffect, useState } from 'react';
import type { ModuleViewProps } from '@nib/shell';
import { MOODS, type DiaryEntryDto, type DiaryStatus } from '../shared';
import { diaryApi, todayStr } from './api';
import { EntryEditor } from './EntryEditor';
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
.nib-diary-gate p { margin: 0; font-size: 12.5px; color: #8A8171; max-width: 40ch; text-align: center; line-height: 1.5; }
.nib-diary-gate input {
  width: 260px;
  font: inherit;
  font-size: 13.5px;
  padding: 9px 12px;
  border: 1px solid rgba(30, 25, 18, 0.14);
  border-radius: 9px;
  background: #FBFAF7;
  outline: none;
  text-align: center;
}
.nib-diary-gate input:focus { border-color: #8A6BC8; }
.nib-diary-gate button {
  width: 260px;
  border: none;
  background: #8A6BC8;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 0;
  border-radius: 9px;
  cursor: default;
}
.nib-diary-gate button:disabled { opacity: 0.5; }
.nib-diary-error { color: #A54D3B; font-size: 12px; min-height: 16px; }
.nib-diary-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(30, 25, 18, 0.08);
  flex: none;
}
.nib-diary-tab {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  padding: 6px 12px;
  border-radius: 8px;
  color: #6B655C;
  cursor: default;
}
.nib-diary-tab[data-active='true'] { background: rgba(138, 107, 200, 0.14); color: #26221D; font-weight: 600; }
.nib-diary-lock-btn {
  margin-left: auto;
  border: 1px solid rgba(30, 25, 18, 0.1);
  background: transparent;
  font: inherit;
  font-size: 11.5px;
  padding: 5px 10px;
  border-radius: 8px;
  color: #6B655C;
  cursor: default;
}
.nib-diary-lock-btn:hover { background: rgba(138, 107, 200, 0.1); color: #26221D; }
.nib-diary-body { flex: 1; display: flex; min-height: 0; }
.nib-diary-list {
  width: 250px;
  flex: none;
  overflow-y: auto;
  border-right: 1px solid rgba(30, 25, 18, 0.08);
  padding: 10px 10px 30px;
}
.nib-diary-new {
  width: 100%;
  border: 1px dashed rgba(138, 107, 200, 0.5);
  background: transparent;
  color: #6B4FA8;
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
  color: #26221D;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nib-diary-item-date { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; color: #A79F92; }
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
  color: #8A6BC8;
}
.nib-diary-otd-chip {
  border: 1px solid rgba(138, 107, 200, 0.35);
  background: rgba(138, 107, 200, 0.08);
  font: inherit;
  font-size: 11.5px;
  color: #4A443B;
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
  color: #8A8171;
  font-size: 13px;
}
.nib-entry { display: flex; flex-direction: column; gap: 10px; padding: 14px 22px 40px; flex: 1; }
.nib-entry-meta { display: flex; align-items: center; gap: 10px; }
.nib-entry-meta input[type='date'] {
  font: inherit;
  font-size: 12px;
  border: 1px solid rgba(30, 25, 18, 0.1);
  border-radius: 7px;
  background: #FBFAF7;
  padding: 4px 8px;
  color: #26221D;
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
  border: 1px solid rgba(30, 25, 18, 0.1);
  background: transparent;
  font: inherit;
  font-size: 11px;
  padding: 4px 9px;
  border-radius: 7px;
  color: #6B655C;
  cursor: default;
}
.nib-entry-action:hover { background: rgba(30, 25, 18, 0.05); color: #26221D; }
.nib-entry-title {
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: #26221D;
}
.nib-entry-title::placeholder { color: #C9C2B4; }
.nib-entry-body {
  flex: 1;
  min-height: 260px;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  line-height: 1.65;
  color: #26221D;
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
.nib-entry-sealed p { margin: 0; font-size: 12.5px; color: #8A8171; }
.nib-entry-sealed input {
  font: inherit;
  font-size: 12.5px;
  padding: 7px 10px;
  border: 1px solid rgba(30, 25, 18, 0.14);
  border-radius: 8px;
  background: #FBFAF7;
  outline: none;
  text-align: center;
  width: 220px;
}
.nib-entry-sealed-actions { display: flex; gap: 8px; }
.nib-entry-sealed button {
  border: none;
  background: #8A6BC8;
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 8px;
  cursor: default;
}
.nib-entry-sealed button[data-secondary='true'] { background: transparent; color: #6B4FA8; border: 1px solid rgba(138, 107, 200, 0.4); }
.nib-entry-revealed {
  flex: 1;
  white-space: pre-wrap;
  font: inherit;
  font-size: 14px;
  line-height: 1.65;
  color: #26221D;
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
  border: 1px solid rgba(30, 25, 18, 0.12);
  border-radius: 7px;
  background: #FBFAF7;
  outline: none;
  width: 180px;
}
.nib-media { padding: 16px 20px 40px; overflow-y: auto; flex: 1; }
.nib-media-add { display: flex; gap: 8px; margin-bottom: 14px; align-items: center; flex-wrap: wrap; }
.nib-media-add input[type='text'] {
  font: inherit;
  font-size: 13px;
  padding: 7px 11px;
  border: 1px solid rgba(30, 25, 18, 0.12);
  border-radius: 9px;
  background: #FBFAF7;
  outline: none;
  width: 260px;
}
.nib-media-add select, .nib-media-add button {
  font: inherit;
  font-size: 12px;
  padding: 7px 11px;
  border: 1px solid rgba(30, 25, 18, 0.12);
  border-radius: 9px;
  background: #FBFAF7;
  color: #26221D;
  cursor: default;
}
.nib-media-add button { background: #BF6B44; border-color: #BF6B44; color: #fff; font-weight: 600; }
.nib-media-add button[data-secondary='true'] { background: transparent; border-color: rgba(30,25,18,0.12); color: #6B655C; font-weight: 400; }
.nib-media-hits { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
.nib-media-hit {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(30, 25, 18, 0.1);
  background: #FBFAF7;
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
  color: #6B7C9B;
  background: rgba(107, 124, 155, 0.12);
  padding: 2px 6px;
  border-radius: 5px;
}
.nib-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
.nib-media-card {
  background: #FBFAF7;
  border: 1px solid rgba(30, 25, 18, 0.1);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}
.nib-media-cover { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; display: block; background: #F1EDE6; }
.nib-media-cover-fallback {
  width: 100%;
  aspect-ratio: 2 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  background: #F1EDE6;
}
.nib-media-card-body { padding: 8px 10px 10px; }
.nib-media-card-title { font-size: 12px; font-weight: 600; color: #26221D; line-height: 1.3; }
.nib-media-card-meta { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; color: #8A8171; margin-top: 3px; }
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
`;

function Gate({
  mode,
  onDone,
}: {
  mode: 'setup' | 'unlock';
  onDone(): void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (mode === 'setup') {
      if (password.length < 4) return setError('Passphrase must be at least 4 characters');
      if (password !== confirm) return setError('Passphrases do not match');
      setBusy(true);
      try {
        await diaryApi.setup(password);
        onDone();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Setup failed');
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(true);
      try {
        const ok = await diaryApi.unlock(password);
        if (ok) onDone();
        else setError('Wrong passphrase');
      } finally {
        setBusy(false);
        setPassword('');
      }
    }
  };

  return (
    <div className="nib-diary-gate">
      <div className="nib-diary-gate-icon">🔒</div>
      <h2>{mode === 'setup' ? 'Set up your diary' : 'Diary is locked'}</h2>
      <p>
        {mode === 'setup'
          ? 'Everything you write is encrypted on this device with a passphrase only you know. There is no recovery if you forget it.'
          : 'Enter your passphrase to unlock. Entries stay invisible to search and the rest of Nib while locked.'}
      </p>
      <input
        type="password"
        placeholder="Passphrase"
        value={password}
        autoFocus
        onChange={(event) => setPassword(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && mode === 'unlock' && void submit()}
      />
      {mode === 'setup' && (
        <input
          type="password"
          placeholder="Repeat passphrase"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void submit()}
        />
      )}
      <div className="nib-diary-error">{error}</div>
      <button disabled={busy} onClick={() => void submit()}>
        {mode === 'setup' ? 'Create diary' : 'Unlock'}
      </button>
    </div>
  );
}

export function DiaryView({ openRequest }: ModuleViewProps) {
  const [status, setStatus] = useState<DiaryStatus | 'loading'>('loading');
  const [entries, setEntries] = useState<DiaryEntryDto[]>([]);
  const [onThisDay, setOnThisDay] = useState<DiaryEntryDto[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [tab, setTab] = useState<'journal' | 'media'>('journal');

  const refresh = useCallback(async () => {
    setEntries(await diaryApi.list());
    setOnThisDay(await diaryApi.onThisDay());
  }, []);

  useEffect(() => {
    void diaryApi.status().then((current) => {
      setStatus(current);
      if (current === 'unlocked') void refresh();
    });
    if (!window.nib) return;
    return window.nib.events.on('nib.diary.status', (event) => {
      const { status: next } = event.payload as { status: DiaryStatus };
      setStatus(next);
      if (next === 'unlocked') void refresh();
      else {
        setEntries([]);
        setOnThisDay([]);
        setSelectedId(undefined);
      }
    });
  }, [refresh]);

  useEffect(() => {
    if (openRequest && status === 'unlocked') {
      setTab('journal');
      setSelectedId(openRequest.record.id);
    }
  }, [openRequest, status]);

  const newEntry = async () => {
    const entry = await diaryApi.create({ date: todayStr() });
    await refresh();
    setSelectedId(entry.id);
  };

  const selected = entries.find((entry) => entry.id === selectedId);

  if (status === 'loading') return <div className="nib-diary" />;

  if (status !== 'unlocked') {
    return (
      <div className="nib-diary">
        <style>{styles}</style>
        <Gate
          mode={status === 'uninitialized' ? 'setup' : 'unlock'}
          onDone={() => {
            setStatus('unlocked');
            void refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="nib-diary">
      <style>{styles}</style>
      <div className="nib-diary-header">
        <button className="nib-diary-tab" data-active={tab === 'journal'} onClick={() => setTab('journal')}>
          Journal
        </button>
        <button className="nib-diary-tab" data-active={tab === 'media'} onClick={() => setTab('media')}>
          Media log
        </button>
        <button className="nib-diary-lock-btn" onClick={() => void diaryApi.lock()}>
          🔒 Lock
        </button>
      </div>

      {tab === 'journal' ? (
        <div className="nib-diary-body">
          <div className="nib-diary-list">
            <button className="nib-diary-new" onClick={() => void newEntry()}>
              + New entry
            </button>
            {entries.map((entry) => (
              <button
                key={entry.id}
                className="nib-diary-item"
                data-active={entry.id === selectedId}
                onClick={() => setSelectedId(entry.id)}
              >
                <span className="nib-diary-item-mood">
                  {MOODS.find((mood) => mood.id === entry.mood)?.emoji ?? '·'}
                </span>
                <span className="nib-diary-item-text">
                  <div className="nib-diary-item-title">{entry.title || 'Untitled'}</div>
                  <div className="nib-diary-item-date">{entry.date}</div>
                </span>
                {entry.locked && <span className="nib-diary-item-lock">🔐</span>}
              </button>
            ))}
          </div>
          <div className="nib-diary-main">
            {onThisDay.length > 0 && (
              <div className="nib-diary-otd">
                <span className="nib-diary-otd-label">On this day</span>
                {onThisDay.map((entry) => (
                  <button
                    key={entry.id}
                    className="nib-diary-otd-chip"
                    onClick={() => setSelectedId(entry.id)}
                  >
                    {entry.date.slice(0, 4)} · {entry.title || 'Untitled'}
                  </button>
                ))}
              </div>
            )}
            {selected ? (
              <EntryEditor
                key={selected.id}
                entry={selected}
                onChanged={refresh}
                onDeleted={() => {
                  setSelectedId(undefined);
                  void refresh();
                }}
              />
            ) : (
              <div className="nib-diary-empty">Select an entry or write a new one</div>
            )}
          </div>
        </div>
      ) : (
        <MediaShelf />
      )}
    </div>
  );
}
