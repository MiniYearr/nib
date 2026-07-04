import type { NibEvent } from './context';
import type {
  ListRecordsOptions,
  NewRecordInput,
  NibRecord,
  RecordPatch,
  RecordVersion,
  SearchHit,
  TagCount,
  VersionMeta,
} from './records';

export interface CommandDescriptor {
  id: string;
  title: string;
  category?: string;
  moduleId: string;
}

/** The bridge surface the preload script exposes to renderer windows as `window.nib`. */
export interface NibWindowApi {
  commands: {
    list(): Promise<CommandDescriptor[]>;
    execute(id: string): Promise<void>;
  };
  search(query: string): Promise<SearchHit[]>;
  /**
   * Direct data access for the trusted main-window UI. Mutations carry the
   * module id they act on behalf of; sandboxed plugin bridges will pin it
   * host-side instead (Phase 6).
   */
  records: {
    list(options?: ListRecordsOptions): Promise<NibRecord[]>;
    get(id: string): Promise<NibRecord | undefined>;
    create(moduleId: string, input: NewRecordInput): Promise<NibRecord>;
    update(moduleId: string, id: string, patch: RecordPatch): Promise<NibRecord>;
    softDelete(moduleId: string, id: string): Promise<void>;
    listVersions(recordId: string): Promise<VersionMeta[]>;
    getVersion(versionId: number): Promise<RecordVersion | undefined>;
    restoreVersion(moduleId: string, recordId: string, versionId: number): Promise<NibRecord>;
    listTags(): Promise<TagCount[]>;
  };
  events: {
    on(pattern: string, handler: (event: NibEvent) => void): () => void;
  };
  runtime: {
    electron: string;
    chrome: string;
  };
}

declare global {
  interface Window {
    nib?: NibWindowApi;
  }
}
