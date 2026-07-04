/** Types and channels shared between the plugin host (main) and the sandbox bridge (preload). */

export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dir: string;
  enabled: boolean;
  requestedPermissions: string[];
  grantedPermissions: string[];
}

export interface InstalledPluginInfo extends InstalledPlugin {
  running: boolean;
  error?: string;
}

export interface FirstPartyPluginInfo {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

export const PLUGIN_CHANNELS = {
  listInstalled: 'nib.plugins:listInstalled',
  listFirstParty: 'nib.plugins:listFirstParty',
  install: 'nib.plugins:install',
  installFromPath: 'nib.plugins:installFromPath',
  setEnabled: 'nib.plugins:setEnabled',
  setGrants: 'nib.plugins:setGrants',
  uninstall: 'nib.plugins:uninstall',
  changed: 'nib.plugins.changed',
} as const;

/** Renderer<->broker RPC. The plugin only ever sees window.nib built on these. */
export const PLUGIN_RPC_CHANNEL = 'nib.plugin:rpc';
export const PLUGIN_INVOKE_COMMAND = 'nib.plugin:invoke-command';
export const PLUGIN_EVENT = 'nib.plugin:event';
