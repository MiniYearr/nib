import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSensitivePermission, validateManifest, type PluginManifest } from '@nib/plugin-api';
import type { InstalledPlugin } from './plugin-shared';

interface StoreFile {
  installed: InstalledPlugin[];
}

/** Persists installed third-party plugins and their user-approved grants under userData. */
export class PluginStore {
  private file: string;
  private pluginsDir: string;
  private data: StoreFile;

  constructor(userDataDir: string) {
    this.pluginsDir = join(userDataDir, 'plugins');
    this.file = join(userDataDir, 'plugins.json');
    mkdirSync(this.pluginsDir, { recursive: true });
    this.data = this.read();
  }

  private read(): StoreFile {
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as StoreFile;
    } catch {
      return { installed: [] };
    }
  }

  private write(): void {
    writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
  }

  list(): InstalledPlugin[] {
    return this.data.installed;
  }

  get(id: string): InstalledPlugin | undefined {
    return this.data.installed.find((plugin) => plugin.id === id);
  }

  /** Reads and validates a manifest from a candidate plugin directory. */
  static readManifest(dir: string): PluginManifest {
    const raw = readFileSync(join(dir, 'nib-plugin.json'), 'utf8');
    const validation = validateManifest(JSON.parse(raw));
    if (!validation.ok) {
      throw new Error(`invalid plugin manifest: ${validation.errors.join('; ')}`);
    }
    return validation.manifest;
  }

  /** Copies a plugin folder into userData and records it disabled, with only non-sensitive perms pre-granted. */
  install(sourceDir: string): InstalledPlugin {
    const manifest = PluginStore.readManifest(sourceDir);
    const targetDir = join(this.pluginsDir, manifest.id);
    rmSync(targetDir, { recursive: true, force: true });
    cpSync(sourceDir, targetDir, { recursive: true });

    const record: InstalledPlugin = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      dir: targetDir,
      enabled: false,
      requestedPermissions: manifest.permissions,
      grantedPermissions: manifest.permissions.filter((scope) => !isSensitivePermission(scope)),
    };

    this.data.installed = [
      ...this.data.installed.filter((plugin) => plugin.id !== manifest.id),
      record,
    ];
    this.write();
    return record;
  }

  update(id: string, patch: Partial<Pick<InstalledPlugin, 'enabled' | 'grantedPermissions'>>): void {
    const record = this.get(id);
    if (!record) return;
    if (patch.enabled !== undefined) record.enabled = patch.enabled;
    if (patch.grantedPermissions !== undefined) {
      // A plugin can only ever hold permissions it actually requested.
      record.grantedPermissions = patch.grantedPermissions.filter((scope) =>
        record.requestedPermissions.includes(scope),
      );
    }
    this.write();
  }

  uninstall(id: string): void {
    const record = this.get(id);
    if (record) rmSync(record.dir, { recursive: true, force: true });
    this.data.installed = this.data.installed.filter((plugin) => plugin.id !== id);
    this.write();
  }
}
