import { BrowserWindow, dialog, ipcMain, session } from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NibCore } from '@nib/core';
import {
  createPermissionEngine,
  hostAllowed,
  type PermissionEngine,
} from '@nib/core';
import { trustedContents } from './broadcast';
import {
  PLUGIN_CHANNELS,
  PLUGIN_EVENT,
  PLUGIN_INVOKE_COMMAND,
  PLUGIN_RPC_CHANNEL,
  type FirstPartyPluginInfo,
  type InstalledPlugin,
  type InstalledPluginInfo,
} from './plugin-shared';
import { PluginStore } from './plugin-store';

interface RunningPlugin {
  record: InstalledPlugin;
  window: BrowserWindow;
  subscriptions: string[];
  disposeCommands: (() => void)[];
  error?: string;
}

const BLANK_PAGE = 'data:text/html,%3C!doctype%20html%3E%3Cmeta%20charset=utf-8%3E%3Ctitle%3ENib%20plugin%3C/title%3E';

/**
 * Runs third-party plugins in a hard sandbox: each gets a hidden, no-Node,
 * context-isolated BrowserWindow on its own session partition, and reaches Nib
 * only through an RPC broker that checks every call against the exact
 * permissions the user granted. The Chromium sandbox is the security boundary.
 */
export class ThirdPartyPluginHost {
  private store: PluginStore;
  private permissions: PermissionEngine;
  private running = new Map<string, RunningPlugin>();
  private byContentsId = new Map<number, string>();
  private firstParty: FirstPartyPluginInfo[] = [];

  constructor(
    private core: NibCore,
    userDataDir: string,
  ) {
    this.store = new PluginStore(userDataDir);
    // Third-party plugins are always enforced, regardless of the core mode
    // used for trusted in-repo modules.
    this.permissions = createPermissionEngine({ mode: 'enforce' });

    // One controlled fan-out of core events to plugins, filtered per grant.
    this.core.bus.on('*', (event) => {
      for (const plugin of this.running.values()) {
        const subscribed = plugin.subscriptions.some((pattern) =>
          matches(pattern, event.type),
        );
        if (!subscribed) continue;
        if (!this.permissions.check(plugin.record.id, `events:subscribe:${event.type}`)) continue;
        if (!plugin.window.isDestroyed()) plugin.window.webContents.send(PLUGIN_EVENT, event);
      }
    });

    ipcMain.handle(PLUGIN_RPC_CHANNEL, (ipcEvent, method: string, payload: unknown) =>
      this.handleRpc(ipcEvent.sender.id, method, payload),
    );
  }

  setFirstParty(plugins: FirstPartyPluginInfo[]): void {
    this.firstParty = plugins;
  }

  registerIpc(): void {
    ipcMain.handle(PLUGIN_CHANNELS.listInstalled, () => this.listInfo());
    ipcMain.handle(PLUGIN_CHANNELS.listFirstParty, () => this.firstParty);
    ipcMain.handle(PLUGIN_CHANNELS.install, () => this.installViaDialog());
    ipcMain.handle(PLUGIN_CHANNELS.installFromPath, (_event, dir: string) =>
      this.installFromPath(dir),
    );
    ipcMain.handle(PLUGIN_CHANNELS.setEnabled, (_event, id: string, enabled: boolean) =>
      this.setEnabled(id, enabled),
    );
    ipcMain.handle(PLUGIN_CHANNELS.setGrants, (_event, id: string, grants: string[]) =>
      this.setGrants(id, grants),
    );
    ipcMain.handle(PLUGIN_CHANNELS.uninstall, (_event, id: string) => this.uninstall(id));
  }

  startEnabled(): void {
    // Test/dev hook: install (but don't enable) a plugin folder at boot so the
    // sandbox can be exercised without driving the native folder dialog.
    const preinstall = process.env['NIB_INSTALL_PLUGIN'];
    if (preinstall) {
      try {
        this.store.install(preinstall);
      } catch (error) {
        console.error('[nib] NIB_INSTALL_PLUGIN failed', error);
      }
    }
    for (const record of this.store.list()) {
      if (record.enabled) void this.launch(record);
    }
  }

  private listInfo(): InstalledPluginInfo[] {
    return this.store.list().map((record) => ({
      ...record,
      running: this.running.has(record.id),
      error: this.running.get(record.id)?.error,
    }));
  }

  private notifyChanged(): void {
    for (const id of trustedContents) {
      const contents = BrowserWindow.getAllWindows()
        .map((window) => window.webContents)
        .find((wc) => wc.id === id);
      if (contents && !contents.isDestroyed()) contents.send(PLUGIN_CHANNELS.changed);
    }
  }

  private async installViaDialog(): Promise<InstalledPluginInfo[]> {
    const picked = await dialog.showOpenDialog({
      title: 'Install a Nib plugin (choose its folder)',
      properties: ['openDirectory'],
    });
    const dir = picked.filePaths[0];
    if (picked.canceled || !dir) return this.listInfo();
    return this.installFromPath(dir);
  }

  private installFromPath(dir: string): InstalledPluginInfo[] {
    this.store.install(dir);
    this.notifyChanged();
    return this.listInfo();
  }

  private async setEnabled(id: string, enabled: boolean): Promise<InstalledPluginInfo[]> {
    this.store.update(id, { enabled });
    if (enabled) await this.launch(this.store.get(id)!);
    else this.stop(id);
    this.notifyChanged();
    return this.listInfo();
  }

