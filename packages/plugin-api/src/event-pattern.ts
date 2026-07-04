/**
 * Event pattern matching shared by the core bus, the permission engine, and
 * the renderer bridge: `*` matches everything; `record.*` matches
 * `record.created` and any deeper segments; anything else is an exact match.
 */
export function matchesPattern(pattern: string, type: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) return type.startsWith(pattern.slice(0, -1));
  return pattern === type;
}
