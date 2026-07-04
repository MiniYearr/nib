import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NibRecord } from '@nib/plugin-api';
import { CommandPalette } from './CommandPalette';
import { SearchOverlay } from './SearchOverlay';
import type { ModuleHostApi, ModuleOpenRequest, RendererModule } from './module';

const styles = `
.nib-shell {
  display: grid;
  grid-template-columns: 236px 1fr;
  height: 100vh;
  background: #FBFAF7;
  color: #26221D;
  font-family: 'Figtree', system-ui, sans-serif;
}
.nib-sidebar {
  background: #F3EFE7;
  border-right: 1px solid rgba(30, 25, 18, 0.08);
  display: flex;
  flex-direction: column;
  padding: 14px 12px;
  user-select: none;
}
.nib-sidebar-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 2px 6px 14px;
}
.nib-sidebar-brand-mark {
  width: 20px;
  height: 23px;
  border-radius: 7px 7px 8px 8px;
  background: #BF6B44;
  position: relative;
}
.nib-sidebar-brand-mark::before,
.nib-sidebar-brand-mark::after {
  content: '';
  position: absolute;
  top: 8px;
  width: 3.5px;
  height: 4.5px;
  border-radius: 2px;
  background: #fff;
}
.nib-sidebar-brand-mark::before { left: 4.5px; }
.nib-sidebar-brand-mark::after { right: 4.5px; }
.nib-sidebar-brand-name {
  font-size: 13.5px;
  font-weight: 700;
}
.nib-sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #FBFAF7;
  border: 1px solid rgba(30, 25, 18, 0.12);
  border-radius: 9px;
  padding: 8px 10px;
  margin-bottom: 16px;
  font-size: 12.5px;
  color: #9B948A;
  cursor: default;
  text-align: left;
  width: 100%;
  font-family: inherit;
}
.nib-sidebar-search kbd {
  margin-left: auto;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: #9B948A;
}
.nib-sidebar-section {
  padding: 4px 6px 6px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #A79F92;
}
.nib-sidebar-module {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 8px 10px;
  border-radius: 9px;
  font: inherit;
  font-size: 13px;
  color: #4A443B;
  cursor: default;
  text-align: left;
}
.nib-sidebar-module[data-active='true'] {
  background: rgba(191, 107, 68, 0.13);
  color: #26221D;
  font-weight: 600;
}
.nib-sidebar-module-icon { width: 16px; text-align: center; }
.nib-main { overflow: hidden; min-width: 0; }
.nib-welcome {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  user-select: none;
}
.nib-welcome-hint { font-size: 13.5px; color: #8A8171; }
.nib-welcome-hint kbd {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  background: #F1EDE6;
  border: 1px solid rgba(30, 25, 18, 0.08);
  border-radius: 5px;
  padding: 1px 5px;
}
`;

function WelcomeMark() {
  return (
    <div style={{ position: 'relative', width: 44, height: 50, borderRadius: '15px 15px 17px 17px', background: '#BF6B44' }}>
      <div style={{ position: 'absolute', top: 17, left: 10, width: 7, height: 9, borderRadius: 3, background: '#fff' }} />
      <div style={{ position: 'absolute', top: 17, right: 10, width: 7, height: 9, borderRadius: 3, background: '#fff' }} />
      <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', width: 3, height: 10, background: '#BF6B44' }} />
      <div style={{ position: 'absolute', top: -15, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, borderRadius: '50%', background: '#BF6B44' }} />
    </div>
  );
}

export interface AppShellProps {
  modules?: RendererModule[];
}

export function AppShell({ modules = [] }: AppShellProps) {
  const [activeModuleId, setActiveModuleId] = useState<string | undefined>(modules[0]?.id);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openRequests, setOpenRequests] = useState<Record<string, ModuleOpenRequest>>({});

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSearchOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openRecord = useCallback(
    (record: NibRecord) => {
      const owner = modules.find((module) => module.recordTypes.includes(record.type));
      if (!owner) return;
      setActiveModuleId(owner.id);
      setOpenRequests((current) => ({
        ...current,
        [owner.id]: { record, nonce: (current[owner.id]?.nonce ?? 0) + 1 },
      }));
    },
    [modules],
  );

  const host: ModuleHostApi = useMemo(() => ({ openRecord }), [openRecord]);
  const active = modules.find((module) => module.id === activeModuleId);

  return (
    <>
      <style>{styles}</style>
      <div className="nib-shell">
        <aside className="nib-sidebar">
          <div className="nib-sidebar-brand">
            <div className="nib-sidebar-brand-mark" />
            <span className="nib-sidebar-brand-name">Nib</span>
          </div>
          <button className="nib-sidebar-search" onClick={() => setSearchOpen(true)}>
            <span>Search everything</span>
            <kbd>⌃⇧F</kbd>
          </button>
          <div className="nib-sidebar-section">Modules</div>
          {modules.map((module) => (
            <button
              key={module.id}
              className="nib-sidebar-module"
              data-active={module.id === activeModuleId}
              onClick={() => setActiveModuleId(module.id)}
            >
              <span className="nib-sidebar-module-icon">{module.icon}</span>
              <span>{module.title}</span>
            </button>
          ))}
        </aside>
        <main className="nib-main">
          {active ? (
            <active.component host={host} openRequest={openRequests[active.id]} />
          ) : (
            <div className="nib-welcome">
              <WelcomeMark />
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.015em' }}>Nib</div>
              <div className="nib-welcome-hint">
                Press <kbd>Ctrl</kbd>+<kbd>K</kbd> for commands · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+
                <kbd>F</kbd> to search
              </div>
            </div>
          )}
        </main>
      </div>
      <CommandPalette />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onOpenRecord={openRecord} />
    </>
  );
}
