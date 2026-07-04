import { describe, expect, it, vi } from 'vitest';
import { openDatabase } from './db';
import { createEventBus } from './events';
import { createHlcClock } from './hlc';
import { createDataLayer, toMatchQuery, type DataLayer } from './records';

interface Fixture {
  data: DataLayer;
  bus: ReturnType<typeof createEventBus>;
  tick(ms: number): void;
}

function fixture(overrides?: { versionCoalesceMs?: number }): Fixture {
  let clockMs = 1_000_000;
  const now = () => clockMs;
  const bus = createEventBus();
  const db = openDatabase(':memory:');
  const data = createDataLayer({
    db,
    bus,
    clock: createHlcClock('test-device', now),
    deviceId: 'test-device',
    versionCoalesceMs: overrides?.versionCoalesceMs ?? 5 * 60_000,
    now,
  });
  return { data, bus, tick: (ms) => (clockMs += ms) };
}

describe('toMatchQuery', () => {
  it('quotes tokens and adds prefix matching', () => {
    expect(toMatchQuery('hello world')).toBe('"hello"* "world"*');
  });
  it('escapes embedded quotes and survives FTS operators', () => {
    expect(toMatchQuery('say "hi" AND')).toBe('"say"* """hi"""* "AND"*');
  });
  it('returns empty string for blank input', () => {
    expect(toMatchQuery('   ')).toBe('');
  });
});

