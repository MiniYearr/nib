import { spawn, type ChildProcess } from 'node:child_process';
import type { Logger } from '@nib/plugin-api';
import { probeEndpoint } from './client';
import type { AssistantConfig } from './shared';

const HEALTH_POLL_MS = 500;
const HEALTH_TIMEOUT_MS = 60_000;

export interface Sidecar {
  /** Resolves with the endpoint base URL once the server answers, or throws. */
  start(): Promise<string>;
  stop(): void;
}

/**
 * Spawns `llama-server -m <model> --port <port>` and waits for its
 * OpenAI-compatible API to come up. Only used in "llama-server" mode —
 * endpoint mode talks to whatever the user already runs.
 */
export function createLlamaSidecar(config: AssistantConfig, log: Logger): Sidecar {
  let child: ChildProcess | undefined;

  return {
    async start() {
      if (!config.modelPath) throw new Error('llama-server mode requires a model path');
      const port = 41100 + Math.floor(Math.random() * 500);
      const baseUrl = `http://127.0.0.1:${port}/v1`;
      const binary = config.serverBinaryPath || 'llama-server';

      child = spawn(binary, ['-m', config.modelPath, '--port', String(port), '--host', '127.0.0.1'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      child.on('exit', (code) => log.warn(`llama-server exited with code ${code}`));
      child.on('error', (error) => log.error('llama-server failed to start', error));

      const deadline = Date.now() + HEALTH_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error('llama-server exited during startup');
        if (await probeEndpoint(baseUrl, 1000)) {
          log.info(`llama-server ready on ${baseUrl}`);
          return baseUrl;
        }
        await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
      }
      this.stop();
      throw new Error('llama-server did not become healthy in time');
    },

    stop() {
      if (child && child.exitCode === null) child.kill();
      child = undefined;
    },
  };
}
