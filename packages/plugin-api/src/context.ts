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
} from './records';
import type { PluginManifest } from './manifest';

export interface NibEvent<T = unknown> {
  type: string;
  payload: T;
  source: string;
  ts: number;
}

export type NibEventHandler = (event: NibEvent) => void;

export interface RecordsApi {
  create(input: NewRecordInput): NibRecord;
  get(id: string): NibRecord | undefined;
  update(id: string, patch: RecordPatch): NibRecord;
  softDelete(id: string): void;
  list(options?: ListRecordsOptions): NibRecord[];
  search(query: string, options?: SearchOptions): SearchHit[];
  listTags(): TagCount[];
  listVersions(recordId: string): VersionMeta[];
  getVersion(versionId: number): RecordVersion | undefined;
  restoreVersion(recordId: string, versionId: number): NibRecord;
}

export interface EventsApi {
  /** Event types must be namespaced under the plugin id, e.g. "<pluginId>.something". */
  emit(type: string, payload: unknown): void;
  /** Returns an unsubscribe function. */
  on(pattern: string, handler: NibEventHandler): () => void;
}

export interface CommandRegistration {
  /** Unique within the plugin; exposed to the palette as "<pluginId>.<id>". */
  id: string;
  title: string;
  category?: string;
  run(): void | Promise<void>;
}

export interface CommandsApi {
  /** Returns an unregister function. */
  register(command: CommandRegistration): () => void;
}

export interface ScheduleInput {
  kind: string;
  runAt: number;
  /** When set, the job reschedules itself every `intervalMs` after firing. */
  intervalMs?: number;
  payload?: Record<string, unknown>;
  /** Replace any existing jobs of the same kind from this plugin instead of stacking. */
  unique?: boolean;
}

export interface SchedulerApi {
  schedule(input: ScheduleInput): string;
  cancel(jobId: string): void;
  /** Handle fired jobs of a kind this plugin scheduled. Returns an unregister function. */
  onJob(kind: string, handler: (payload: Record<string, unknown>) => void): () => void;
}

export interface ServicesApi {
  /** Registers under `<pluginId>.<id>`. Returns an unregister function. */
  register(id: string, handler: (payload: unknown) => Promise<unknown> | unknown): () => void;
  /** Call any plugin's service by its full id, e.g. "nib.media-anilist.lookup". */
  call(serviceId: string, payload: unknown): Promise<unknown>;
}

export interface SearchProvidersApi {
  /**
   * Contribute extra hits to global search — how stores outside the shared
   * data layer (like the encrypted diary) join in. Returns an unregister fn.
   */
  register(provider: (query: string) => SearchHit[]): () => void;
}

export interface Logger {
  info(message: string, ...detail: unknown[]): void;
  warn(message: string, ...detail: unknown[]): void;
  error(message: string, ...detail: unknown[]): void;
}

/** Everything a plugin gets at activation — its only doorway into Nib. */
export interface NibPluginContext {
  manifest: PluginManifest;
  records: RecordsApi;
  events: EventsApi;
  commands: CommandsApi;
  scheduler: SchedulerApi;
  services: ServicesApi;
  searchProviders: SearchProvidersApi;
  log: Logger;
}

/** The shape an in-repo (trusted) plugin package exports. */
export interface NibPluginModule {
  manifest: PluginManifest;
  activate(ctx: NibPluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
