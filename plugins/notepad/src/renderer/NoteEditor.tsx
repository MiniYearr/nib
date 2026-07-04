import { useCallback, useEffect, useRef, useState } from 'react';
import type { NibRecord } from '@nib/plugin-api';
import { MODULE_ID } from '../shared';
import { RichEditor } from './RichEditor';
import { SourceEditor } from './SourceEditor';
import { VersionsPanel } from './VersionsPanel';

const AUTOSAVE_MS = 700;

export interface NoteEditorProps {
  note: NibRecord;
  onSaved(record: NibRecord): void;
  onDeleted(id: string): void;
}

export function NoteEditor({ note, onSaved, onDeleted }: NoteEditorProps) {
  const [mode, setMode] = useState<'rich' | 'source'>('rich');
  const [title, setTitle] = useState(note.title);
  const [tags, setTags] = useState(note.tags);
  const [tagDraft, setTagDraft] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [editorNonce, setEditorNonce] = useState(0);

  const markdownRef = useRef(note.bodyMd);
  const titleRef = useRef(note.title);
  const tagsRef = useRef(note.tags);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (!dirtyRef.current || !window.nib) return;
    dirtyRef.current = false;
    const updated = await window.nib.records.update(MODULE_ID, note.id, {
      title: titleRef.current,
      bodyMd: markdownRef.current,
      tags: tagsRef.current,
    });
    onSaved(updated);
  }, [note.id, onSaved]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  useEffect(() => () => void flush(), [flush]);

  const onMarkdownChange = useCallback(
    (markdown: string) => {
      markdownRef.current = markdown;
      scheduleSave();
    },
    [scheduleSave],
  );

  const changeTitle = (value: string) => {
    setTitle(value);
    titleRef.current = value;
    scheduleSave();
  };

  const changeTags = (value: string[]) => {
    setTags(value);
    tagsRef.current = value;
    scheduleSave();
  };

  const addTagFromDraft = () => {
    const tag = tagDraft.trim();
    if (tag && !tags.includes(tag)) changeTags([...tags, tag]);
    setTagDraft('');
  };

  const deleteNote = async () => {
    if (!window.nib) return;
    dirtyRef.current = false;
    await window.nib.records.softDelete(MODULE_ID, note.id);
    onDeleted(note.id);
  };

  const restoreVersion = async (versionId: number) => {
    if (!window.nib) return;
    await flush();
    const restored = await window.nib.records.restoreVersion(MODULE_ID, note.id, versionId);
    markdownRef.current = restored.bodyMd;
    titleRef.current = restored.title;
    tagsRef.current = restored.tags;
    setTitle(restored.title);
    setTags(restored.tags);
    setEditorNonce((nonce) => nonce + 1);
    setShowVersions(false);
    onSaved(restored);
  };

  return (
    <div className="nib-note-editor">
      <div className="nib-note-toolbar">
        <input
          className="nib-note-title"
          placeholder="Untitled"
          value={title}
          onChange={(event) => changeTitle(event.target.value)}
        />
        <div className="nib-note-toolbar-actions">
          <div className="nib-note-mode" role="group" aria-label="Editor mode">
            <button data-active={mode === 'rich'} onClick={() => setMode('rich')}>
              Rich
            </button>
            <button data-active={mode === 'source'} onClick={() => setMode('source')}>
              Source
            </button>
          </div>
          <button
            className="nib-note-action"
            data-active={showVersions}
            title="Version history"
            onClick={() => setShowVersions((open) => !open)}
          >
            History
          </button>
          <button className="nib-note-action" title="Delete note" onClick={() => void deleteNote()}>
            Delete
          </button>
        </div>
      </div>

      <div className="nib-note-tags">
        {tags.map((tag) => (
          <span key={tag} className="nib-note-tag">
            #{tag}
            <button onClick={() => changeTags(tags.filter((t) => t !== tag))}>×</button>
          </span>
        ))}
        <input
          className="nib-note-tag-input"
          placeholder="+ tag"
          value={tagDraft}
          onChange={(event) => setTagDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addTagFromDraft();
            }
          }}
          onBlur={addTagFromDraft}
        />
      </div>

      <div className="nib-note-body">
        {mode === 'rich' ? (
          <RichEditor
            key={`rich-${editorNonce}`}
            initialMarkdown={markdownRef.current}
            onMarkdownChange={onMarkdownChange}
          />
        ) : (
          <SourceEditor
            key={`source-${editorNonce}`}
            initialValue={markdownRef.current}
            onChange={onMarkdownChange}
          />
        )}
        {showVersions && (
          <VersionsPanel
            recordId={note.id}
            onRestore={(versionId) => void restoreVersion(versionId)}
            onClose={() => setShowVersions(false)}
          />
        )}
      </div>
    </div>
  );
}
