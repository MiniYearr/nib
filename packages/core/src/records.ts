import type { DatabaseSync } from 'node:sqlite';
import type {
  ListRecordsOptions,
  NewRecordInput,
  NibRecord,
  RecordPatch,
  RecordVersion,
  SearchHit,
  SearchOptions,
  TagCount,
  VersionMeta,
} from '@nib/plugin-api';
import { inTransaction } from './db';
import type { EventBus } from './events';
import type { HlcClock } from './hlc';
import { newRecordId } from './ids';

const TAG_SEPARATOR = String.fromCharCode(31);
const DEFAULT_VERSION_COALESCE_MS = 5 * 60_000;

export interface OplogEntry {
  seq: number;
  hlc: string;
  deviceId: string;
  recordId: string;
  op: 'create' | 'update' | 'delete';
  patch: Record<string, unknown>;
  createdAt: number;
}

export interface ListOplogOptions {
  sinceSeq?: number;
  limit?: number;
}

export interface UpdateOptions {
  /** Always snapshot the pre-update state, ignoring the coalescing window. */
  forceVersion?: boolean;
}

export interface DataLayer {
  create(moduleId: string, input: NewRecordInput): NibRecord;
  get(id: string, options?: { includeDeleted?: boolean }): NibRecord | undefined;
  update(moduleId: string, id: string, patch: RecordPatch, options?: UpdateOptions): NibRecord;
  softDelete(moduleId: string, id: string): void;
  list(options?: ListRecordsOptions): NibRecord[];
  search(query: string, options?: SearchOptions): SearchHit[];
  listTags(): TagCount[];
  listVersions(recordId: string): VersionMeta[];
  getVersion(versionId: number): RecordVersion | undefined;
  restoreVersion(moduleId: string, recordId: string, versionId: number): NibRecord;
  listOplog(options?: ListOplogOptions): OplogEntry[];
}

export interface DataLayerDeps {
  db: DatabaseSync;
  bus: EventBus;
  clock: HlcClock;
  deviceId: string;
  versionCoalesceMs?: number;
  now?: () => number;
}

interface RecordRow {
  id: string;
  type: string;
  module_id: string;
  title: string;
  body_md: string;
  props: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  tag_names: string | null;
}

/** Turns free text into an FTS5 MATCH expression: quoted prefix terms, AND-ed. */
export function toMatchQuery(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replaceAll('"', '""')}"*`)
    .join(' ');
}

const SELECT_RECORD = `
  SELECT r.*, (
    SELECT group_concat(t.name, char(31))
    FROM record_tags rt JOIN tags t ON t.id = rt.tag_id
    WHERE rt.record_id = r.id
  ) AS tag_names
  FROM records r
`;

