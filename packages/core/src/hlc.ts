/**
 * Hybrid logical clock. Encoded as `<ms:14 digits>:<counter:4 hex>:<deviceId>`
 * so that plain string comparison orders timestamps causally — the oplog and
 * future sync conflict resolution both rely on that property.
 */

export interface ParsedHlc {
  ms: number;
  counter: number;
  deviceId: string;
}

export interface HlcClock {
  next(): string;
  /** Fold a remote timestamp in so local time never runs behind observed time. */
  observe(remote: string): void;
}

const MAX_COUNTER = 0xffff;

export function encodeHlc(ms: number, counter: number, deviceId: string): string {
  return `${String(ms).padStart(14, '0')}:${counter.toString(16).padStart(4, '0')}:${deviceId}`;
}

export function parseHlc(value: string): ParsedHlc {
  const first = value.indexOf(':');
  const second = value.indexOf(':', first + 1);
  if (first === -1 || second === -1) throw new Error(`malformed HLC: "${value}"`);
  return {
    ms: Number(value.slice(0, first)),
    counter: parseInt(value.slice(first + 1, second), 16),
    deviceId: value.slice(second + 1),
  };
}

export function compareHlc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function createHlcClock(deviceId: string, now: () => number = Date.now): HlcClock {
  let lastMs = 0;
  let counter = 0;

  return {
    next(): string {
      const wall = now();
      if (wall > lastMs) {
        lastMs = wall;
        counter = 0;
      } else {
        counter += 1;
        if (counter > MAX_COUNTER) {
          lastMs += 1;
          counter = 0;
        }
      }
      return encodeHlc(lastMs, counter, deviceId);
    },

    observe(remote: string): void {
      const parsed = parseHlc(remote);
      if (parsed.ms > lastMs || (parsed.ms === lastMs && parsed.counter > counter)) {
        lastMs = parsed.ms;
        counter = parsed.counter;
      }
    },
  };
}
