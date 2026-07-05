import { useEffect, useState } from 'react';
import type { MediaItemDto, MediaKind, MediaLookupHit } from '../shared';
import { diaryApi, todayStr } from './api';

const KIND_EMOJI: Record<MediaKind, string> = {
  game: '🎮',
  show: '📺',
  anime: '🌸',
  movie: '🎬',
  other: '📦',
};

export function MediaShelf() {
  const [items, setItems] = useState<MediaItemDto[]>([]);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<MediaKind>('anime');
  const [hits, setHits] = useState<MediaLookupHit[]>();
  const [busy, setBusy] = useState(false);

  const refresh = () => void diaryApi.mediaList().then(setItems);
  useEffect(refresh, []);

  const lookup = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      setHits(await diaryApi.mediaLookup(query.trim()));
    } catch {
      setHits([]);
    } finally {
      setBusy(false);
    }
  };

  const add = async (hit?: MediaLookupHit) => {
    setBusy(true);
    try {
      await diaryApi.mediaAdd({
        kind: hit?.kind ?? kind,
        title: hit?.title ?? query.trim(),
        year: hit?.year,
        source: hit?.source,
        url: hit?.url,
        coverUrl: hit?.coverUrl,
        completedAt: todayStr(),
      });
      setQuery('');
      setHits(undefined);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nib-media">
      <div className="nib-media-add">
        <input
          type="text"
          placeholder="Finished something? Type its title…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void lookup()}
        />
        <select value={kind} onChange={(event) => setKind(event.target.value as MediaKind)}>
          <option value="anime">Anime</option>
          <option value="show">Show</option>
          <option value="game">Game</option>
          <option value="movie">Movie</option>
          <option value="other">Other</option>
        </select>
        <button disabled={busy || !query.trim()} onClick={() => void lookup()}>
          Look up
        </button>
        <button
          data-secondary="true"
          disabled={busy || !query.trim()}
          onClick={() => void add()}
        >
          Add without lookup
        </button>
      </div>

      {hits !== undefined && (
        <div className="nib-media-hits">
          {hits.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--nib-muted)' }}>No matches found — you can still add it manually.</span>}
          {hits.map((hit, index) => (
            <button key={index} className="nib-media-hit" onClick={() => void add(hit)}>
              <span>{KIND_EMOJI[hit.kind] ?? '📦'}</span>
              <span>
                {hit.title}
                {hit.year ? ` (${hit.year})` : ''}
              </span>
              <span className="nib-media-hit-source">{hit.source}</span>
            </button>
          ))}
        </div>
      )}

      <div className="nib-media-grid">
        {items.map((item) => (
          <div key={item.id} className="nib-media-card">
            {item.coverDataUri ? (
              <img className="nib-media-cover" src={item.coverDataUri} alt={item.title} />
            ) : (
              <div className="nib-media-cover-fallback">{KIND_EMOJI[item.kind] ?? '📦'}</div>
            )}
            <div className="nib-media-card-body">
              <div className="nib-media-card-title">{item.title}</div>
              <div className="nib-media-card-meta">
                {[item.year, item.kind, item.completedAt].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button
              className="nib-media-card-remove"
              onClick={() => void diaryApi.mediaRemove(item.id).then(refresh)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
