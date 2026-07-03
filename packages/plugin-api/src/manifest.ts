export interface CommandContribution {
  /** Unique within the plugin; the palette-facing id becomes `<pluginId>.<id>`. */
  id: string;
  title: string;
  category?: string;
}

export interface PanelContribution {
  id: string;
  title: string;
  icon?: string;
}

export interface RecordTypeContribution {
  /** Record `type` this plugin writes into the shared data layer, e.g. "task". */
  type: string;
  title: string;
  /** JSON Schema for the record's module-specific `props`. */
  schema?: Record<string, unknown>;
}

export interface PluginContributions {
  commands?: CommandContribution[];
  panels?: PanelContribution[];
  recordTypes?: RecordTypeContribution[];
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description?: string;
  author?: string;
  /** Capability grants requested at install, e.g. "records:read:task", "network:graphql.anilist.co". */
  permissions: string[];
  activationEvents?: string[];
  contributes?: PluginContributions;
}

export type ManifestValidation =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; errors: string[] };

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export function validateManifest(value: unknown): ManifestValidation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, errors: ['manifest must be a JSON object'] };
  }
  const manifest = value as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof manifest.id !== 'string' || !ID_PATTERN.test(manifest.id)) {
    errors.push('id: required; lowercase letters, digits and dashes, optionally dot-separated (e.g. "nib.notepad")');
  }
  if (typeof manifest.name !== 'string' || manifest.name.trim() === '') {
    errors.push('name: required, non-empty string');
  }
  for (const field of ['version', 'minAppVersion'] as const) {
    const candidate = manifest[field];
    if (typeof candidate !== 'string' || !SEMVER_PATTERN.test(candidate)) {
      errors.push(`${field}: required, semver string (e.g. "1.0.0")`);
    }
  }
  if (
    !Array.isArray(manifest.permissions) ||
    manifest.permissions.some((p) => typeof p !== 'string' || p.trim() === '')
  ) {
    errors.push('permissions: required array of non-empty strings ([] for none)');
  }
  if (manifest.activationEvents !== undefined) {
    if (
      !Array.isArray(manifest.activationEvents) ||
      manifest.activationEvents.some((e) => typeof e !== 'string' || e.trim() === '')
    ) {
      errors.push('activationEvents: must be an array of non-empty strings');
    }
  }

  validateContributions(manifest.contributes, errors);

  return errors.length === 0
    ? { ok: true, manifest: value as PluginManifest }
    : { ok: false, errors };
}

function validateContributions(contributes: unknown, errors: string[]): void {
  if (contributes === undefined) return;
  if (typeof contributes !== 'object' || contributes === null || Array.isArray(contributes)) {
    errors.push('contributes: must be an object');
    return;
  }
  const { commands } = contributes as Record<string, unknown>;
  if (commands === undefined) return;
  if (!Array.isArray(commands)) {
    errors.push('contributes.commands: must be an array');
    return;
  }
  const seen = new Set<string>();
  commands.forEach((command, index) => {
    if (typeof command !== 'object' || command === null || Array.isArray(command)) {
      errors.push(`contributes.commands[${index}]: must be an object`);
      return;
    }
    const { id, title } = command as Record<string, unknown>;
    if (typeof id !== 'string' || id.trim() === '') {
      errors.push(`contributes.commands[${index}].id: required, non-empty string`);
    } else if (seen.has(id)) {
      errors.push(`contributes.commands[${index}].id: duplicate "${id}"`);
    } else {
      seen.add(id);
    }
    if (typeof title !== 'string' || title.trim() === '') {
      errors.push(`contributes.commands[${index}].title: required, non-empty string`);
    }
  });
}
