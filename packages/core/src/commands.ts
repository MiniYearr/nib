import type { EventBus } from './events';

export interface CommandInfo {
  /** Fully qualified, e.g. "nib.notepad.new-note". */
  id: string;
  title: string;
  category?: string;
  moduleId: string;
}

export interface RegisteredCommand extends CommandInfo {
  run(): void | Promise<void>;
}

export interface CommandRegistry {
  /** Returns an unregister function. Throws on duplicate ids. */
  register(command: RegisteredCommand): () => void;
  list(): CommandInfo[];
  execute(id: string): Promise<void>;
}

export function createCommandRegistry(deps: { bus: EventBus }): CommandRegistry {
  const commands = new Map<string, RegisteredCommand>();

  return {
    register(command) {
      if (commands.has(command.id)) {
        throw new Error(`command already registered: ${command.id}`);
      }
      commands.set(command.id, command);
      return () => {
        commands.delete(command.id);
      };
    },

    list() {
      return [...commands.values()]
        .map(({ id, title, category, moduleId }) => ({ id, title, category, moduleId }))
        .sort((a, b) => a.title.localeCompare(b.title));
    },

    async execute(id) {
      const command = commands.get(id);
      if (!command) throw new Error(`unknown command: ${id}`);
      await command.run();
      deps.bus.emit('command.executed', { id }, command.moduleId);
    },
  };
}
