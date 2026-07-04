import { Command } from 'cmdk';
import { useCallback, useEffect, useState } from 'react';
import type { CommandDescriptor } from '@nib/plugin-api';

export const paletteStyles = `
.nib-palette-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(38, 34, 29, 0.35);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 14vh;
  z-index: 100;
}
.nib-palette {
  width: 560px;
  max-width: calc(100vw - 48px);
  background: #FBFAF7;
  border: 1px solid rgba(30, 25, 18, 0.12);
  border-radius: 15px;
  box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}
.nib-palette [cmdk-input] {
  width: 100%;
  padding: 16px 18px;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 15px;
  color: #26221D;
  border-bottom: 1px solid rgba(30, 25, 18, 0.08);
}
.nib-palette [cmdk-list] {
  max-height: 320px;
  overflow-y: auto;
  padding: 6px;
}
.nib-palette [cmdk-item] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 9px;
  font-size: 13.5px;
  color: #26221D;
  cursor: default;
}
.nib-palette [cmdk-item][data-selected='true'] {
  background: rgba(191, 107, 68, 0.12);
}
.nib-palette [cmdk-empty] {
  padding: 14px;
  font-size: 13px;
  color: #8A8171;
}
.nib-palette-module {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  color: #8A8171;
  flex: none;
}
`;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [commands, setCommands] = useState<CommandDescriptor[]>([]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || !window.nib) return;
    void window.nib.commands.list().then(setCommands);
  }, [open]);

  const run = useCallback((id: string) => {
    setOpen(false);
    void window.nib?.commands.execute(id);
  }, []);

  if (!open) return null;

  return (
    <>
      <style>{paletteStyles}</style>
      <div className="nib-palette-backdrop" onClick={() => setOpen(false)}>
        <div className="nib-palette" onClick={(event) => event.stopPropagation()}>
          <Command label="Command palette">
            <Command.Input autoFocus placeholder="Type a command…" />
            <Command.List>
              <Command.Empty>No matching commands</Command.Empty>
              {commands.map((command) => (
                <Command.Item
                  key={command.id}
                  value={`${command.title} ${command.id}`}
                  onSelect={() => run(command.id)}
                >
                  <span>{command.title}</span>
                  <span className="nib-palette-module">{command.moduleId}</span>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </div>
      </div>
    </>
  );
}
