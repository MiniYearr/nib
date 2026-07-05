import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DiaryStore } from './store';

let dir: string;
let store: DiaryStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nib-diary-test-'));
  store = new DiaryStore(join(dir, 'diary.db'));
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('diary store lifecycle', () => {
  it('walks uninitialized → unlocked → locked → unlocked with data intact', async () => {
    expect(store.status()).toBe('uninitialized');
    await store.setup('correct horse');
    expect(store.status()).toBe('unlocked');

    const entry = store.createEntry({
      date: '2026-07-04',
      title: 'First entry',
      bodyMd: 'The velvet aardvark sang.',
      mood: 'good',
    });

    store.lock();
    expect(store.status()).toBe('locked');
    expect(() => store.listEntries()).toThrow(/locked/);
    expect(store.search('aardvark')).toEqual([]);

    expect(await store.unlock('wrong password')).toBe(false);
    expect(store.status()).toBe('locked');

    expect(await store.unlock('correct horse')).toBe(true);
    const entries = store.listEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe(entry.id);
    expect(entries[0]!.bodyMd).toBe('The velvet aardvark sang.');
    expect(entries[0]!.mood).toBe('good');
  });

  it('never writes plaintext to disk — raw file contains no entry content', async () => {
    await store.setup('hunter22');
    store.createEntry({
      date: '2026-07-04',
      title: 'ObsidianTitleMarker',
      bodyMd: 'CrimsonBodyMarker went to the lake.',
    });

    const raw = readFileSync(join(dir, 'diary.db'));
    expect(raw.includes(Buffer.from('ObsidianTitleMarker'))).toBe(false);
    expect(raw.includes(Buffer.from('CrimsonBodyMarker'))).toBe(false);
  });

  it('updates entries and searches across title and body while unlocked', async () => {
    await store.setup('pw pw pw');
    const entry = store.createEntry({ date: '2026-07-01', title: 'Walk', bodyMd: 'saw a heron' });
    store.updateEntry(entry.id, { bodyMd: 'saw a heron and a kingfisher' });

    const hits = store.search('kingfisher');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.id).toBe(entry.id);
    expect(hits[0]!.snippet).toContain('⟪kingfisher⟫');

    store.deleteEntry(entry.id);
    expect(store.search('kingfisher')).toEqual([]);
  });

  it('surfaces on-this-day entries from earlier years only', async () => {
    await store.setup('pw pw pw');
    store.createEntry({ date: '2024-07-04', title: 'Two years ago' });
    store.createEntry({ date: '2025-07-04', title: 'Last year' });
    store.createEntry({ date: '2026-07-01', title: 'This week' });
    store.createEntry({ date: '2026-07-04', title: 'Today itself' });

    const hits = store.onThisDay('2026-07-04');
    expect(hits.map((entry) => entry.title).sort()).toEqual(['Last year', 'Two years ago']);
  });
});

describe('per-entry lock', () => {
  it('seals the body behind a second passphrase and drops it from search', async () => {
    await store.setup('outer wall');
    const entry = store.createEntry({
      date: '2026-07-02',
      title: 'Ultra private',
      bodyMd: 'EmeraldSecretMarker feelings',
    });
    expect(store.search('EmeraldSecretMarker')).toHaveLength(1);

    await store.setEntryLock(entry.id, 'inner sanctum');
    expect(store.getEntry(entry.id).locked).toBe(true);
    expect(store.getEntry(entry.id).bodyMd).toBe('');
    expect(store.search('EmeraldSecretMarker')).toEqual([]);
    expect(store.search('Ultra')).toEqual([]);

    await expect(store.unlockEntryBody(entry.id, 'wrong')).rejects.toThrow(/wrong entry/);
    expect(await store.unlockEntryBody(entry.id, 'inner sanctum')).toBe(
      'EmeraldSecretMarker feelings',
    );

    expect(() => store.updateEntry(entry.id, { bodyMd: 'overwrite attempt' })).toThrow(/locked/);
    store.updateEntry(entry.id, { mood: 'low' });

    const restored = await store.removeEntryLock(entry.id, 'inner sanctum');
    expect(restored.locked).toBe(false);
    expect(restored.bodyMd).toBe('EmeraldSecretMarker feelings');
    expect(store.search('EmeraldSecretMarker')).toHaveLength(1);
  });

  it('locked bodies survive a full lock/unlock cycle still sealed', async () => {
    await store.setup('outer wall');
    const entry = store.createEntry({ date: '2026-07-02', bodyMd: 'AmberDeepMarker' });
    await store.setEntryLock(entry.id, 'inner');

    store.lock();
    await store.unlock('outer wall');

    expect(store.getEntry(entry.id).bodyMd).toBe('');
    expect(store.search('AmberDeepMarker')).toEqual([]);
    expect(await store.unlockEntryBody(entry.id, 'inner')).toBe('AmberDeepMarker');
  });
});
