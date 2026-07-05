import { useCallback, useEffect, useRef, useState } from 'react';
import type { NibRecord, SearchHit } from '@nib/plugin-api';

const styles = `
.nib-search-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(38, 34, 29, 0.35);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
  z-index: 100;
}
.nib-search {
  width: 640px;
  max-width: calc(100vw - 48px);
  background: var(--nib-paper);
  border: 1px solid var(--nib-border-strong);
  border-radius: 15px;
  box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}
.nib-search input {
  width: 100%;
  padding: 16px 18px;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 15px;
  color: var(--nib-ink);
  border-bottom: 1px solid var(--nib-border);
}
.nib-search-results {
  max-height: 380px;
  overflow-y: auto;
  padding: 6px;
}
.nib-search-group {
  padding: 10px 14px 4px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nib-faint);
}
.nib-search-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 9px 14px;
  border-radius: 9px;
  font: inherit;
  cursor: default;
}
.nib-search-item[data-active='true'] {
  background: rgba(191, 107, 68, 0.12);
}
.nib-search-item-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--nib-ink);
  margin-bottom: 2px;
}
.nib-search-item-snippet {
  font-size: 12.5px;
  color: var(--nib-ink-2);
}
.nib-search-item-snippet mark {
  background: rgba(191, 107, 68, 0.25);
  color: inherit;
  border-radius: 3px;
  padding: 0 1px;
}
.nib-search-empty {
  padding: 16px;
  font-size: 13px;
  color: var(--nib-muted);
}
`;

/** FTS snippets arrive with ⟪match⟫ markers; alternate segments are matches. */
function Snippet({ text }: { text: string }) {
  const segments = text.split(/[⟪⟫]/);
  return (
    <span>
      {segments.map((segment, index) =>
        index % 2 === 1 ? <mark key={index}>{segment}</mark> : <span key={index}>{segment}</span>,
      )}
    </span>
  );
}

export interface SearchOverlayProps {
  open: boolean;
  onClose(): void;
  onOpenRecord(record: NibRecord): void;
}

export function SearchOverlay({ open, onClose, onOpenRecord }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHits([]);
      setActiveIndex(0);
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !window.nib) return;
    clearTimeout(debounce.current);
    if (!query.trim()) {
      setHits([]);
      return;
    }
    debounce.current = setTimeout(() => {
      void window.nib!.search(query).then((results) => {
        setHits(results);
        setActiveIndex(0);
      });
    }, 150);
    return () => clearTimeout(debounce.current);
  }, [open, query]);

  const pick = useCallback(
    (hit: SearchHit) => {
      onClose();
      onOpenRecord(hit.record);
    },
    [onClose, onOpenRecord],
  );

  if (!open) return null;

  const grouped = new Map<string, SearchHit[]>();
  for (const hit of hits) {
    const group = grouped.get(hit.record.type) ?? [];
    group.push(hit);
    grouped.set(hit.record.type, group);
  }
  const flat = [...grouped.values()].flat();

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, flat.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && flat[activeIndex]) {
      event.preventDefault();
      pick(flat[activeIndex]);
    }
  };

  let flatIndex = -1;

  return (
    <>
      <style>{styles}</style>
      <div className="nib-search-backdrop" onClick={onClose}>
        <div className="nib-search" onClick={(event) => event.stopPropagation()}>
          <input
            autoFocus
            placeholder="Search everything…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="nib-search-results">
            {query.trim() !== '' && flat.length === 0 && (
              <div className="nib-search-empty">No results</div>
            )}
            {[...grouped.entries()].map(([type, groupHits]) => (
              <div key={type}>
                <div className="nib-search-group">{type}</div>
                {groupHits.map((hit) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  return (
                    <button
                      key={hit.record.id}
                      className="nib-search-item"
                      data-active={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => pick(hit)}
                    >
                      <div className="nib-search-item-title">
                        {hit.record.title || 'Untitled'}
                      </div>
                      <div className="nib-search-item-snippet">
                        <Snippet text={hit.snippet} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
