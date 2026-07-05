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
    /** Trusted-renderer emit; `type` must be namespaced under `moduleId.`. */
    emit(moduleId: string, type: string, payload: unknown): void;
  };
  services: {
    /** Call a plugin service by full id, e.g. "nib.media-anilist.lookup". */
    call(serviceId: string, payload?: unknown): Promise<unknown>;
  };
  /**
   * Escape hatch for module-specific IPC surfaces registered by trusted
   * plugins (e.g. "nib.diary:unlock"). Channels must match `nib.<module>:…`.
   */
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  /** Frameless-window controls for the custom title bar. */
  win: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    isMaximized(): Promise<boolean>;
    /** Returns an unsubscribe function. */
    onMaximizeChange(handler: (maximized: boolean) => void): () => void;
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
