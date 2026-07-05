import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  deriveKey,
  fromBase64,
  generateKdfParams,
  initCrypto,
  makeKeyCheck,
  openJson,
  seal,
  open as openSealed,
  sealJson,
  toBase64,
  verifyKeyCheck,
  zeroKey,
  type KdfParams,
} from './crypto';
import type { DiaryEntryDto, DiaryStatus } from './shared';

interface EntryLock {
  kdf: KdfParams;
  check: string;
  sealedBodyB64: string;
}

interface EntryPayload {
  date: string;
  title: string;
  bodyMd: string;
  mood?: string;
  createdAt: number;
  updatedAt: number;
  entryLock?: EntryLock;
}

export interface DiarySearchHit {
  id: string;
  date: string;
  title: string;
  snippet: string;
  rank: number;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, blob BLOB NOT NULL);
`;

function toMatchQuery(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replaceAll('"', '""')}"*`)
    .join(' ');
}

/**
 * Every row is an AEAD-sealed blob; nothing readable exists on disk, and the
 * full-text index lives purely in memory while unlocked — locking drops it.
 */
export class DiaryStore {
  private db: DatabaseSync;
  private key: Uint8Array | null = null;
  private index: DatabaseSync | null = null;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA);
  }

  private metaGet(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  private metaSet(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  }

  isSetup(): boolean {
    return this.metaGet('kdf') !== undefined;
  }

  isUnlocked(): boolean {
    return this.key !== null;
  }

  status(): DiaryStatus {
    if (!this.isSetup()) return 'uninitialized';
    return this.isUnlocked() ? 'unlocked' : 'locked';
  }

  async setup(password: string): Promise<void> {
    if (this.isSetup()) throw new Error('diary is already set up');
    if (password.length < 4) throw new Error('passphrase too short');
    await initCrypto();
    const kdf = generateKdfParams();
    const key = deriveKey(password, kdf);
    this.metaSet('kdf', JSON.stringify(kdf));
    this.metaSet('check', makeKeyCheck(key));
    this.key = key;
    this.rebuildIndex();
  }

  async unlock(password: string): Promise<boolean> {
    if (!this.isSetup()) throw new Error('diary is not set up');
    await initCrypto();
    const kdf = JSON.parse(this.metaGet('kdf')!) as KdfParams;
    const key = deriveKey(password, kdf);
    if (!verifyKeyCheck(key, this.metaGet('check')!)) {
      zeroKey(key);
      return false;
    }
    this.key = key;
    this.rebuildIndex();
    return true;
  }

  lock(): void {
    if (this.key) zeroKey(this.key);
    this.key = null;
    this.index?.close();
    this.index = null;
  }

  private requireKey(): Uint8Array {
    if (!this.key) throw new Error('diary is locked');
    return this.key;
  }

  private readPayload(id: string): EntryPayload {
    const row = this.db.prepare('SELECT blob FROM entries WHERE id = ?').get(id) as
      | { blob: Uint8Array }
      | undefined;
    if (!row) throw new Error(`entry not found: ${id}`);
    return openJson<EntryPayload>(this.requireKey(), row.blob);
  }

  private writePayload(id: string, payload: EntryPayload, isNew = false): void {
    const blob = sealJson(this.requireKey(), payload);
    if (isNew) this.db.prepare('INSERT INTO entries (id, blob) VALUES (?, ?)').run(id, blob);
    else this.db.prepare('UPDATE entries SET blob = ? WHERE id = ?').run(blob, id);
    this.indexEntry(id, payload);
  }

  private toDto(id: string, payload: EntryPayload): DiaryEntryDto {
    return {
      id,
      date: payload.date,
      title: payload.title,
      bodyMd: payload.entryLock ? '' : payload.bodyMd,
      mood: payload.mood,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
      locked: Boolean(payload.entryLock),
    };
  }

  createEntry(input: { date: string; title?: string; bodyMd?: string; mood?: string }): DiaryEntryDto {
    const id = randomUUID();
    const now = Date.now();
    const payload: EntryPayload = {
      date: input.date,
      title: input.title ?? '',
      bodyMd: input.bodyMd ?? '',
      mood: input.mood,
      createdAt: now,
      updatedAt: now,
    };
    this.writePayload(id, payload, true);
    return this.toDto(id, payload);
  }

  updateEntry(
    id: string,
    patch: { date?: string; title?: string; bodyMd?: string; mood?: string | null },
  ): DiaryEntryDto {
    const payload = this.readPayload(id);
    if (patch.bodyMd !== undefined && payload.entryLock) {
      throw new Error('entry body is locked — remove the entry lock first');
    }
    if (patch.date !== undefined) payload.date = patch.date;
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.bodyMd !== undefined) payload.bodyMd = patch.bodyMd;
    if (patch.mood !== undefined) payload.mood = patch.mood ?? undefined;
    payload.updatedAt = Date.now();
    this.writePayload(id, payload);
    return this.toDto(id, payload);
  }

  deleteEntry(id: string): void {
    this.requireKey();
    this.db.prepare('DELETE FROM entries WHERE id = ?').run(id);
    this.index?.prepare('DELETE FROM diary_fts WHERE entry_id = ?').run(id);
  }

  listEntries(): DiaryEntryDto[] {
    const key = this.requireKey();
    const rows = this.db.prepare('SELECT id, blob FROM entries').all() as unknown as {
      id: string;
      blob: Uint8Array;
    }[];
    return rows
      .map((row) => this.toDto(row.id, openJson<EntryPayload>(key, row.blob)))
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  }

  getEntry(id: string): DiaryEntryDto {
    return this.toDto(id, this.readPayload(id));
  }

  onThisDay(today: string): DiaryEntryDto[] {
    const monthDay = today.slice(5);
    const year = today.slice(0, 4);
    return this.listEntries().filter(
      (entry) => entry.date.slice(5) === monthDay && entry.date.slice(0, 4) < year,
    );
  }

  async setEntryLock(id: string, password: string): Promise<DiaryEntryDto> {
    if (password.length < 4) throw new Error('passphrase too short');
    const payload = this.readPayload(id);
    if (payload.entryLock) throw new Error('entry is already locked');
    await initCrypto();
    const kdf = generateKdfParams();
    const entryKey = deriveKey(password, kdf);
    payload.entryLock = {
      kdf,
      check: makeKeyCheck(entryKey),
      sealedBodyB64: toBase64(seal(entryKey, payload.bodyMd)),
    };
    zeroKey(entryKey);
    payload.bodyMd = '';
    payload.updatedAt = Date.now();
    this.writePayload(id, payload);
    return this.toDto(id, payload);
  }

  async unlockEntryBody(id: string, password: string): Promise<string> {
    const payload = this.readPayload(id);
    if (!payload.entryLock) throw new Error('entry is not locked');
    await initCrypto();
    const entryKey = deriveKey(password, payload.entryLock.kdf);
    if (!verifyKeyCheck(entryKey, payload.entryLock.check)) {
      zeroKey(entryKey);
      throw new Error('wrong entry passphrase');
    }
    const body = new TextDecoder().decode(
      openSealed(entryKey, fromBase64(payload.entryLock.sealedBodyB64)),
    );
    zeroKey(entryKey);
    return body;
  }

  async removeEntryLock(id: string, password: string): Promise<DiaryEntryDto> {
    const body = await this.unlockEntryBody(id, password);
    const payload = this.readPayload(id);
    payload.bodyMd = body;
    payload.entryLock = undefined;
    payload.updatedAt = Date.now();
    this.writePayload(id, payload);
    return this.toDto(id, payload);
  }

  search(query: string): DiarySearchHit[] {
    if (!this.isUnlocked() || !this.index) return [];
    const match = toMatchQuery(query);
    if (!match) return [];
    const rows = this.index
      .prepare(
        `SELECT entry_id, date, title, snippet(diary_fts, -1, '⟪', '⟫', '…', 12) AS snip, rank
         FROM diary_fts WHERE diary_fts MATCH ? ORDER BY rank LIMIT 50`,
      )
      .all(match) as unknown as {
      entry_id: string;
      date: string;
      title: string;
      snip: string;
      rank: number;
    }[];
    return rows.map((row) => ({
      id: row.entry_id,
      date: row.date,
      title: row.title,
      snippet: row.snip,
      rank: row.rank,
    }));
  }

  private rebuildIndex(): void {
    this.index?.close();
    this.index = new DatabaseSync(':memory:');
    this.index.exec(
      'CREATE VIRTUAL TABLE diary_fts USING fts5(entry_id UNINDEXED, date UNINDEXED, title, body)',
    );
    const key = this.requireKey();
    const rows = this.db.prepare('SELECT id, blob FROM entries').all() as unknown as {
      id: string;
      blob: Uint8Array;
    }[];
    for (const row of rows) {
      this.indexEntry(row.id, openJson<EntryPayload>(key, row.blob));
    }
  }

  private indexEntry(id: string, payload: EntryPayload): void {
    if (!this.index) return;
    this.index.prepare('DELETE FROM diary_fts WHERE entry_id = ?').run(id);
    if (payload.entryLock) return;
    this.index
      .prepare('INSERT INTO diary_fts (entry_id, date, title, body) VALUES (?, ?, ?, ?)')
      .run(id, payload.date, payload.title, payload.bodyMd);
  }

  close(): void {
    this.lock();
    this.db.close();
  }
}
