import { useCallback, useEffect, useState } from 'react';
import type { NibRecord } from '@nib/plugin-api';
import { Icon, type ModuleViewProps } from '@nib/shell';
import { MODULE_ID, NOTE_TYPE } from '../shared';
import { NoteEditor } from './NoteEditor';
import { QuickSwitcher } from './QuickSwitcher';

const styles = `
.nib-notepad {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
}
.nib-notepad-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px 0;
  border-bottom: 1px solid var(--nib-border);
  overflow-x: auto;
  flex: none;
}
.nib-notepad-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  border-radius: 9px 9px 0 0;
  padding: 7px 8px 7px 12px;
  font: inherit;
  font-size: 12.5px;
  color: var(--nib-ink-2);
  cursor: default;
  max-width: 180px;
  white-space: nowrap;
}
.nib-notepad-tab[data-active='true'] {
  background: var(--nib-paper);
  border-color: var(--nib-border-strong);
  color: var(--nib-ink);
  font-weight: 600;
}
.nib-notepad-tab-title { overflow: hidden; text-overflow: ellipsis; }
.nib-notepad-tab-close {
  border: none;
  background: transparent;
  color: var(--nib-faint);
  font-size: 13px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  cursor: default;
}
.nib-notepad-tab-close:hover { background: var(--nib-border-strong); color: var(--nib-ink); }
.nib-notepad-new {
  border: none;
  background: transparent;
  color: var(--nib-muted);
  font-size: 17px;
  padding: 4px 9px;
  border-radius: 7px;
  cursor: default;
}
.nib-notepad-new:hover { background: var(--nib-border); }
.nib-notepad-hint {
  margin-left: auto;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--nib-section);
  padding-right: 8px;
  white-space: nowrap;
}
.nib-notepad-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--nib-muted);
  font-size: 13.5px;
  user-select: none;
}
.nib-note-editor { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.nib-tb {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 46px;
  flex: none;
  padding: 0 16px;
  border-bottom: 1px solid var(--nib-border);
  position: relative;
}
.nib-tb-modes {
  display: flex;
  background: var(--nib-chip);
  border: 1px solid var(--nib-border);
  border-radius: 8px;
  padding: 2px;
}
.nib-tb-modes button {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 11.5px;
  padding: 4px 11px;
  border-radius: 6px;
  color: var(--nib-muted);
  cursor: default;
}
.nib-tb-modes button[data-active='true'] {
  background: var(--nib-accent);
  color: #fff;
  font-weight: 600;
}
.nib-tb-divider { width: 1px; height: 20px; background: var(--nib-border-strong); }
.nib-tb-group { display: flex; align-items: center; gap: 2px; }
.nib-tb-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 7px;
  color: var(--nib-ink-2);
  cursor: default;
}
.nib-tb-btn:hover:not(:disabled) { background: var(--nib-border); color: var(--nib-ink); }
.nib-tb-btn[data-active='true'] { background: rgba(191, 107, 68, 0.14); color: var(--nib-accent-ink); }
.nib-tb-btn:disabled { opacity: 0.35; }
.nib-tb-link {
  position: absolute;
  top: 44px;
  left: 120px;
  z-index: 30;
  display: flex;
  gap: 6px;
  background: var(--nib-paper);
  border: 1px solid var(--nib-border-strong);
  border-radius: 9px;
  box-shadow: 0 12px 26px -12px rgba(50, 38, 24, 0.4);
  padding: 7px;
}
.nib-tb-link input {
  border: 1px solid var(--nib-border-strong);
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  padding: 5px 8px;
  width: 230px;
  outline: none;
  background: #fff;
}
.nib-tb-link button {
  border: none;
  background: var(--nib-accent);
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  padding: 0 12px;
  cursor: default;
}
.nib-tb-spacer { flex: 1; }
.nib-tb-history {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--nib-muted);
  border-radius: 8px;
  padding: 6px 11px;
  cursor: default;
}
.nib-tb-history[data-active='true'], .nib-tb-history:hover {
  background: rgba(191, 107, 68, 0.12);
  color: var(--nib-accent);
}
.nib-tb-more-wrap { position: relative; }
.nib-tb-more-scrim { position: fixed; inset: 0; z-index: 40; }
.nib-tb-more {
  position: absolute;
  top: 34px;
  right: 0;
  z-index: 41;
  min-width: 170px;
  background: var(--nib-paper);
  border: 1px solid var(--nib-border-strong);
  border-radius: 11px;
  box-shadow: 0 18px 40px -16px var(--nib-shadow);
  padding: 8px;
}
.nib-tb-more-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--nib-section);
  padding: 2px 8px 6px;
}
.nib-tb-more-item {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  color: var(--nib-ink);
  padding: 6px 8px;
  border-radius: 7px;
  cursor: default;
}
.nib-tb-more-item:hover { background: var(--nib-chip); }
.nib-tb-more-item input { accent-color: var(--nib-accent); }
.nib-note-head[data-bare='true'] { padding-top: 12px; padding-bottom: 4px; }
.nib-note-head[data-bare='true'] .nib-note-delete { opacity: 0.55; }
.nib-note-head[data-bare='true']:hover .nib-note-delete { opacity: 1; }
.nib-note-head { display: flex; align-items: center; gap: 12px; padding: 22px 40px 0; flex: none; }
.nib-note-title {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--nib-ink);
}
.nib-note-title::placeholder { color: var(--nib-placeholder); }
.nib-note-delete {
  border: 1px solid rgba(191, 68, 68, 0.3);
  background: transparent;
  font: inherit;
  font-size: 11.5px;
  color: var(--nib-danger);
  padding: 5px 10px;
  border-radius: 8px;
  cursor: default;
  flex: none;
}
.nib-note-delete:hover { background: rgba(191, 68, 68, 0.08); }
.nib-note-meta {
  padding: 6px 40px 0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--nib-section);
  flex: none;
}
.nib-bubble {
  display: flex;
  gap: 2px;
  background: var(--nib-ink);
  border-radius: 9px;
  padding: 3px;
  box-shadow: 0 10px 24px -10px rgba(0, 0, 0, 0.5);
}
.nib-bubble button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--nib-surface);
  border-radius: 6px;
  cursor: default;
}
.nib-bubble button:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
.nib-slash {
  position: fixed;
  z-index: 80;
  min-width: 190px;
  background: var(--nib-paper);
  border: 1px solid var(--nib-border-strong);
  border-radius: 11px;
  box-shadow: 0 20px 44px -16px rgba(50, 38, 24, 0.5);
  padding: 5px;
}
.nib-slash-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 13px;
  color: var(--nib-ink);
  padding: 7px 10px;
  border-radius: 8px;
  cursor: default;
  text-align: left;
}
.nib-slash-item[data-active='true'] { background: rgba(191, 107, 68, 0.12); }
.nib-slash-item svg { color: var(--nib-muted); }
.nib-note-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 40px 0;
  flex: none;
}
.nib-note-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(191, 107, 68, 0.1);
  color: var(--nib-accent-ink);
  font-size: 11.5px;
  padding: 3px 4px 3px 8px;
  border-radius: 6px;
}
.nib-note-tag button {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 12px;
  padding: 0 3px;
  cursor: default;
  opacity: 0.6;
}
.nib-note-tag button:hover { opacity: 1; }
.nib-note-tag-input {
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 11.5px;
  color: var(--nib-ink-2);
  width: 72px;
}
.nib-note-body { flex: 1; display: flex; min-height: 0; position: relative; }
.nib-rich-editor { flex: 1; overflow-y: auto; padding: 12px 40px 40px; min-width: 0; }
.nib-rich-editor .ProseMirror { outline: none; font-size: 14.5px; line-height: 1.65; max-width: 72ch; }
.nib-rich-editor .ProseMirror p { margin: 0.45em 0; }
.nib-rich-editor .ProseMirror h1 { font-size: 1.6em; letter-spacing: -0.015em; }
.nib-rich-editor .ProseMirror h2 { font-size: 1.32em; letter-spacing: -0.01em; }
.nib-rich-editor .ProseMirror h3 { font-size: 1.15em; }
.nib-rich-editor .ProseMirror code {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.88em;
  background: var(--nib-chip);
  border-radius: 4px;
  padding: 1px 4px;
}
.nib-rich-editor .ProseMirror pre {
  background: var(--nib-chip);
  border-radius: 9px;
  padding: 12px 14px;
}
.nib-rich-editor .ProseMirror pre code { background: transparent; padding: 0; }
.nib-rich-editor .ProseMirror blockquote {
  border-left: 3px solid rgba(191, 107, 68, 0.5);
  margin-left: 0;
  padding-left: 14px;
  color: var(--nib-ink-2);
}
.nib-rich-editor .ProseMirror ul[data-type='taskList'] { list-style: none; padding-left: 4px; }
.nib-rich-editor .ProseMirror ul[data-type='taskList'] li { display: flex; gap: 8px; }
.nib-rich-editor .ProseMirror ul[data-type='taskList'] li > label { flex: none; }
.nib-rich-editor .ProseMirror a { color: var(--nib-accent); }
.nib-source-editor { flex: 1; overflow: hidden; padding: 0 40px; min-width: 0; }
.nib-source-editor .cm-editor { height: 100%; }
`;

