import { useCallback, useEffect, useState } from 'react';
import type { NibRecord } from '@nib/plugin-api';
import type { ModuleViewProps } from '@nib/shell';
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
  border-bottom: 1px solid rgba(30, 25, 18, 0.08);
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
  color: #6B655C;
  cursor: default;
  max-width: 180px;
  white-space: nowrap;
}
.nib-notepad-tab[data-active='true'] {
  background: #FBFAF7;
  border-color: rgba(30, 25, 18, 0.1);
  color: #26221D;
  font-weight: 600;
}
.nib-notepad-tab-title { overflow: hidden; text-overflow: ellipsis; }
.nib-notepad-tab-close {
  border: none;
  background: transparent;
  color: #9B948A;
  font-size: 13px;
  padding: 0 2px;
  border-radius: 4px;
  cursor: default;
}
.nib-notepad-tab-close:hover { color: #26221D; }
.nib-notepad-new {
  border: none;
  background: transparent;
  color: #8A8171;
  font-size: 17px;
  padding: 4px 9px;
  border-radius: 7px;
  cursor: default;
}
.nib-notepad-new:hover { background: rgba(30, 25, 18, 0.06); }
.nib-notepad-hint {
  margin-left: auto;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: #A79F92;
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
  color: #8A8171;
  font-size: 13.5px;
  user-select: none;
}
.nib-note-editor { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.nib-note-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 22px 0;
  flex: none;
}
.nib-note-title {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: #26221D;
}
.nib-note-title::placeholder { color: #C9C2B4; }
.nib-note-toolbar-actions { display: flex; align-items: center; gap: 8px; flex: none; }
.nib-note-mode {
  display: flex;
  background: #F1EDE6;
  border: 1px solid rgba(30, 25, 18, 0.08);
  border-radius: 8px;
  padding: 2px;
}
.nib-note-mode button {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 11.5px;
  padding: 4px 10px;
  border-radius: 6px;
  color: #6B655C;
  cursor: default;
}
.nib-note-mode button[data-active='true'] {
  background: #FBFAF7;
  color: #26221D;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.nib-note-action {
  border: 1px solid rgba(30, 25, 18, 0.1);
  background: transparent;
  font: inherit;
  font-size: 11.5px;
  padding: 5px 10px;
  border-radius: 8px;
  color: #6B655C;
  cursor: default;
}
.nib-note-action:hover, .nib-note-action[data-active='true'] {
  background: rgba(191, 107, 68, 0.1);
  color: #26221D;
}
.nib-note-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 22px 0;
  flex: none;
}
.nib-note-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(191, 107, 68, 0.1);
  color: #8C4F33;
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
  color: #6B655C;
  width: 72px;
}
.nib-note-body { flex: 1; display: flex; min-height: 0; position: relative; }
.nib-rich-editor { flex: 1; overflow-y: auto; padding: 4px 22px 40px; min-width: 0; }
.nib-rich-editor .ProseMirror { outline: none; font-size: 14.5px; line-height: 1.65; max-width: 72ch; }
.nib-rich-editor .ProseMirror p { margin: 0.45em 0; }
.nib-rich-editor .ProseMirror h1 { font-size: 1.6em; letter-spacing: -0.015em; }
.nib-rich-editor .ProseMirror h2 { font-size: 1.32em; letter-spacing: -0.01em; }
.nib-rich-editor .ProseMirror h3 { font-size: 1.15em; }
.nib-rich-editor .ProseMirror code {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.88em;
  background: #F1EDE6;
  border-radius: 4px;
  padding: 1px 4px;
}
.nib-rich-editor .ProseMirror pre {
  background: #F1EDE6;
  border-radius: 9px;
  padding: 12px 14px;
}
.nib-rich-editor .ProseMirror pre code { background: transparent; padding: 0; }
.nib-rich-editor .ProseMirror blockquote {
  border-left: 3px solid rgba(191, 107, 68, 0.5);
  margin-left: 0;
  padding-left: 14px;
  color: #6B655C;
}
.nib-rich-editor .ProseMirror ul[data-type='taskList'] { list-style: none; padding-left: 4px; }
.nib-rich-editor .ProseMirror ul[data-type='taskList'] li { display: flex; gap: 8px; }
.nib-rich-editor .ProseMirror ul[data-type='taskList'] li > label { flex: none; }
.nib-rich-editor .ProseMirror a { color: #BF6B44; }
.nib-source-editor { flex: 1; overflow: hidden; padding: 0 22px; min-width: 0; }
.nib-source-editor .cm-editor { height: 100%; }
.nib-versions {
  width: 280px;
  flex: none;
  border-left: 1px solid rgba(30, 25, 18, 0.08);
  background: #F7F3EB;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.nib-versions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  font-size: 12.5px;
  font-weight: 700;
}
.nib-versions-header button {
  border: none;
  background: transparent;
  font-size: 15px;
  color: #8A8171;
  cursor: default;
}
.nib-versions-empty { padding: 4px 14px 14px; font-size: 12px; color: #8A8171; line-height: 1.5; }
.nib-versions-list { padding: 0 8px; }
.nib-versions-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  font: inherit;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11.5px;
  color: #4A443B;
  padding: 7px 10px;
  border-radius: 7px;
  cursor: default;
}
.nib-versions-item[data-active='true'] { background: rgba(191, 107, 68, 0.12); }
.nib-versions-preview { padding: 10px 14px; border-top: 1px solid rgba(30, 25, 18, 0.08); }
.nib-versions-preview-title { font-size: 12.5px; font-weight: 700; margin-bottom: 6px; }
.nib-versions-preview pre {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  white-space: pre-wrap;
  color: #6B655C;
  max-height: 180px;
  overflow-y: auto;
  background: #FBFAF7;
  border: 1px solid rgba(30, 25, 18, 0.08);
  border-radius: 8px;
  padding: 8px 10px;
}
.nib-versions-restore {
  width: 100%;
  border: none;
  background: #BF6B44;
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 0;
  border-radius: 8px;
  cursor: default;
  margin-top: 8px;
}
`;

export function NotepadView({ openRequest }: ModuleViewProps) {
  const [tabs, setTabs] = useState<NibRecord[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [switcherOpen, setSwitcherOpen] = useState(false);

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
