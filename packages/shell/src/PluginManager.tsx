import { useCallback, useEffect, useState } from 'react';
import { describePermission, isSensitivePermission } from '@nib/plugin-api';

const PLUGIN_CHANNELS = {
  listInstalled: 'nib.plugins:listInstalled',
  listFirstParty: 'nib.plugins:listFirstParty',
  install: 'nib.plugins:install',
  setEnabled: 'nib.plugins:setEnabled',
  setGrants: 'nib.plugins:setGrants',
  uninstall: 'nib.plugins:uninstall',
  changed: 'nib.plugins.changed',
};

interface InstalledPluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  enabled: boolean;
  requestedPermissions: string[];
  grantedPermissions: string[];
  running: boolean;
  error?: string;
}

interface FirstPartyPluginInfo {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

const styles = `
.nib-plugins { padding: 18px 22px 40px; overflow-y: auto; height: 100%; }
.nib-plugins-head { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.nib-plugins-head h2 { margin: 0; font-size: 18px; letter-spacing: -0.015em; }
.nib-plugins-install {
  margin-left: auto;
  border: none;
  background: var(--nib-accent);
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 9px;
  cursor: default;
}
.nib-plugins-note { font-size: 12px; color: var(--nib-muted); line-height: 1.5; margin: 0 0 18px; max-width: 66ch; }
.nib-plugins-section {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nib-section);
  margin: 18px 0 10px;
}
.nib-plugin-card {
  border: 1px solid var(--nib-border-strong);
  border-radius: 13px;
  background: var(--nib-paper);
  padding: 14px 16px;
  margin-bottom: 10px;
}
.nib-plugin-card-top { display: flex; align-items: flex-start; gap: 10px; }
.nib-plugin-card-icon {
  width: 34px; height: 34px; border-radius: 9px; flex: none;
  background: color-mix(in srgb, var(--nib-accent) 14%, transparent);
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}
.nib-plugin-card-title { font-size: 13.5px; font-weight: 700; color: var(--nib-ink); }
.nib-plugin-card-desc { font-size: 12px; color: var(--nib-ink-2); margin-top: 2px; line-height: 1.45; }
.nib-plugin-card-badge {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 5px;
  margin-left: 6px;
}
.nib-plugin-card-badge[data-kind='builtin'] { color: var(--nib-info); background: color-mix(in srgb, var(--nib-info) 12%, transparent); }
.nib-plugin-card-badge[data-kind='community'] { color: var(--nib-accent-ink); background: color-mix(in srgb, var(--nib-accent) 14%, transparent); }
.nib-plugin-card-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; flex: none; }
.nib-plugin-toggle {
  border: 1px solid var(--nib-border-strong);
  background: transparent;
  font: inherit;
  font-size: 11.5px;
  padding: 5px 12px;
  border-radius: 8px;
  color: var(--nib-ink-2);
  cursor: default;
}
.nib-plugin-toggle[data-on='true'] { background: rgba(110, 139, 106, 0.16); color: var(--nib-streak-ink); border-color: rgba(110, 139, 106, 0.4); font-weight: 600; }
.nib-plugin-remove { border: none; background: transparent; color: var(--nib-placeholder); font-size: 15px; cursor: default; }
.nib-plugin-remove:hover { color: var(--nib-danger); }
.nib-plugin-perms { margin-top: 12px; border-top: 1px solid var(--nib-border); padding-top: 10px; }
.nib-plugin-perm {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  color: var(--nib-ink);
  padding: 4px 0;
}
.nib-plugin-perm input { accent-color: var(--nib-accent); }
.nib-plugin-perm[data-sensitive='true'] .nib-plugin-perm-text { color: var(--nib-danger); }
.nib-plugin-perm-scope {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--nib-section);
  margin-left: auto;
}
.nib-plugin-error { font-size: 11.5px; color: var(--nib-danger); margin-top: 6px; }
.nib-plugin-empty { font-size: 12.5px; color: var(--nib-muted); padding: 4px 0 12px; }
`;

function FirstPartyCard({ plugin }: { plugin: FirstPartyPluginInfo }) {
  return (
    <div className="nib-plugin-card">
      <div className="nib-plugin-card-top">
        <div className="nib-plugin-card-icon">🧩</div>
        <div>
          <div className="nib-plugin-card-title">
            {plugin.name}
            <span className="nib-plugin-card-badge" data-kind="builtin">
              built-in
            </span>
          </div>
          {plugin.description && <div className="nib-plugin-card-desc">{plugin.description}</div>}
        </div>
      </div>
    </div>
  );
}

function ThirdPartyCard({
  plugin,
  onToggleGrant,
  onSetEnabled,
  onUninstall,
}: {
  plugin: InstalledPluginInfo;
  onToggleGrant(scope: string, granted: boolean): void;
  onSetEnabled(enabled: boolean): void;
  onUninstall(): void;
}) {
  return (
    <div className="nib-plugin-card">
      <div className="nib-plugin-card-top">
        <div className="nib-plugin-card-icon">🧩</div>
        <div style={{ minWidth: 0 }}>
          <div className="nib-plugin-card-title">
            {plugin.name}
            <span className="nib-plugin-card-badge" data-kind="community">
              community
            </span>
          </div>
          <div className="nib-plugin-card-desc">
            {plugin.description ?? 'No description'} · v{plugin.version}
            {plugin.author ? ` · ${plugin.author}` : ''}
          </div>
        </div>
        <div className="nib-plugin-card-actions">
          <button
            className="nib-plugin-toggle"
            data-on={plugin.enabled}
            onClick={() => onSetEnabled(!plugin.enabled)}
          >
            {plugin.enabled ? 'Enabled' : 'Enable'}
          </button>
          <button className="nib-plugin-remove" title="Uninstall" onClick={onUninstall}>
            ×
          </button>
        </div>
      </div>

      {plugin.requestedPermissions.length > 0 && (
        <div className="nib-plugin-perms">
          {plugin.requestedPermissions.map((scope) => {
            const sensitive = isSensitivePermission(scope);
            return (
              <label key={scope} className="nib-plugin-perm" data-sensitive={sensitive}>
                <input
                  type="checkbox"
                  checked={plugin.grantedPermissions.includes(scope)}
                  onChange={(event) => onToggleGrant(scope, event.target.checked)}
                />
                <span className="nib-plugin-perm-text">
                  {describePermission(scope)}
                  {sensitive ? ' ⚠' : ''}
                </span>
                <span className="nib-plugin-perm-scope">{scope}</span>
              </label>
            );
          })}
        </div>
      )}
      {plugin.error && <div className="nib-plugin-error">Failed to run: {plugin.error}</div>}
    </div>
  );
}

export function PluginManager() {
  const [installed, setInstalled] = useState<InstalledPluginInfo[]>([]);
  const [firstParty, setFirstParty] = useState<FirstPartyPluginInfo[]>([]);

  const refresh = useCallback(async () => {
    if (!window.nib) return;
    setInstalled((await window.nib.invoke(PLUGIN_CHANNELS.listInstalled)) as InstalledPluginInfo[]);
    setFirstParty(
      (await window.nib.invoke(PLUGIN_CHANNELS.listFirstParty)) as FirstPartyPluginInfo[],
    );
  }, []);

  useEffect(() => {
    void refresh();
    return window.nib?.events.on(PLUGIN_CHANNELS.changed, () => void refresh());
  }, [refresh]);

  const install = async () => {
    setInstalled((await window.nib!.invoke(PLUGIN_CHANNELS.install)) as InstalledPluginInfo[]);
  };

  const toggleGrant = async (plugin: InstalledPluginInfo, scope: string, granted: boolean) => {
    const next = granted
      ? [...plugin.grantedPermissions, scope]
      : plugin.grantedPermissions.filter((s) => s !== scope);
    setInstalled(
      (await window.nib!.invoke(PLUGIN_CHANNELS.setGrants, plugin.id, next)) as InstalledPluginInfo[],
    );
  };

  const setEnabled = async (plugin: InstalledPluginInfo, enabled: boolean) => {
    setInstalled(
      (await window.nib!.invoke(
        PLUGIN_CHANNELS.setEnabled,
        plugin.id,
        enabled,
      )) as InstalledPluginInfo[],
    );
  };

  const uninstall = async (plugin: InstalledPluginInfo) => {
    setInstalled(
      (await window.nib!.invoke(PLUGIN_CHANNELS.uninstall, plugin.id)) as InstalledPluginInfo[],
    );
  };

  return (
    <div className="nib-plugins">
      <style>{styles}</style>
      <div className="nib-plugins-head">
        <h2>Modules</h2>
        <button className="nib-plugins-install" onClick={() => void install()}>
          + Install plugin
        </button>
      </div>
      <p className="nib-plugins-note">
        Built-in modules are part of Nib. Community plugins run in an isolated sandbox and can only
        do what you grant them — sensitive permissions (⚠) are off until you turn them on, so a
        plugin can never silently read your diary or reach the network.
      </p>

      <div className="nib-plugins-section">Community plugins</div>
      {installed.length === 0 && (
        <div className="nib-plugin-empty">
          None installed yet. Use “Install plugin” to add one from a folder.
        </div>
      )}
      {installed.map((plugin) => (
        <ThirdPartyCard
          key={plugin.id}
          plugin={plugin}
          onToggleGrant={(scope, granted) => void toggleGrant(plugin, scope, granted)}
          onSetEnabled={(enabled) => void setEnabled(plugin, enabled)}
          onUninstall={() => void uninstall(plugin)}
        />
      ))}

      <div className="nib-plugins-section">Built-in</div>
      {firstParty.map((plugin) => (
        <FirstPartyCard key={plugin.id} plugin={plugin} />
      ))}
    </div>
  );
}