describe('data layer', () => {
  it('creates and reads back a record with props and tags', () => {
    const { data } = fixture();
    const created = data.create('nib.notepad', {
      type: 'note',
      title: 'Groceries',
      bodyMd: '- milk\n- eggs',
      props: { pinned: true },
      tags: ['errands', 'home'],
    });
    const fetched = data.get(created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.title).toBe('Groceries');
    expect(fetched!.props).toEqual({ pinned: true });
    expect(fetched!.tags).toEqual(['errands', 'home']);
    expect(fetched!.moduleId).toBe('nib.notepad');
  });

  it('emits record.created with the module as source', () => {
    const { data, bus } = fixture();
    const seen = vi.fn();
    bus.on('record.created', seen);
    data.create('nib.todo', { type: 'task', title: 'Ship it' });
    expect(seen).toHaveBeenCalledOnce();
    expect(seen.mock.calls[0]![0].source).toBe('nib.todo');
  });

  it('lists by type and tag, excluding deleted records', () => {
    const { data } = fixture();
    const a = data.create('m', { type: 'note', title: 'A', tags: ['keep'] });
    data.create('m', { type: 'note', title: 'B' });
    data.create('m', { type: 'task', title: 'C', tags: ['keep'] });
    data.softDelete('m', a.id);

    expect(data.list({ type: 'note' }).map((r) => r.title)).toEqual(['B']);
    expect(data.list({ tag: 'keep' }).map((r) => r.title)).toEqual(['C']);
    expect(data.list({ includeDeleted: true })).toHaveLength(3);
  });

  it('updates fields, reports changed set, and bumps updatedAt', () => {
    const { data, bus, tick } = fixture();
    const seen = vi.fn();
    bus.on('record.updated', seen);
    const rec = data.create('m', { type: 'note', title: 'Old', bodyMd: 'text' });
    tick(1000);
    const updated = data.update('m', rec.id, { title: 'New' });
    expect(updated.title).toBe('New');
    expect(updated.bodyMd).toBe('text');
    expect(updated.updatedAt).toBe(rec.updatedAt + 1000);
    expect(seen.mock.calls[0]![0].payload).toMatchObject({ changed: ['title'] });
  });

  it('does not emit or oplog a no-op update', () => {
    const { data, bus } = fixture();
    const seen = vi.fn();
    bus.on('record.updated', seen);
    const rec = data.create('m', { type: 'note', title: 'Same' });
    const before = data.listOplog().length;
    data.update('m', rec.id, { title: 'Same' });
    expect(seen).not.toHaveBeenCalled();
    expect(data.listOplog().length).toBe(before);
  });

  it('soft delete hides the record from get/list/search and blocks updates', () => {
    const { data } = fixture();
    const rec = data.create('m', { type: 'note', title: 'Secret plans' });
    data.softDelete('m', rec.id);
    expect(data.get(rec.id)).toBeUndefined();
    expect(data.get(rec.id, { includeDeleted: true })).toBeDefined();
    expect(data.search('secret')).toHaveLength(0);
    expect(() => data.update('m', rec.id, { title: 'x' })).toThrow(/deleted/);
  });

  it('searches across record types in one query with type filtering', () => {
    const { data } = fixture();
    data.create('nib.notepad', { type: 'note', title: 'Phoenix project notes' });
    data.create('nib.todo', { type: 'task', title: 'Email phoenix team' });
    data.create('nib.diary', { type: 'diary-entry', bodyMd: 'Dreamed about a phoenix.' });
    data.create('nib.notepad', { type: 'note', title: 'Unrelated' });

    const all = data.search('phoenix');
    expect(all).toHaveLength(3);
    expect(new Set(all.map((h) => h.record.type))).toEqual(
      new Set(['note', 'task', 'diary-entry']),
    );

    const tasksOnly = data.search('phoenix', { types: ['task'] });
    expect(tasksOnly).toHaveLength(1);
    expect(tasksOnly[0]!.record.title).toBe('Email phoenix team');
  });

  it('matches prefixes and marks snippets', () => {
    const { data } = fixture();
    data.create('m', { type: 'note', bodyMd: 'The phoenix rises from ashes' });
    const hits = data.search('phoen');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.snippet).toContain('⟪phoenix⟫');
  });

  it('finds records by tag text through search', () => {
    const { data } = fixture();
    data.create('m', { type: 'note', title: 'Untitled', tags: ['recipes'] });
    expect(data.search('recipes')).toHaveLength(1);
  });

  it('counts tags across live records only', () => {
    const { data } = fixture();
    const a = data.create('m', { type: 'note', tags: ['shared', 'solo'] });
    data.create('m', { type: 'task', tags: ['shared'] });
    data.softDelete('m', a.id);
    expect(data.listTags()).toEqual([{ name: 'shared', count: 1 }]);
  });

  it('coalesces version snapshots within the window and separates them beyond it', () => {
    const { data, tick } = fixture({ versionCoalesceMs: 60_000 });
    const rec = data.create('m', { type: 'note', bodyMd: 'v1' });

    tick(1000);
    data.update('m', rec.id, { bodyMd: 'v2' });
    expect(data.listVersions(rec.id)).toHaveLength(1);

    tick(1000);
    data.update('m', rec.id, { bodyMd: 'v3' });
    expect(data.listVersions(rec.id)).toHaveLength(1);

    tick(61_000);
    data.update('m', rec.id, { bodyMd: 'v4' });
    expect(data.listVersions(rec.id)).toHaveLength(2);
  });

  it('restores a version and preserves the pre-restore state', () => {
    const { data, tick } = fixture({ versionCoalesceMs: 0 });
    const rec = data.create('m', { type: 'note', title: 'First', bodyMd: 'original' });
    tick(1000);
    data.update('m', rec.id, { title: 'Second', bodyMd: 'edited' });
    const versions = data.listVersions(rec.id);
    expect(versions).toHaveLength(1);

    tick(1000);
    const restored = data.restoreVersion('m', rec.id, versions[0]!.id);
    expect(restored.title).toBe('First');
    expect(restored.bodyMd).toBe('original');

    const afterRestore = data.listVersions(rec.id);
    expect(afterRestore).toHaveLength(2);
    const preserved = data.getVersion(afterRestore[0]!.id);
    expect(preserved!.title).toBe('Second');
  });

  it('rejects restoring a version that belongs to another record', () => {
    const { data, tick } = fixture({ versionCoalesceMs: 0 });
    const a = data.create('m', { type: 'note', bodyMd: 'a1' });
    const b = data.create('m', { type: 'note', bodyMd: 'b1' });
    tick(1000);
    data.update('m', a.id, { bodyMd: 'a2' });
    const [versionOfA] = data.listVersions(a.id);
    expect(() => data.restoreVersion('m', b.id, versionOfA!.id)).toThrow(/does not belong/);
  });

  it('appends oplog entries with ascending HLCs and change-only patches', () => {
    const { data, tick } = fixture();
    const rec = data.create('m', { type: 'note', title: 'T', bodyMd: 'B', tags: ['x'] });
    tick(1000);
    data.update('m', rec.id, { title: 'T2' });
    data.softDelete('m', rec.id);

    const entries = data.listOplog();
    expect(entries.map((e) => e.op)).toEqual(['create', 'update', 'delete']);
    expect(entries[0]!.patch).toMatchObject({ title: 'T', bodyMd: 'B', tags: ['x'] });
    expect(entries[1]!.patch).toEqual({ title: 'T2' });
    expect(entries.every((e) => e.deviceId === 'test-device')).toBe(true);
    const hlcs = entries.map((e) => e.hlc);
    expect([...hlcs].sort()).toEqual(hlcs);
  });
});
