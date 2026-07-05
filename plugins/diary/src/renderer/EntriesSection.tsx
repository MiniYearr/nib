import { useCallback, useEffect, useState } from 'react';
import type { ModuleOpenRequest } from '@nib/shell';
import { MOODS, type DiaryEntryDto, type DiaryStatus } from '../shared';
import { diaryApi, todayStr } from './api';
import { EntryEditor } from './EntryEditor';

function Gate({ mode, onDone }: { mode: 'setup' | 'unlock'; onDone(): void }) {
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
      <h2>{mode === 'setup' ? 'Set up your journal' : 'Journal is locked'}</h2>
      <p>
        {mode === 'setup'
          ? 'Your journal entries are encrypted on this device with a passphrase only you know. There is no recovery if you forget it.'
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
        {mode === 'setup' ? 'Create journal' : 'Unlock'}
      </button>
    </div>
  );
}

export function EntriesSection({ openRequest }: { openRequest?: ModuleOpenRequest }) {
  const [status, setStatus] = useState<DiaryStatus | 'loading'>('loading');
  const [entries, setEntries] = useState<DiaryEntryDto[]>([]);
  const [onThisDay, setOnThisDay] = useState<DiaryEntryDto[]>([]);
  const [selectedId, setSelectedId] = useState<string>();

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
    if (openRequest && status === 'unlocked') setSelectedId(openRequest.record.id);
  }, [openRequest, status]);

  const newEntry = async () => {
    const entry = await diaryApi.create({ date: todayStr() });
    await refresh();
    setSelectedId(entry.id);
  };

  const selected = entries.find((entry) => entry.id === selectedId);

  if (status === 'loading') return <div className="nib-diary-body" />;

  if (status !== 'unlocked') {
    return (
      <Gate
        mode={status === 'uninitialized' ? 'setup' : 'unlock'}
        onDone={() => {
          setStatus('unlocked');
          void refresh();
        }}
      />
    );
  }

  return (
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
  );
}
