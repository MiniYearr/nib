/** The shared envelope every module's records live in. */
export interface NibRecord {
  id: string;
  /** Record type registered by a module, e.g. "note", "task", "diary-entry". */
  type: string;
  /** Module that owns/created the record. */
  moduleId: string;
  title: string;
  bodyMd: string;
  /** Module-specific fields, validated against the module's declared JSON Schema. */
  props: Record<string, unknown>;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface NewRecordInput {
  type: string;
  title?: string;
  bodyMd?: string;
  props?: Record<string, unknown>;
  tags?: string[];
}

export interface RecordPatch {
  title?: string;
  bodyMd?: string;
  props?: Record<string, unknown>;
  tags?: string[];
}

export interface ListRecordsOptions {
  type?: string;
  tag?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchOptions {
  types?: string[];
  limit?: number;
}

export interface SearchHit {
  record: NibRecord;
  /** Best-matching excerpt with match markers. */
  snippet: string;
  /** FTS5 rank — lower is better. */
  rank: number;
}

export interface VersionMeta {
  id: number;
  recordId: string;
  createdAt: number;
}

export interface RecordVersion extends VersionMeta {
  title: string;
  bodyMd: string;
  props: Record<string, unknown>;
}

export interface TagCount {
  name: string;
  count: number;
}
