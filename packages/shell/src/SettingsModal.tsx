import { useEffect } from 'react';
import { Icon } from './icons';
import type { ThemeName } from './theme';

const styles = `
.nib-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(20, 16, 12, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.nib-settings-modal {
  width: 520px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  background: var(--nib-paper);
  border: 1px solid var(--nib-border-strong);
  border-radius: 16px;
  box-shadow: 0 40px 80px -20px var(--nib-shadow);
}
.nib-settings-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--nib-border);
}
.nib-settings-head h2 { margin: 0; font-size: 17px; letter-spacing: -0.015em; color: var(--nib-ink); }
.nib-settings-head button {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--nib-muted);
  font-size: 18px;
  cursor: default;
}
.nib-settings-body { padding: 18px 20px 24px; }
.nib-settings-section-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nib-section);
  margin-bottom: 12px;
}
.nib-settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
}
.nib-settings-row-text { flex: 1; }
.nib-settings-row-title { font-size: 13.5px; font-weight: 600; color: var(--nib-ink); }
.nib-settings-row-desc { font-size: 12px; color: var(--nib-muted); margin-top: 2px; }
.nib-theme-toggle {
  display: flex;
  background: var(--nib-chip);
  border: 1px solid var(--nib-border);
  border-radius: 9px;
  padding: 3px;
}
.nib-theme-toggle button {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  color: var(--nib-muted);
  padding: 6px 13px;
  border-radius: 7px;
  cursor: default;
}
.nib-theme-toggle button[data-active='true'] {
  background: var(--nib-paper);
  color: var(--nib-ink);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
`;

export interface SettingsModalProps {
  open: boolean;
  onClose(): void;
  theme: ThemeName;
  onThemeChange(theme: ThemeName): void;
}

export function SettingsModal({ open, onClose, theme, onThemeChange }: SettingsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="nib-settings-backdrop" onClick={onClose}>
      <style>{styles}</style>
      <div className="nib-settings-modal" onClick={(event) => event.stopPropagation()}>
        <div className="nib-settings-head">
          <Icon name="sliders-horizontal" size={17} />
          <h2>Customize Nib</h2>
          <button title="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="nib-settings-body">
          <div className="nib-settings-section-label">Appearance</div>
          <div className="nib-settings-row">
            <div className="nib-settings-row-text">
              <div className="nib-settings-row-title">Theme</div>
              <div className="nib-settings-row-desc">Light, or a deep warm charcoal dark mode.</div>
            </div>
            <div className="nib-theme-toggle" role="group" aria-label="Theme">
              <button data-active={theme === 'light'} onClick={() => onThemeChange('light')}>
                <Icon name="sun" size={14} />
                Light
              </button>
              <button data-active={theme === 'dark'} onClick={() => onThemeChange('dark')}>
                <Icon name="moon" size={14} />
                Dark
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
