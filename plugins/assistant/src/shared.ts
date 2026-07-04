export const MODULE_ID = 'nib.assistant';
export const FACT_TYPE = 'ai-fact';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AssistantMode {
  id: string;
  title: string;
  systemPrompt: string;
}

export const DEFAULT_MODES: AssistantMode[] = [
  {
    id: 'quick',
    title: 'Quick assistant',
    systemPrompt:
      'You are Nib, a small friendly companion living on the user\'s desktop inside their local-first notebook app. Answer briefly and concretely using the provided workspace context. If the context lacks the answer, say so plainly.',
  },
  {
    id: 'coach',
    title: 'Planning coach',
    systemPrompt:
      'You are Nib in planning-coach mode. Help the user plan their day and projects: propose small concrete next steps, reference their open tasks and habits from the provided context, and gently point out stalled work. Be encouraging but honest.',
  },
];

export interface AssistantConfig {
  /** "endpoint": talk to any OpenAI-compatible URL. "llama-server": Nib spawns one. */
  mode: 'endpoint' | 'llama-server';
  endpointUrl: string;
  /** GGUF path for llama-server mode. */
  modelPath?: string;
  /** llama-server binary; defaults to "llama-server" on PATH. */
  serverBinaryPath?: string;
  modelName?: string;
  activeModeId: string;
  nudgesEnabled: boolean;
  quietHours: { start: number; end: number };
}

export const DEFAULT_CONFIG: AssistantConfig = {
  mode: 'endpoint',
  endpointUrl: 'http://127.0.0.1:11434/v1',
  activeModeId: 'quick',
  nudgesEnabled: true,
  quietHours: { start: 22, end: 8 },
};

export type AssistantStatus = 'unconfigured' | 'offline' | 'ready';

export interface NudgePayload {
  kind: 'milestone' | 'on-this-day' | 'stale-task' | 'info';
  text: string;
}

export const ASSISTANT_CHANNELS = {
  chat: 'nib.assistant:chat',
  status: 'nib.assistant:status',
  configGet: 'nib.assistant:config.get',
  configSet: 'nib.assistant:config.set',
} as const;

export const OVERLAY_CHANNELS = {
  setInteractive: 'nib.overlay:set-interactive',
} as const;
