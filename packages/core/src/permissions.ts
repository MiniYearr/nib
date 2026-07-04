import type { Logger } from '@nib/plugin-api';
import { matchesPattern } from './events';

export type PermissionMode = 'log-only' | 'enforce';

export interface PermissionViolation {
  pluginId: string;
  capability: string;
  ts: number;
}

export interface PermissionEngine {
  mode: PermissionMode;
  grant(pluginId: string, permissions: string[]): void;
  /**
   * True when the plugin may use the capability. In log-only mode missing
   * grants are recorded and logged but still allowed — Phase 6 flips to enforce.
   */
  check(pluginId: string, capability: string): boolean;
  violations(): readonly PermissionViolation[];
}

/**
 * Grants and capabilities are colon-separated scopes, e.g. "records:read:note".
 * A grant segment of "*" covers everything from that point on; the last segment
 * also understands event-style dot wildcards ("events:subscribe:record.*").
 */
export function permissionMatches(grant: string, capability: string): boolean {
  const grantSegments = grant.split(':');
  const capabilitySegments = capability.split(':');
  for (let i = 0; i < grantSegments.length; i += 1) {
    const g = grantSegments[i]!;
    const c = capabilitySegments[i];
    if (g === '*') return true;
    if (c === undefined) return false;
    if (g !== c && !matchesPattern(g, c)) return false;
  }
  return grantSegments.length === capabilitySegments.length;
}

export function createPermissionEngine(options: {
  mode: PermissionMode;
  log?: Logger;
}): PermissionEngine {
  const grants = new Map<string, string[]>();
  const recorded: PermissionViolation[] = [];
  const log = options.log ?? console;

  return {
    mode: options.mode,

    grant(pluginId, permissions) {
      grants.set(pluginId, [...(grants.get(pluginId) ?? []), ...permissions]);
    },

    check(pluginId, capability) {
      const held = grants.get(pluginId) ?? [];
      if (held.some((grant) => permissionMatches(grant, capability))) return true;
      recorded.push({ pluginId, capability, ts: Date.now() });
      log.warn(
        `[nib:permissions] "${pluginId}" used "${capability}" without a grant` +
          (options.mode === 'log-only' ? ' (allowed: log-only mode)' : ' (denied)'),
      );
      return options.mode === 'log-only';
    },

    violations() {
      return recorded;
    },
  };
}