  private async setGrants(id: string, grants: string[]): Promise<InstalledPluginInfo[]> {
    this.store.update(id, { grantedPermissions: grants });
    const record = this.store.get(id);
    // Re-apply grants live so a revoke takes effect without a restart.
    if (record && this.running.has(id)) {
      this.stop(id);
      if (record.enabled) await this.launch(record);
    }
    this.notifyChanged();
    return this.listInfo();
  }

  private uninstall(id: string): InstalledPluginInfo[] {
    this.stop(id);
    this.store.uninstall(id);
    this.notifyChanged();
    return this.listInfo();
  }

  private async launch(record: InstalledPlugin): Promise<void> {
    this.stop(record.id);
    this.permissions.grant(record.id, record.grantedPermissions);

    // In-memory partition (no "persist:") — plugins need no on-disk session,
    // and a persistent one keeps a handle open that blocks a clean app exit.
    const partition = `nibplugin-${record.id}`;
    const pluginSession = session.fromPartition(partition);
    pluginSession.webRequest.onBeforeRequest((details, callback) => {
      const url = details.url;
      if (url.startsWith('data:') || url.startsWith('devtools:') || url.startsWith('blob:')) {
        callback({});
        return;
      }
      // Only declared + granted domains may leave the sandbox.
      callback({ cancel: !hostAllowed(record.grantedPermissions, url) });
    });

    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/plugin.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        partition,
      },
    });

    const plugin: RunningPlugin = {
      record,
      window,
      subscriptions: [],
      disposeCommands: [],
    };
    this.running.set(record.id, plugin);
    this.byContentsId.set(window.webContents.id, record.id);

    try {
      await window.loadURL(BLANK_PAGE);
      const source = readFileSync(join(record.dir, 'main.js'), 'utf8');
      await window.webContents.executeJavaScript(
        `(async () => { try { ${source}\n } catch (error) { console.error('[nib-plugin ${record.id}]', error); } })();`,
        true,
      );
    } catch (error) {
      plugin.error = error instanceof Error ? error.message : String(error);
      console.error(`[nib] third-party plugin "${record.id}" failed to launch`, error);
    }
  }

  private stop(id: string): void {
    const plugin = this.running.get(id);
    if (!plugin) return;
    for (const dispose of plugin.disposeCommands) dispose();
    this.byContentsId.delete(plugin.window.webContents.id);
    if (!plugin.window.isDestroyed()) plugin.window.destroy();
    this.running.delete(id);
  }

  stopAll(): void {
    for (const id of [...this.running.keys()]) this.stop(id);
  }

  private async handleRpc(contentsId: number, method: string, payload: unknown): Promise<unknown> {
    const pluginId = this.byContentsId.get(contentsId);
    if (!pluginId) throw new Error('unknown plugin sender');
    const plugin = this.running.get(pluginId)!;
    const allow = (capability: string) => this.permissions.check(pluginId, capability);
    const deny = (capability: string): never => {
      throw new Error(`permission denied: ${capability}`);
    };
    const typeOf = (id: string) =>
      this.core.data.get(id, { includeDeleted: true })?.type ?? '*';

    switch (method) {
      case 'records.list': {
        const options = (payload ?? {}) as { type?: string };
        if (!allow(`records:read:${options.type ?? '*'}`)) return [];
        return this.core.data.list(options);
      }
      case 'records.get': {
        const record = this.core.data.get(payload as string);
        if (!record) return undefined;
        return allow(`records:read:${record.type}`) ? record : undefined;
      }
      case 'records.search': {
        const { query, options } = payload as { query: string; options?: unknown };
        const hits = this.core.data.search(query, options as never);
        return hits.filter((hit) => allow(`records:read:${hit.record.type}`));
      }
      case 'records.create': {
        const input = payload as { type: string };
        if (!allow(`records:write:${input.type}`)) return deny(`records:write:${input.type}`);
        return this.core.data.create(pluginId, input as never);
      }
      case 'records.update': {
        const { id, patch } = payload as { id: string; patch: unknown };
        const type = typeOf(id);
        if (!allow(`records:write:${type}`)) return deny(`records:write:${type}`);
        return this.core.data.update(pluginId, id, patch as never);
      }
      case 'records.softDelete': {
        const id = payload as string;
        const type = typeOf(id);
        if (!allow(`records:write:${type}`)) return deny(`records:write:${type}`);
        return this.core.data.softDelete(pluginId, id);
      }
      case 'commands.register': {
        const { id, title } = payload as { id: string; title: string };
        const dispose = this.core.commands.register({
          id: `${pluginId}.${id}`,
          title,
          category: plugin.record.name,
          moduleId: pluginId,
          run: () => {
            if (!plugin.window.isDestroyed()) {
              plugin.window.webContents.send(PLUGIN_INVOKE_COMMAND, id);
            }
          },
        });
        plugin.disposeCommands.push(dispose);
        return undefined;
      }
      case 'events.on': {
        const { pattern } = payload as { pattern: string };
        plugin.subscriptions.push(pattern);
        return undefined;
      }
      case 'events.emit': {
        const { type, payload: eventPayload } = payload as { type: string; payload: unknown };
        if (!type.startsWith(`${pluginId}.`)) {
          throw new Error(`plugin events must be namespaced under "${pluginId}."`);
        }
        this.core.bus.emit(type, eventPayload, pluginId);
        return undefined;
      }
      case 'log': {
        console.log(`[nib-plugin ${pluginId}]`, payload);
        return undefined;
      }
      default:
        throw new Error(`unknown plugin RPC method: ${method}`);
    }
  }
}

function matches(pattern: string, type: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) return type.startsWith(pattern.slice(0, -1));
  return pattern === type;
}
