export const APP_ID = 'nib';
export const APP_NAME = 'Nib';

export { createCore, type NibCore, type NibCoreOptions } from './core';
export { getOrCreateDeviceId, inTransaction, migrate, openDatabase } from './db';
export { createEventBus, matchesPattern, type EventBus } from './events';
export { compareHlc, createHlcClock, encodeHlc, parseHlc, type HlcClock } from './hlc';
export { newDeviceId, newJobId, newRecordId } from './ids';
export { createConsoleLogger } from './logger';
export {
  createPermissionEngine,
  permissionMatches,
  type PermissionEngine,
  type PermissionMode,
  type PermissionViolation,
} from './permissions';
export {
  loadPlugin,
  loadPlugins,
  type LoadedPlugin,
  type LoadResult,
  type PluginHostDeps,
} from './plugins';
export {
  createDataLayer,
  toMatchQuery,
  type DataLayer,
  type OplogEntry,
  type UpdateOptions,
} from './records';
export { createScheduler, type JobHandler, type ScheduleJobInput, type Scheduler } from './scheduler';
export { createServiceRegistry, type ServiceHandler, type ServiceRegistry } from './services';
export {
  describePermission,
  hostAllowed,
  isSensitivePermission,
  networkDomains,
} from '@nib/plugin-api';
export {
  createCommandRegistry,
  type CommandInfo,
  type CommandRegistry,
  type RegisteredCommand,
} from './commands';