export function createDataLayer(deps: DataLayerDeps): DataLayer {
  const { db, bus, clock, deviceId } = deps;
  const versionCoalesceMs = deps.versionCoalesceMs ?? DEFAULT_VERSION_COALESCE_MS;
  const now = deps.now ?? Date.now;

  function rowToRecord(row: RecordRow): NibRecord {
    return {
      id: row.id,
      type: row.type,
      moduleId: row.module_id,
      title: row.title,
      bodyMd: row.body_md,
      props: JSON.parse(row.props) as Record<string, unknown>,
      tags: row.tag_names ? row.tag_names.split(TAG_SEPARATOR).sort() : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  function getRow(id: string): RecordRow | undefined {
    return db.prepare(`${SELECT_RECORD} WHERE r.id = ?`).get(id) as RecordRow | undefined;
  }

  function setTags(recordId: string, tags: string[]): void {
    db.prepare('DELETE FROM record_tags WHERE record_id = ?').run(recordId);
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const linkTag = db.prepare(
      'INSERT INTO record_tags (record_id, tag_id) SELECT ?, id FROM tags WHERE name = ?',
    );
    for (const tag of new Set(tags.map((t) => t.trim()).filter(Boolean))) {
      insertTag.run(tag);
      linkTag.run(recordId, tag);
    }
  }

  function refreshFts(record: NibRecord): void {
    db.prepare('DELETE FROM records_fts WHERE record_id = ?').run(record.id);
    if (record.deletedAt !== null) return;
    db.prepare('INSERT INTO records_fts (record_id, title, body, tags) VALUES (?, ?, ?, ?)').run(
      record.id,
      record.title,
      record.bodyMd,
      record.tags.join(' '),
    );
  }

  function appendOplog(
    op: OplogEntry['op'],
    recordId: string,
    patch: Record<string, unknown>,
  ): void {
    db.prepare(
      'INSERT INTO oplog (hlc, device_id, record_id, op, patch, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(clock.next(), deviceId, recordId, op, JSON.stringify(patch), now());
  }

  function snapshotVersion(row: RecordRow, timestamp: number): void {
    db.prepare(
      'INSERT INTO versions (record_id, title, body_md, props, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(row.id, row.title, row.body_md, row.props, timestamp);
  }

  function requireLiveRow(id: string): RecordRow {
    const row = getRow(id);
    if (!row) throw new Error(`record not found: ${id}`);
    if (row.deleted_at !== null) throw new Error(`record is deleted: ${id}`);
    return row;
  }

  function applyUpdate(
    moduleId: string,
    id: string,
    patch: RecordPatch,
    options?: UpdateOptions,
  ): { record: NibRecord; changed: string[] } {
    const existing = requireLiveRow(id);
    const timestamp = now();
    const changed: string[] = [];
    const oplogPatch: Record<string, unknown> = {};

    const contentChanging =
      (patch.title !== undefined && patch.title !== existing.title) ||
      (patch.bodyMd !== undefined && patch.bodyMd !== existing.body_md) ||
      (patch.props !== undefined && JSON.stringify(patch.props) !== existing.props);

    if (contentChanging) {
      const latest = db
        .prepare(
          'SELECT created_at FROM versions WHERE record_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
        )
        .get(id) as { created_at: number } | undefined;
      if (options?.forceVersion || !latest || timestamp - latest.created_at >= versionCoalesceMs) {
        snapshotVersion(existing, timestamp);
      }
    }

    if (patch.title !== undefined && patch.title !== existing.title) {
      changed.push('title');
      oplogPatch.title = patch.title;
    }
    if (patch.bodyMd !== undefined && patch.bodyMd !== existing.body_md) {
      changed.push('bodyMd');
      oplogPatch.bodyMd = patch.bodyMd;
    }
    if (patch.props !== undefined && JSON.stringify(patch.props) !== existing.props) {
      changed.push('props');
      oplogPatch.props = patch.props;
    }
    if (patch.tags !== undefined) {
      changed.push('tags');
      oplogPatch.tags = patch.tags;
      setTags(id, patch.tags);
    }

    db.prepare('UPDATE records SET title = ?, body_md = ?, props = ?, updated_at = ? WHERE id = ?').run(
      patch.title ?? existing.title,
      patch.bodyMd ?? existing.body_md,
      patch.props !== undefined ? JSON.stringify(patch.props) : existing.props,
      timestamp,
      id,
    );

    const record = rowToRecord(getRow(id)!);
    refreshFts(record);
    if (changed.length > 0) appendOplog('update', id, oplogPatch);
    return { record, changed };
  }

  function getVersionImpl(versionId: number): RecordVersion | undefined {
    const row = db.prepare('SELECT * FROM versions WHERE id = ?').get(versionId) as
      | {
          id: number;
          record_id: string;
          title: string;
          body_md: string;
          props: string;
          created_at: number;
        }
      | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      recordId: row.record_id,
      title: row.title,
      bodyMd: row.body_md,
      props: JSON.parse(row.props) as Record<string, unknown>,
      createdAt: row.created_at,
    };
  }

  function updateImpl(
    moduleId: string,
    id: string,
    patch: RecordPatch,
    options?: UpdateOptions,
  ): NibRecord {
    const { record, changed } = inTransaction(db, () => applyUpdate(moduleId, id, patch, options));
    if (changed.length > 0) bus.emit('record.updated', { record, changed }, moduleId);
    return record;
  }

  return {
    create(moduleId, input) {
      const record = inTransaction(db, () => {
        const id = newRecordId();
        const timestamp = now();
        db.prepare(
          'INSERT INTO records (id, type, module_id, title, body_md, props, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          id,
          input.type,
          moduleId,
          input.title ?? '',
          input.bodyMd ?? '',
          JSON.stringify(input.props ?? {}),
          timestamp,
          timestamp,
        );
        setTags(id, input.tags ?? []);
        const created = rowToRecord(getRow(id)!);
        refreshFts(created);
        appendOplog('create', id, {
          type: created.type,
          title: created.title,
          bodyMd: created.bodyMd,
          props: created.props,
          tags: created.tags,
        });
        return created;
      });
      bus.emit('record.created', { record }, moduleId);
      return record;
    },

    get(id, options) {
      const row = getRow(id);
      if (!row) return undefined;
      if (row.deleted_at !== null && !options?.includeDeleted) return undefined;
      return rowToRecord(row);
    },

    update: updateImpl,

    softDelete(moduleId, id) {
      const record = inTransaction(db, () => {
        requireLiveRow(id);
        const timestamp = now();
        db.prepare('UPDATE records SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
          timestamp,
          timestamp,
          id,
        );
        const deleted = rowToRecord(getRow(id)!);
        refreshFts(deleted);
        appendOplog('delete', id, {});
        return deleted;
      });
      bus.emit('record.deleted', { id, record }, moduleId);
    },

    list(options = {}) {
      const clauses: string[] = [];
      const params: (string | number)[] = [];
      if (!options.includeDeleted) clauses.push('r.deleted_at IS NULL');
      if (options.type) {
        clauses.push('r.type = ?');
        params.push(options.type);
      }
      if (options.tag) {
        clauses.push(
          'r.id IN (SELECT rt.record_id FROM record_tags rt JOIN tags t ON t.id = rt.tag_id WHERE t.name = ?)',
        );
        params.push(options.tag);
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = db
        .prepare(
          `${SELECT_RECORD} ${where} ORDER BY r.updated_at DESC, r.id DESC LIMIT ? OFFSET ?`,
        )
        .all(...params, options.limit ?? 100, options.offset ?? 0) as unknown as RecordRow[];
      return rows.map(rowToRecord);
    },

    search(query, options = {}) {
      const match = toMatchQuery(query);
      if (!match) return [];
      const params: (string | number)[] = [match];
      let typeFilter = '';
      if (options.types && options.types.length > 0) {
        typeFilter = `AND r.type IN (${options.types.map(() => '?').join(', ')})`;
        params.push(...options.types);
      }
      params.push(options.limit ?? 50);
      const rows = db
        .prepare(
          `
          SELECT f.record_id AS hit_id,
                 snippet(records_fts, -1, '⟪', '⟫', '…', 12) AS snip,
                 rank
          FROM records_fts f
          JOIN records r ON r.id = f.record_id
          WHERE records_fts MATCH ? AND r.deleted_at IS NULL ${typeFilter}
          ORDER BY rank
          LIMIT ?
          `,
        )
        .all(...params) as unknown as { hit_id: string; snip: string; rank: number }[];
      return rows.map((row) => ({
        record: rowToRecord(getRow(row.hit_id)!),
        snippet: row.snip,
        rank: row.rank,
      }));
    },

    listTags() {
      return db
        .prepare(
          `
          SELECT t.name AS name, count(rt.record_id) AS count
          FROM tags t
          JOIN record_tags rt ON rt.tag_id = t.id
          JOIN records r ON r.id = rt.record_id AND r.deleted_at IS NULL
          GROUP BY t.id HAVING count > 0 ORDER BY count DESC, name
          `,
        )
        .all() as unknown as TagCount[];
    },

    listVersions(recordId) {
      const rows = db
        .prepare(
          'SELECT id, record_id, created_at FROM versions WHERE record_id = ? ORDER BY created_at DESC, id DESC',
        )
        .all(recordId) as unknown as { id: number; record_id: string; created_at: number }[];
      return rows.map((row) => ({ id: row.id, recordId: row.record_id, createdAt: row.created_at }));
    },

    getVersion: getVersionImpl,

    restoreVersion(moduleId, recordId, versionId) {
      const version = getVersionImpl(versionId);
      if (!version || version.recordId !== recordId) {
        throw new Error(`version ${versionId} does not belong to record ${recordId}`);
      }
      return updateImpl(
        moduleId,
        recordId,
        { title: version.title, bodyMd: version.bodyMd, props: version.props },
        { forceVersion: true },
      );
    },

    listOplog(options = {}) {
      const rows = db
        .prepare('SELECT * FROM oplog WHERE seq > ? ORDER BY seq LIMIT ?')
        .all(options.sinceSeq ?? 0, options.limit ?? 1000) as unknown as {
        seq: number;
        hlc: string;
        device_id: string;
        record_id: string;
        op: 'create' | 'update' | 'delete';
        patch: string;
        created_at: number;
      }[];
      return rows.map((row) => ({
        seq: row.seq,
        hlc: row.hlc,
        deviceId: row.device_id,
        recordId: row.record_id,
        op: row.op,
        patch: JSON.parse(row.patch) as Record<string, unknown>,
        createdAt: row.created_at,
      }));
    },
  };
}
