import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CONFIG, type AssistantConfig } from './shared';

export function configPath(userDataDir: string): string {
  return join(userDataDir, 'assistant.json');
}

export function loadConfig(userDataDir: string): AssistantConfig {
  let stored: Partial<AssistantConfig> = {};
  try {
    stored = JSON.parse(readFileSync(configPath(userDataDir), 'utf8')) as Partial<AssistantConfig>;
  } catch {
    // First run — defaults apply.
  }
  const config = { ...DEFAULT_CONFIG, ...stored };
  const envEndpoint = process.env['NIB_AI_ENDPOINT'];
  if (envEndpoint) {
    config.mode = 'endpoint';
    config.endpointUrl = envEndpoint;
  }
  return config;
}

export function saveConfig(userDataDir: string, config: AssistantConfig): void {
  writeFileSync(configPath(userDataDir), JSON.stringify(config, null, 2), 'utf8');
}
