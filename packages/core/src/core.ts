import type { NibPluginModule } from '@nib/plugin-api';
import { createCommandRegistry, type CommandRegistry } from './commands';
import { getOrCreateDeviceId, openDatabase } from './db';
import { createEventBus, type EventBus } from './events';
import { createHlcClock } from './hlc';
import { createPermissionEngine, type PermissionEngine, type PermissionMode } from './permissions';
import { loadPlugins, type LoadResult } from './plugins';
import { createDataLayer, type DataLayer } from './records';
import { createScheduler, type Scheduler } from './scheduler';

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

  return {
    deviceId,
    bus,
    data,
    commands,
    scheduler,
    permissions,
    loadPlugins: (modules) =>
      loadPlugins(modules, { data, bus, commands, scheduler, permissions }),
    start: () => scheduler.start(),
    dispose: () => {
      scheduler.stop();
      db.close();
    },
  };
}
