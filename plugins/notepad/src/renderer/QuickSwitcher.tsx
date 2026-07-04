import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import type { NibRecord } from '@nib/plugin-api';
import { paletteStyles } from '@nib/shell';
import { NOTE_TYPE } from '../shared';

export interface QuickSwitcherProps {
  open: boolean;
  onClose(): void;
  onPick(note: NibRecord): void;
}

export function QuickSwitcher({ open, onClose, onPick }: QuickSwitcherProps) {
  const [notes, setNotes] = useState<NibRecord[]>([]);

  useEffect(() => {
    if (!open || !window.nib) return;
    void window.nib.records.list({ type: NOTE_TYPE, limit: 200 }).then(setNotes);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="nib-palette-backdrop" onClick={onClose}>
      <style>{paletteStyles}</style>
      <div className="nib-palette" onClick={(event) => event.stopPropagation()}>
        <Command label="Switch note">
          <Command.Input autoFocus placeholder="Switch to note…" />
          <Command.List>
            <Command.Empty>No notes found</Command.Empty>
            {notes.map((note) => (
              <Command.Item
                key={note.id}
                value={`${note.title || 'Untitled'} ${note.id}`}
                onSelect={() => {
                  onClose();
                  onPick(note);
                }}
              >
                <span>{note.title || 'Untitled'}</span>
                <span className="nib-palette-module">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </span>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
