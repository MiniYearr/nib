import { useState } from 'react';
import { MOODS, type DiaryEntryDto } from '../shared';
import { diaryApi } from './api';

export interface EntryEditorProps {
  entry: DiaryEntryDto;
  onChanged(): void;
  onDeleted(): void;
}

export function EntryEditor({ entry, onChanged, onDeleted }: EntryEditorProps) {
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(entry.bodyMd);
  const [lockDraft, setLockDraft] = useState('');
  const [showLockForm, setShowLockForm] = useState(false);
  const [sealedPassword, setSealedPassword] = useState('');
  const [revealedBody, setRevealedBody] = useState<string>();
  const [error, setError] = useState('');

  const save = async (patch: Parameters<typeof diaryApi.update>[1]) => {
    await diaryApi.update(entry.id, patch);
    onChanged();
  };

  const lockEntry = async () => {
    setError('');
    try {
      await diaryApi.setEntryLock(entry.id, lockDraft);
      setLockDraft('');
      setShowLockForm(false);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not lock entry');
    }
  };

  const reveal = async () => {
    setError('');
    try {
      setRevealedBody(await diaryApi.unlockEntryBody(entry.id, sealedPassword));
    } catch {
      setError('Wrong entry passphrase');
    }
  };

  const removeLock = async () => {
    setError('');
    try {
      await diaryApi.removeEntryLock(entry.id, sealedPassword);
      setSealedPassword('');
      setRevealedBody(undefined);
      onChanged();
    } catch {
      setError('Wrong entry passphrase');
    }
  };

  return (
    <div className="nib-entry">
      <div className="nib-entry-meta">
        <input
          type="date"
          value={entry.date}
          onChange={(event) => event.target.value && void save({ date: event.target.value })}
        />
        <div className="nib-entry-moods">
          {MOODS.map((mood) => (
            <button
              key={mood.id}
              className="nib-entry-mood"
              data-active={entry.mood === mood.id}
              title={mood.label}
              onClick={() => void save({ mood: entry.mood === mood.id ? null : mood.id })}
            >
              {mood.emoji}
            </button>
          ))}
        </div>
        <div className="nib-entry-actions">
          {!entry.locked && !showLockForm && (
            <button className="nib-entry-action" onClick={() => setShowLockForm(true)}>
              🔐 Lock entry
            </button>
          )}
          <button
            className="nib-entry-action"
            onClick={() => void diaryApi.remove(entry.id).then(onDeleted)}
          >
            Delete
          </button>
        </div>
      </div>

      {showLockForm && !entry.locked && (
        <div className="nib-entry-lockrow">
          <input
            type="password"
            placeholder="Entry passphrase"
            value={lockDraft}
            autoFocus
            onChange={(event) => setLockDraft(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void lockEntry()}
          />
          <button className="nib-entry-action" onClick={() => void lockEntry()}>
            Seal body
          </button>
          <button className="nib-entry-action" onClick={() => setShowLockForm(false)}>
            Cancel
          </button>
          <span className="nib-diary-error">{error}</span>
        </div>
      )}

      <input
        className="nib-entry-title"
        placeholder="Untitled"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => title !== entry.title && void save({ title })}
      />

      {!entry.locked ? (
        <textarea
          className="nib-entry-body"
          placeholder="Dear diary…"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onBlur={() => body !== entry.bodyMd && void save({ bodyMd: body })}
        />
      ) : revealedBody !== undefined ? (
        <>
          <div className="nib-entry-revealed">{revealedBody}</div>
          <div className="nib-entry-lockrow">
            <button className="nib-entry-action" onClick={() => setRevealedBody(undefined)}>
              Hide again
            </button>
            <button className="nib-entry-action" onClick={() => void removeLock()}>
              Remove lock permanently
            </button>
          </div>
        </>
      ) : (
        <div className="nib-entry-sealed">
          <p>This entry's body is sealed behind its own passphrase.</p>
          <input
            type="password"
            placeholder="Entry passphrase"
            value={sealedPassword}
            onChange={(event) => setSealedPassword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void reveal()}
          />
          <div className="nib-entry-sealed-actions">
            <button onClick={() => void reveal()}>Reveal</button>
          </div>
          <span className="nib-diary-error">{error}</span>
        </div>
      )}
    </div>
  );
}
