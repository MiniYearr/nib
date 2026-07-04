export type ServiceHandler = (payload: unknown) => Promise<unknown> | unknown;

/**
 * Cross-plugin request/response: a plugin registers a named handler
 * ("nib.media-anilist.lookup") and any module — or the trusted renderer via
 * IPC — can call it. This is how capability plugins (metadata providers,
 * later the AI endpoints) expose functionality without direct imports.
 */
export interface ServiceRegistry {
  /** `id` is fully namespaced. Returns an unregister function; duplicate ids throw. */
  register(id: string, handler: ServiceHandler): () => void;
  call(id: string, payload: unknown): Promise<unknown>;
  list(): string[];
}

export function createServiceRegistry(): ServiceRegistry {
  const handlers = new Map<string, ServiceHandler>();

  return {
    register(id, handler) {
      if (handlers.has(id)) throw new Error(`service already registered: ${id}`);
      handlers.set(id, handler);
      return () => {
        handlers.delete(id);
      };
    },

    async call(id, payload) {
      const handler = handlers.get(id);
      if (!handler) throw new Error(`unknown service: ${id}`);
      return await handler(payload);
    },

    list() {
      return [...handlers.keys()].sort();
    },
  };
}
