import { DatabaseSync } from 'node:sqlite';
import { newDeviceId } from './ids';

const MIGRATIONS: string[] = [
  // v1 — the core spine: envelope records, tags, unified FTS, versions, oplog, jobs.
  `
  CREATE TABLE records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    module_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    body_md TEXT NOT NULL DEFAULT '',
    props TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX idx_records_type_updated ON records(type, updated_at DESC);

  CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE record_tags (
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (record_id, tag_id)
  );
  CREATE INDEX idx_record_tags_tag ON record_tags(tag_id);

  CREATE VIRTUAL TABLE records_fts USING fts5(record_id UNINDEXED, title, body, tags);

  CREATE TABLE versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body_md TEXT NOT NULL,
    props TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_versions_record ON versions(record_id, created_at DESC);

  CREATE TABLE oplog (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    hlc TEXT NOT NULL,
    device_id TEXT NOT NULL,
    record_id TEXT NOT NULL,
    op TEXT NOT NULL CHECK (op IN ('create', 'update', 'delete')),
    patch TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_oplog_hlc ON oplog(hlc);

  CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    module_id TEXT NOT NULL,
    run_at INTEGER NOT NULL,
    interval_ms INTEGER,
    payload TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_jobs_due ON jobs(run_at);

  CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true });
  db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  return db;
}

export function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let version = row.user_version; version < MIGRATIONS.length; version += 1) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(MIGRATIONS[version]!);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function getOrCreateDeviceId(db: DatabaseSync): string {
  const existing = db.prepare(`SELECT value FROM meta WHERE key = 'device_id'`).get() as
    | { value: string }
    | undefined;
  if (existing) return existing.value;
  const deviceId = newDeviceId();
  db.prepare(`INSERT INTO meta (key, value) VALUES ('device_id', ?)`).run(deviceId);
  return deviceId;
}

export function inTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
