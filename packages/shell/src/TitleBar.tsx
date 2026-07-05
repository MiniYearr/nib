import { useEffect, useState } from 'react';
import { Icon } from './icons';

const styles = `
.nib-titlebar {
  height: 40px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px 0 10px;
  background: #EFEAE1;
  border-bottom: 1px solid rgba(30, 25, 18, 0.09);
  -webkit-app-region: drag;
  user-select: none;
}
.nib-titlebar-btn {
  -webkit-app-region: no-drag;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  color: #6B655C;
  padding: 0;
}
.nib-titlebar-toggle {
  width: 30px;
  height: 26px;
  border-radius: 7px;
}
.nib-titlebar-toggle:hover { background: rgba(30, 25, 18, 0.07); color: #26221D; }
.nib-titlebar-logo {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: #BF6B44;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.nib-titlebar-name { font-size: 12.5px; font-weight: 600; color: #26221D; }
.nib-titlebar-workspace { font-size: 12px; color: #9B948A; }
.nib-titlebar-spacer { flex: 1; }
.nib-titlebar-controls { display: flex; align-items: center; -webkit-app-region: no-drag; }
.nib-titlebar-control {
  width: 44px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #6B655C;
  cursor: default;
}
.nib-titlebar-control:hover { background: rgba(30, 25, 18, 0.08); color: #26221D; }
.nib-titlebar-control[data-danger='true']:hover { background: #C0533B; color: #fff; }
`;

export interface TitleBarProps {
  workspaceLabel?: string;
  onToggleSidebar(): void;
}

export function TitleBar({ workspaceLabel = "your workspace", onToggleSidebar }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = window.nib?.win;
    if (!win) return;
    void win.isMaximized().then(setMaximized);
    return win.onMaximizeChange(setMaximized);
  }, []);

  return (
    <div className="nib-titlebar">
      <style>{styles}</style>
      <button
        className="nib-titlebar-btn nib-titlebar-toggle"
        title="Toggle sidebar"
        onClick={onToggleSidebar}
      >
        <Icon name="panel-left" size={16} />
      </button>
      <div className="nib-titlebar-logo">
        <Icon name="pen-tool" size={12} />
      </div>
      <span className="nib-titlebar-name">Nib</span>
      <span className="nib-titlebar-workspace">— {workspaceLabel}</span>
      <div className="nib-titlebar-spacer" />
      <div className="nib-titlebar-controls">
        <button
          className="nib-titlebar-control"
          title="Minimize"
          onClick={() => window.nib?.win.minimize()}
        >
          <Icon name="minus" size={15} />
        </button>
        <button
          className="nib-titlebar-control"
          title={maximized ? 'Restore' : 'Maximize'}
          onClick={() => window.nib?.win.toggleMaximize()}
        >
          <Icon name={maximized ? 'copy' : 'square'} size={maximized ? 13 : 12} />
        </button>
        <button
          className="nib-titlebar-control"
          data-danger="true"
          title="Close"
          onClick={() => window.nib?.win.close()}
        >
          <Icon name="x" size={15} />
        </button>
      </div>
    </div>
  );
}
