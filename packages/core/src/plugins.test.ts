import { describe, expect, it, vi } from 'vitest';
import type { NibPluginContext, PluginManifest } from '@nib/plugin-api';
import { createCore, type NibCore } from './core';

function manifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'nib.sample',
    name: 'Sample',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    permissions: ['records:read:note', 'records:write:note', 'scheduler'],
    ...overrides,
  };
}

async function activated(
  core: NibCore,
  manifestOverrides: Partial<PluginManifest> = {},
): Promise<NibPluginContext> {
  let captured: NibPluginContext | undefined;
  const result = await core.loadPlugins([
    {
      manifest: manifest(manifestOverrides),
      activate(ctx) {
        captured = ctx;
      },
    },
  ]);
  expect(result.errors).toHaveLength(0);
  return captured!;
}

describe('plugin loader', () => {
  it('rejects invalid manifests without activating', async () => {
    const core = createCore({ dbPath: ':memory:' });
    const activate = vi.fn();
    const result = await core.loadPlugins([
      { manifest: manifest({ id: 'BAD ID' }), activate },
    ]);
    expect(result.loaded).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(activate).not.toHaveBeenCalled();
  });

  it('keeps loading other plugins when one activation throws', async () => {
    const core = createCore({ dbPath: ':memory:' });
    const result = await core.loadPlugins([
      {
        manifest: manifest({ id: 'nib.broken' }),
        activate() {
          throw new Error('boom');
        },
      },
      { manifest: manifest({ id: 'nib.healthy' }), activate: vi.fn() },
    ]);
    expect(result.errors.map((e) => e.pluginId)).toEqual(['nib.broken']);
    expect(result.loaded.map((p) => p.manifest.id)).toEqual(['nib.healthy']);
  });

  it('stamps created records with the plugin id', async () => {
    const core = createCore({ dbPath: ':memory:' });
    const ctx = await activated(core);
    const record = ctx.records.create({ type: 'note', title: 'Mine' });
    expect(record.moduleId).toBe('nib.sample');
  });

  it('namespaces registered commands under the plugin id', async () => {
    const core = createCore({ dbPath: ':memory:' });
    const ctx = await activated(core);
    ctx.commands.register({ id: 'do-thing', title: 'Do thing', run: vi.fn() });
    expect(core.commands.list().map((c) => c.id)).toEqual(['nib.sample.do-thing']);
  });

  it('rejects plugin events outside the plugin namespace', async () => {
    const core = createCore({ dbPath: ':memory:' });
    const ctx = await activated(core);
    expect(() => ctx.events.emit('record.created', {})).toThrow(/namespaced/);
    const seen = vi.fn();
    core.bus.on('nib.sample.custom', seen);
    ctx.events.emit('nib.sample.custom', { ok: true });
    expect(seen).toHaveBeenCalledOnce();
  });

  it('records violations in log-only mode but still allows the call', async () => {
    const core = createCore({ dbPath: ':memory:' });
    const ctx = await activated(core, { permissions: [] });
    const record = ctx.records.create({ type: 'note', title: 'Allowed anyway' });
    expect(record.id).toBeTruthy();
    expect(core.permissions.violations()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pluginId: 'nib.sample', capability: 'records:write:note' }),
      ]),
    );
  });

  it('denies ungranted writes in enforce mode', async () => {
    const core = createCore({ dbPath: ':memory:', permissionMode: 'enforce' });
    const ctx = await activated(core, { permissions: ['records:read:note'] });
    expect(() => ctx.records.create({ type: 'note' })).toThrow(/permission denied/);
    expect(ctx.records.list({ type: 'note' })).toEqual([]);
  });

  it('filters search hits by readable type in enforce mode', async () => {
    const core = createCore({ dbPath: ':memory:', permissionMode: 'enforce' });
    const writer = await activated(core, {
      id: 'nib.writer',
      permissions: ['records:write:note', 'records:write:secret'],
    });
    writer.records.create({ type: 'note', title: 'shared topic' });
    writer.records.create({ type: 'secret', title: 'shared topic' });

    const reader = await activated(core, {
      id: 'nib.reader',
      permissions: ['records:read:note'],
    });
    const hits = reader.records.search('shared');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.record.type).toBe('note');
  });

  it('namespaces scheduler kinds per plugin', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      const core = createCore({ dbPath: ':memory:' });
      core.start();
      const ctx = await activated(core);
      const handler = vi.fn();
      ctx.scheduler.onJob('ping', handler);
      ctx.scheduler.schedule({ kind: 'ping', runAt: Date.now() + 50, payload: { hi: 1 } });
      vi.advanceTimersByTime(50);
      expect(handler).toHaveBeenCalledExactlyOnceWith({ hi: 1 });
      core.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('dispose unregisters commands and subscriptions', async () => {
    const core = createCore({ dbPath: ':memory:' });
    const seen = vi.fn();
    let ctx: NibPluginContext | undefined;
    const result = await core.loadPlugins([
      {
        manifest: manifest({ permissions: ['records:write:note', 'events:subscribe:record.*'] }),
        activate(c) {
          ctx = c;
          c.commands.register({ id: 'x', title: 'X', run: vi.fn() });
          c.events.on('record.*', seen);
        },
      },
    ]);
    await result.loaded[0]!.dispose();
    expect(core.commands.list()).toHaveLength(0);
    ctx!.records.create({ type: 'note' });
    expect(seen).not.toHaveBeenCalled();
  });
});
