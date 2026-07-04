import { matchesPattern, type NibEvent, type NibEventHandler } from '@nib/plugin-api';

export { matchesPattern };
export type { NibEvent, NibEventHandler };

export interface EventBus {
  emit(type: string, payload: unknown, source: string): void;
  /** Returns an unsubscribe function. */
  on(pattern: string, handler: NibEventHandler): () => void;
}

interface Subscription {
  pattern: string;
  handler: NibEventHandler;
}

export function createEventBus(
  onHandlerError: (error: unknown, event: NibEvent) => void = (error, event) =>
    console.error(`[nib:events] handler for "${event.type}" threw`, error),
): EventBus {
  const subscriptions = new Set<Subscription>();

  return {
    emit(type, payload, source) {
      const event: NibEvent = { type, payload, source, ts: Date.now() };
      for (const sub of [...subscriptions]) {
        if (!matchesPattern(sub.pattern, type)) continue;
        try {
          sub.handler(event);
        } catch (error) {
          onHandlerError(error, event);
        }
      }
    },

    on(pattern, handler) {
      const sub: Subscription = { pattern, handler };
      subscriptions.add(sub);
      return () => subscriptions.delete(sub);
    },
  };
}
