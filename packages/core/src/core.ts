import type { NibPluginModule, SearchHit, SearchOptions } from '@nib/plugin-api';
import { createCommandRegistry, type CommandRegistry } from './commands';
import { getOrCreateDeviceId, openDatabase } from './db';
import { createEventBus, type EventBus } from './events';
import { createHlcClock } from './hlc';
import { createPermissionEngine, type PermissionEngine, type PermissionMode } from './permissions';
import { loadPlugins, type LoadResult } from './plugins';
import { createDataLayer, type DataLayer } from './records';
import { createScheduler, type Scheduler } from './scheduler';
import { createServiceRegistry, type ServiceRegistry } from './services';

export interface NibCoreOptions {
  /** SQLite file path, or ":memory:" for tests. */
  dbPath: string;
  permissionMode?: PermissionMode;
}

export interface NibCore {
  deviceId: string;
  bus: EventBus;
  data: DataLayer;
  commands: CommandRegistry;
  scheduler: Scheduler;
  permissions: PermissionEngine;
  services: ServiceRegistry;
  /** Data-layer FTS plus every registered search provider (e.g. the unlocked diary). */
  search(query: string, options?: SearchOptions): SearchHit[];
  registerSearchProvider(provider: (query: string) => SearchHit[]): () => void;
  loadPlugins(modules: NibPluginModule[]): Promise<LoadResult>;
  /** Starts background machinery (the scheduler). Call after plugins load. */
  start(): void;
  dispose(): void;
}

export function createCore(options: NibCoreOptions): NibCore {
  const db = openDatabase(options.dbPath);
  const deviceId = getOrCreateDeviceId(db);
  const bus = createEventBus();
  const clock = createHlcClock(deviceId);
  const data = createDataLayer({ db, bus, clock, deviceId });
  const commands = createCommandRegistry({ bus });
  const scheduler = createScheduler({ db, bus });
  const permissions = createPermissionEngine({ mode: options.permissionMode ?? 'log-only' });
  const services = createServiceRegistry();

  const searchProviders = new Set<(query: string) => SearchHit[]>();
  const registerSearchProvider = (provider: (query: string) => SearchHit[]) => {
    searchProviders.add(provider);
    return () => {
      searchProviders.delete(provider);
    };
  };

  const search = (query: string, options?: SearchOptions): SearchHit[] => {
    const hits = data.search(query, options);
    let extra: SearchHit[] = [];
    for (const provider of [...searchProviders]) {
      try {
        extra.push(...provider(query));
      } catch (error) {
        console.error('[nib:search] provider threw', error);
      }
    }
    if (options?.types) {
      extra = extra.filter((hit) => options.types!.includes(hit.record.type));
    }
    return [...hits, ...extra];
  };

  return {
    deviceId,
    bus,
    data,
    commands,
    scheduler,
    permissions,
    services,
    search,
    registerSearchProvider,
    loadPlugins: (modules) =>
      loadPlugins(modules, {
        data,
        bus,
        commands,
        scheduler,
        permissions,
        services,
        registerSearchProvider,
      }),
    start: () => scheduler.start(),
    dispose: () => {
      scheduler.stop();
      db.close();
    },
  };
}