const TABS_KEY = 'nib.notepad.openTabs';
const ACTIVE_KEY = 'nib.notepad.activeTab';

export function NotepadView({ openRequest }: ModuleViewProps) {
  const [tabs, setTabs] = useState<NibRecord[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // Restore the previously-open tabs (across section switches / relaunch); if
  // none survive, open a fresh note so the section is never empty.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!window.nib) return;
      const readIds = (): string[] => {
        try {
          return JSON.parse(localStorage.getItem(TABS_KEY) ?? '[]') as string[];
        } catch {
          return [];
        }
      };
      const fetched = await Promise.all(readIds().map((id) => window.nib!.records.get(id)));
      const restored = fetched.filter(
        (record): record is NibRecord => Boolean(record) && record!.type === NOTE_TYPE,
      );
      if (cancelled) return;
      if (restored.length === 0) {
        const note = await window.nib.records.create(MODULE_ID, {
          type: NOTE_TYPE,
          title: '',
          bodyMd: '',
        });
        if (cancelled) return;
        setTabs([note]);
        setActiveId(note.id);
      } else {
        const savedActive = localStorage.getItem(ACTIVE_KEY) ?? undefined;
        setTabs(restored);
        setActiveId(restored.some((r) => r.id === savedActive) ? savedActive : restored[0]!.id);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the open set + active tab.
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(TABS_KEY, JSON.stringify(tabs.map((tab) => tab.id)));
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
      // ignore storage failures
    }
  }, [ready, tabs, activeId]);

  const openTab = useCallback((note: NibRecord) => {
    setTabs((current) =>
      current.some((tab) => tab.id === note.id) ? current : [...current, note],
    );
    setActiveId(note.id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      const next = current.filter((tab) => tab.id !== id);
      setActiveId((active) =>
        active === id ? (next[Math.min(index, next.length - 1)]?.id ?? undefined) : active,
      );
      return next;
    });
  }, []);

  useEffect(() => {
    if (openRequest) openTab(openRequest.record);
  }, [openRequest, openTab]);

  useEffect(() => {
    if (!window.nib) return;
    const offCreated = window.nib.events.on('record.created', (event) => {
      const { record } = event.payload as { record: NibRecord };
      if (record.type === NOTE_TYPE && event.source === MODULE_ID) openTab(record);
    });
    const offDeleted = window.nib.events.on('record.deleted', (event) => {
      const { id } = event.payload as { id: string };
      closeTab(id);
    });
    return () => {
      offCreated();
      offDeleted();
    };
  }, [openTab, closeTab]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setSwitcherOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const newNote = async () => {
    if (!window.nib) return;
    const note = await window.nib.records.create(MODULE_ID, {
      type: NOTE_TYPE,
      title: '',
      bodyMd: '',
    });
    openTab(note);
  };

  const onSaved = useCallback((record: NibRecord) => {
    setTabs((current) => current.map((tab) => (tab.id === record.id ? record : tab)));
  }, []);

  const active = tabs.find((tab) => tab.id === activeId);

  return (
    <div className="nib-notepad">
      <style>{styles}</style>
      <div className="nib-notepad-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className="nib-notepad-tab"
            data-active={tab.id === activeId}
            onClick={() => setActiveId(tab.id)}
          >
            <Icon name="file-text" size={13} style={{ opacity: 0.7 }} />
            <span className="nib-notepad-tab-title">{tab.title || 'Untitled'}</span>
            <span
              className="nib-notepad-tab-close"
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
            >
              ×
            </span>
          </button>
        ))}
        <button className="nib-notepad-new" title="New note" onClick={() => void newNote()}>
          +
        </button>
        <span className="nib-notepad-hint">Ctrl+P switch</span>
      </div>

      {active ? (
        <NoteEditor key={active.id} note={active} onSaved={onSaved} onDeleted={closeTab} />
      ) : (
        <div className="nib-notepad-empty">
          <span>No note open</span>
          <span>
            Create one with <strong>+</strong> or press <strong>Ctrl+P</strong> to switch
          </span>
        </div>
      )}

      <QuickSwitcher
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        onPick={openTab}
      />
    </div>
  );
}
