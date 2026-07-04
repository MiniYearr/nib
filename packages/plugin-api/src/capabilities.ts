/**
 * Helpers for reasoning about permission scopes outside the permission engine:
 * network host matching for the per-plugin request filter, and human-readable
 * descriptions + a sensitivity flag for the install-time grant UI.
 */

// This module is consumed as source by packages with different tsconfig libs
// (node, DOM, or neither), so reach the URL constructor through globalThis
// rather than the ambient `URL` global to stay portable.
interface UrlLike {
  hostname: string;
}
const URLCtor = (globalThis as unknown as { URL: new (input: string) => UrlLike }).URL;

export function networkDomains(grants: string[]): string[] {
  return grants
    .filter((grant) => grant.startsWith('network:'))
    .map((grant) => grant.slice('network:'.length).trim())
    .filter(Boolean);
}

/** True when `url`'s host equals or is a subdomain of any granted network domain. */
export function hostAllowed(grants: string[], url: string): boolean {
  let host: string;
  try {
    host = new URLCtor(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return networkDomains(grants).some((domain) => {
    const d = domain.toLowerCase();
    return host === d || host.endsWith(`.${d}`);
  });
}

/**
 * A permission is "sensitive" when granting it exposes private data, broad
 * access, or the network — the grant UI leaves these unchecked by default so
 * a plugin can never silently read the diary or reach arbitrary hosts.
 */
export function isSensitivePermission(scope: string): boolean {
  if (scope === '*') return true;
  const [area, action, target] = scope.split(':');
  if (area === 'diary') return true;
  if (area === 'network') return true;
  if (area === 'records' && action === 'write') return true;
  if (area === 'records' && action === 'read' && (target === '*' || target === undefined)) {
    return true;
  }
  if (area === 'events' && (target === '*' || scope === 'events:subscribe:*')) return true;
  return false;
}

export function describePermission(scope: string): string {
  if (scope === '*') return 'Full access to everything (avoid granting this)';
  const [area, action, target] = scope.split(':');
  switch (area) {
    case 'records': {
      const noun = !target || target === '*' ? 'all record types' : `“${target}” records`;
      if (action === 'read') return `Read ${noun}`;
      if (action === 'write') return `Create, edit and delete ${noun}`;
      return `Access ${noun}`;
    }
    case 'events':
      return target && target !== '*'
        ? `Get notified about ${target} events`
        : 'Get notified about all app events';
    case 'network': {
      const domain = scope.slice('network:'.length).trim();
      return domain ? `Connect to ${domain}` : 'Connect to the network';
    }
    case 'diary':
      return 'Read your encrypted diary (deny unless you trust this fully)';
    case 'scheduler':
      return 'Schedule background jobs';
    case 'services':
      return target ? `Call the ${target} service` : 'Call other plugins’ services';
    default:
      return scope;
  }
}
