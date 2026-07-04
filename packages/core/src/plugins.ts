import type {
  CommandsApi,
  EventsApi,
  Logger,
  NibPluginContext,
  NibPluginModule,
  PluginManifest,
  RecordsApi,
  SchedulerApi,
} from '@nib/plugin-api';
import { validateManifest } from '@nib/plugin-api';
import type { CommandRegistry } from './commands';
import type { EventBus } from './events';
import { createConsoleLogger } from './logger';
import type { PermissionEngine } from './permissions';
import type { DataLayer } from './records';
import type { Scheduler } from './scheduler';

export interface PluginHostDeps {
  data: DataLayer;
  bus: EventBus;
  commands: CommandRegistry;
  scheduler: Scheduler;
  permissions: PermissionEngine;
  createLogger?: (pluginId: string) => Logger;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  dispose(): Promise<void>;
}

export interface LoadResult {
  loaded: LoadedPlugin[];
  errors: { pluginId: string; error: unknown }[];
}

function denied(pluginId: string, capability: string): Error {
  return new Error(`permission denied: "${capability}" (plugin ${pluginId})`);
}

function buildContext(
  manifest: PluginManifest,
  deps: PluginHostDeps,
  disposers: (() => void)[],
): NibPluginContext {
  const { data, bus, commands: registry, scheduler, permissions } = deps;
  const pluginId = manifest.id;

  const typeOf = (recordId: string): string =>
    data.get(recordId, { includeDeleted: true })?.type ?? '*';

  const records: RecordsApi = {
    create(input) {
      if (!permissions.check(pluginId, `records:write:${input.type}`)) {
        throw denied(pluginId, `records:write:${input.type}`);
      }
      return data.create(pluginId, input);
    },
    get(recordId) {
      const record = data.get(recordId);
      if (!record) return undefined;
      return permissions.check(pluginId, `records:read:${record.type}`) ? record : undefined;
    },
    update(recordId, patch) {
      const type = typeOf(recordId);
      if (!permissions.check(pluginId, `records:write:${type}`)) {
        throw denied(pluginId, `records:write:${type}`);
      }
      return data.update(pluginId, recordId, patch);
    },
    softDelete(recordId) {
      const type = typeOf(recordId);
      if (!permissions.check(pluginId, `records:write:${type}`)) {
        throw denied(pluginId, `records:write:${type}`);
      }
      data.softDelete(pluginId, recordId);
    },
    list(options) {
      if (!permissions.check(pluginId, `records:read:${options?.type ?? '*'}`)) return [];
      return data.list(options);
    },
    search(query, options) {
      const verdicts = new Map<string, boolean>();
      const allowed = (type: string): boolean => {
        if (!verdicts.has(type)) {
          verdicts.set(type, permissions.check(pluginId, `records:read:${type}`));
        }
        return verdicts.get(type)!;
      };
      return data.search(query, options).filter((hit) => allowed(hit.record.type));
    },
    listTags() {
      return permissions.check(pluginId, 'records:read:*') ? data.listTags() : [];
    },
    listVersions(recordId) {
      if (!permissions.check(pluginId, `records:read:${typeOf(recordId)}`)) return [];
      return data.listVersions(recordId);
    },
    getVersion(versionId) {
      const version = data.getVersion(versionId);
      if (!version) return undefined;
      if (!permissions.check(pluginId, `records:read:${typeOf(version.recordId)}`)) {
        return undefined;
      }
      return version;
    },
    restoreVersion(recordId, versionId) {
      const type = typeOf(recordId);
      if (!permissions.check(pluginId, `records:write:${type}`)) {
        throw denied(pluginId, `records:write:${type}`);
      }
      return data.restoreVersion(pluginId, recordId, versionId);
    },
  };

  const events: EventsApi = {
    emit(type, payload) {
      if (!type.startsWith(`${pluginId}.`)) {
        throw new Error(
          `plugin event types must be namespaced under "${pluginId}.", got "${type}"`,
        );
      }
      bus.emit(type, payload, pluginId);
    },
    on(pattern, handler) {
      if (!permissions.check(pluginId, `events:subscribe:${pattern}`)) {
        return () => {};
      }
      const off = bus.on(pattern, handler);
      disposers.push(off);
      return off;
    },
  };

  const commands: CommandsApi = {
    register(command) {
      const off = registry.register({
        id: `${pluginId}.${command.id}`,
        title: command.title,
        category: command.category,
        moduleId: pluginId,
        run: command.run,
      });
      disposers.push(off);
      return off;
    },
  };

  const schedulerApi: SchedulerApi = {
    schedule(input) {
      if (!permissions.check(pluginId, 'scheduler')) throw denied(pluginId, 'scheduler');
      return scheduler.schedule({
        kind: `${pluginId}.${input.kind}`,
        moduleId: pluginId,
        runAt: input.runAt,
        intervalMs: input.intervalMs,
        payload: input.payload,
        unique: input.unique,
      });
    },
    cancel(jobId) {
      if (!permissions.check(pluginId, 'scheduler')) throw denied(pluginId, 'scheduler');
      scheduler.cancel(pluginId, jobId);
    },
    onJob(kind, handler) {
      if (!permissions.check(pluginId, 'scheduler')) return () => {};
      const off = scheduler.onJob(`${pluginId}.${kind}`, handler);
      disposers.push(off);
      return off;
    },
  };

  return {
    manifest,
    records,
    events,
    commands,
    scheduler: schedulerApi,
    log: (deps.createLogger ?? createConsoleLogger)(pluginId),
  };
}

export async function loadPlugin(
  module: NibPluginModule,
  deps: PluginHostDeps,
): Promise<LoadedPlugin> {
  const validation = validateManifest(module.manifest);
  if (!validation.ok) {
    throw new Error(
      `invalid manifest for "${module.manifest?.id ?? 'unknown'}": ${validation.errors.join('; ')}`,
    );
  }
  const manifest = validation.manifest;
  deps.permissions.grant(manifest.id, manifest.permissions);

  const disposers: (() => void)[] = [];
  const ctx = buildContext(manifest, deps, disposers);
  await module.activate(ctx);

  return {
    manifest,
    async dispose() {
      await module.deactivate?.();
      for (const dispose of disposers.reverse()) dispose();
      disposers.length = 0;
    },
  };
}

export async function loadPlugins(
  modules: NibPluginModule[],
  deps: PluginHostDeps,
): Promise<LoadResult> {
  const result: LoadResult = { loaded: [], errors: [] };
  for (const module of modules) {
    try {
      result.loaded.push(await loadPlugin(module, deps));
    } catch (error) {
      result.errors.push({ pluginId: module.manifest?.id ?? 'unknown', error });
      (deps.createLogger ?? createConsoleLogger)('nib:plugins').error(
        `failed to load plugin "${module.manifest?.id ?? 'unknown'}"`,
        error,
      );
    }
  }
  return result;
}
