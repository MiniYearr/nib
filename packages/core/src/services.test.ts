import { describe, expect, it, vi } from 'vitest';
import { createCore } from './core';
import { createServiceRegistry } from './services';

describe('service registry', () => {
  it('registers, calls, and unregisters', async () => {
    const registry = createServiceRegistry();
    const off = registry.register('a.echo', (payload) => ({ echoed: payload }));
    expect(await registry.call('a.echo', 42)).toEqual({ echoed: 42 });
    expect(registry.list()).toEqual(['a.echo']);
    off();
    await expect(registry.call('a.echo', 1)).rejects.toThrow(/unknown service/);
  });

  it('rejects duplicate registrations', () => {
    const registry = createServiceRegistry();
    registry.register('a.x', () => 1);
    expect(() => registry.register('a.x', () => 2)).toThrow(/already registered/);
  });

  it('awaits async handlers', async () => {
    const registry = createServiceRegistry();
    registry.register('a.slow', async () => 'done');
    expect(await registry.call('a.slow', undefined)).toBe('done');
  });
});

describe('plugin services + search providers', () => {
  const manifest = {
    id: 'nib.provider',
    name: 'Provider',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    permissions: ['records:write:note'],
  };

  it('namespaces plugin services and allows cross-plugin calls', async () => {
    const core = createCore({ dbPath: ':memory:' });
    await core.loadPlugins([
      {
        manifest,
        activate(ctx) {
          ctx.services.register('lookup', (payload) => ({ found: payload }));
        },
      },
    ]);
    expect(core.services.list()).toEqual(['nib.provider.lookup']);
    expect(await core.services.call('nib.provider.lookup', 'q')).toEqual({ found: 'q' });
  });

  it('merges search provider hits into core.search with type filtering', async () => {
    const core = createCore({ dbPath: ':memory:' });
    await core.loadPlugins([
      {
        manifest,
        activate(ctx) {
          ctx.records.create({ type: 'note', title: 'phoenix note' });
          ctx.searchProviders.register((query) =>
            query.includes('phoenix')
              ? [
                  {
                    record: {
                      id: 'diary-1',
                      type: 'diary-entry',
                      moduleId: 'nib.provider',
                      title: 'phoenix dream',
                      bodyMd: '',
                      props: {},
                      tags: [],
                      createdAt: 0,
                      updatedAt: 0,
                      deletedAt: null,
                    },
                    snippet: 'a ⟪phoenix⟫ dream',
                    rank: 0,
                  },
                ]
              : [],
          );
        },
      },
    ]);

    const all = core.search('phoenix');
    expect(all.map((hit) => hit.record.type).sort()).toEqual(['diary-entry', 'note']);

    const notesOnly = core.search('phoenix', { types: ['note'] });
    expect(notesOnly).toHaveLength(1);

    const none = core.search('unrelated');
    expect(none).toHaveLength(0);
  });

  it('search survives a throwing provider', async () => {
    const core = createCore({ dbPath: ':memory:' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await core.loadPlugins([
      {
        manifest,
        activate(ctx) {
          ctx.records.create({ type: 'note', title: 'stable phoenix' });
          ctx.searchProviders.register(() => {
            throw new Error('provider boom');
          });
        },
      },
    ]);
    expect(core.search('phoenix')).toHaveLength(1);
    errorSpy.mockRestore();
  });
});
