import type { Logger } from '@nib/plugin-api';

export function createConsoleLogger(prefix: string): Logger {
  return {
    info: (message, ...detail) => console.log(`[${prefix}] ${message}`, ...detail),
    warn: (message, ...detail) => console.warn(`[${prefix}] ${message}`, ...detail),
    error: (message, ...detail) => console.error(`[${prefix}] ${message}`, ...detail),
  };
}
