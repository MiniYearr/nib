import { describe, expect, it, vi } from 'vitest';
import { createPermissionEngine, permissionMatches } from './permissions';

const quietLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('permissionMatches', () => {
  it.each([
    ['records:read:note', 'records:read:note', true],
    ['records:read:*', 'records:read:note', true],
    ['records:*', 'records:write:task', true],
    ['*', 'anything:at:all', true],
    ['records:read:note', 'records:write:note', false],
    ['records:read:note', 'records:read:task', false],
    ['records:read', 'records:read:note', false],
    ['events:subscribe:record.*', 'events:subscribe:record.created', true],
    ['events:subscribe:record.*', 'events:subscribe:task.completed', false],
    ['scheduler', 'scheduler', true],
  ])('grant %s vs capability %s -> %s', (grant, capability, expected) => {
    expect(permissionMatches(grant, capability)).toBe(expected);
  });
});

describe('createPermissionEngine', () => {
  it('allows granted capabilities without recording violations', () => {
    const engine = createPermissionEngine({ mode: 'enforce', log: quietLog });
    engine.grant('p', ['records:read:*']);
    expect(engine.check('p', 'records:read:note')).toBe(true);
    expect(engine.violations()).toHaveLength(0);
  });

  it('log-only mode allows missing grants but records them', () => {
    const engine = createPermissionEngine({ mode: 'log-only', log: quietLog });
    expect(engine.check('p', 'diary:read')).toBe(true);
    expect(engine.violations()).toEqual([
      expect.objectContaining({ pluginId: 'p', capability: 'diary:read' }),
    ]);
  });

  it('enforce mode denies missing grants', () => {
    const engine = createPermissionEngine({ mode: 'enforce', log: quietLog });
    engine.grant('p', ['records:read:note']);
    expect(engine.check('p', 'records:write:note')).toBe(false);
    expect(engine.violations()).toHaveLength(1);
  });
});
