import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NibRecord } from '@nib/plugin-api';
import { CommandPalette } from './CommandPalette';
import { Icon } from './icons';
import { SearchOverlay } from './SearchOverlay';
import { SettingsModal } from './SettingsModal';
import { themeCss, useTheme } from './theme';
import { TitleBar } from './TitleBar';
import type { CompanionParts, ModuleHostApi, ModuleOpenRequest, RendererModule } from './module';

const COLLAPSE_KEY = 'nib.sidebar.collapsed';

const styles = `
.nib-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--nib-app);
  color: var(--nib-ink);
  font-family: 'Figtree', system-ui, sans-serif;
  overflow: hidden;
}
.nib-body { flex: 1; display: flex; min-height: 0; }
.nib-sidebar {
  width: 236px;
  flex: none;
  background: var(--nib-sidebar);
  border-right: 1px solid var(--nib-border);
  display: flex;
  flex-direction: column;
  padding: 12px 12px 12px;
  user-select: none;
  transition: width 0.16s ease, padding 0.16s ease;
  overflow: hidden;
}
.nib-sidebar[data-collapsed='true'] { width: 60px; padding-left: 8px; padding-right: 8px; }
.nib-sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--nib-paper);
  border: 1px solid var(--nib-border-strong);
  border-radius: 9px;
  padding: 8px 10px;
  margin-bottom: 16px;
  font-size: 12.5px;
  color: var(--nib-faint);
  cursor: text;
  text-align: left;
  width: 100%;
  font-family: inherit;
}
.nib-sidebar-search:hover { border-color: var(--nib-accent-soft); }
.nib-main { background: var(--nib-app); }
.nib-sidebar[data-collapsed='true'] .nib-sidebar-search { justify-content: center; padding: 8px 0; }
.nib-sidebar-search kbd {
  margin-left: auto;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--nib-faint);
}
.nib-hide-collapsed { display: inline; }
.nib-sidebar[data-collapsed='true'] .nib-hide-collapsed { display: none; }
.nib-sidebar-section {
  padding: 4px 6px 6px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nib-section);
  white-space: nowrap;
}
.nib-sidebar[data-collapsed='true'] .nib-sidebar-section { visibility: hidden; height: 8px; padding: 0; }
.nib-sidebar-module {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 8px 10px;
  border-radius: 9px;
  font: inherit;
  font-size: 13px;
  color: var(--nib-ink-2);
  cursor: default;
  text-align: left;
  white-space: nowrap;
}
.nib-sidebar[data-collapsed='true'] .nib-sidebar-module { justify-content: center; padding: 9px 0; }
.nib-sidebar-module:hover { background: var(--nib-border); }
.nib-sidebar-module[data-active='true'] {
  background: color-mix(in srgb, var(--nib-accent) 14%, transparent);
  color: var(--nib-ink);
  font-weight: 600;
}
.nib-sidebar-module[data-active='true'] .nib-sidebar-module-icon { color: var(--nib-accent); }
.nib-sidebar-module-icon { color: var(--nib-ink-2); display: flex; }
.nib-sidebar-spacer { flex: 1; }
.nib-main { flex: 1; min-width: 0; position: relative; overflow: hidden; }
.nib-welcome {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  user-select: none;
}
.nib-welcome-hint { font-size: 13.5px; color: var(--nib-muted); }
.nib-welcome-hint kbd {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  background: var(--nib-chip);
  border: 1px solid var(--nib-border);
  border-radius: 5px;
  padding: 1px 5px;
}
`;

function WelcomeMark() {
  return (
    <div style={{ position: 'relative', width: 44, height: 50, borderRadius: '15px 15px 17px 17px', background: 'var(--nib-accent)' }}>
      <div style={{ position: 'absolute', top: 17, left: 10, width: 7, height: 9, borderRadius: 3, background: '#fff' }} />
      <div style={{ position: 'absolute', top: 17, right: 10, width: 7, height: 9, borderRadius: 3, background: '#fff' }} />
      <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', width: 3, height: 10, background: 'var(--nib-accent)' }} />
      <div style={{ position: 'absolute', top: -15, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, borderRadius: '50%', background: 'var(--nib-accent)' }} />
    </div>
  );
}

export interface AppShellProps {
  modules?: RendererModule[];
  companion?: CompanionParts;
}

export function AppShell({ modules = [], companion }: AppShellProps) {
  const [activeModuleId, setActiveModuleId] = useState<string | undefined>(modules[0]?.id);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openRequests, setOpenRequests] = useState<Record<string, ModuleOpenRequest>>({});
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [companionOut, setCompanionOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }, []);

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
  const Dock = companion?.Dock;
  const Stage = companion?.Stage;

  return (
    <>
      <style>{themeCss}</style>
      <style>{styles}</style>
      <div className="nib-app">
        <TitleBar onToggleSidebar={toggleCollapsed} onOpenSettings={() => setSettingsOpen(true)} />
        <div className="nib-body">
          <aside className="nib-sidebar" data-collapsed={collapsed}>
            <button
              className="nib-sidebar-search"
              onClick={() => setSearchOpen(true)}
              title="Search everything"
            >
              <Icon name="search" size={14} style={{ color: 'var(--nib-faint)' }} />
              <span className="nib-hide-collapsed">Search everything</span>
              <kbd className="nib-hide-collapsed">⌃⇧F</kbd>
            </button>
            <div className="nib-sidebar-section">Modules</div>
            {modules.map((module) => (
              <button
                key={module.id}
                className="nib-sidebar-module"
                data-active={module.id === activeModuleId}
                title={module.title}
                onClick={() => setActiveModuleId(module.id)}
              >
                <span className="nib-sidebar-module-icon">
                  <Icon name={module.icon} size={16} />
                </span>
                <span className="nib-hide-collapsed">{module.title}</span>
              </button>
            ))}
            <div className="nib-sidebar-spacer" />
            {Dock && <Dock onPop={() => setCompanionOut(true)} collapsed={collapsed} />}
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
            {Stage && companionOut && <Stage onDock={() => setCompanionOut(false)} />}
          </main>
        </div>
      </div>
      <CommandPalette />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onOpenRecord={openRecord} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
      />
    </>
  );
}
