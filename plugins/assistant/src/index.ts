import { app, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import type { NibPluginContext, NibPluginModule } from '@nib/plugin-api';
import { chatCompletion, probeEndpoint } from './client';
import { loadConfig, saveConfig } from './config';
import { EXTRACTION_PROMPT, parseFacts, recallFacts, rememberFact } from './memory';
import { shouldDeliver, staleTasks, templateNudge } from './nudges';
import { createLlamaSidecar, type Sidecar } from './sidecar';
import {
  ASSISTANT_CHANNELS as CH,
  DEFAULT_MODES,
  FACT_TYPE,
  MODULE_ID,
  type AssistantConfig,
  type AssistantStatus,
  type ChatMessage,
  type NudgePayload,
} from './shared';

export { FACT_TYPE, MODULE_ID };

const MAX_HISTORY = 12;

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function daysAgoStr(days: number): string {
  const then = new Date();
  then.setDate(then.getDate() - days);
  return `${then.getFullYear()}-${String(then.getMonth() + 1).padStart(2, '0')}-${String(then.getDate()).padStart(2, '0')}`;
}

function nextHour(hour: number, now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

function buildContext(ctx: NibPluginContext, userMessage: string): string {
  const sections: string[] = [`Current date: ${todayStr()}.`];

  const facts = recallFacts(ctx, userMessage, 5);
  if (facts.length > 0) {
    sections.push(
      'Things you remember about the user:\n' +
        facts.map((fact) => `- ${fact.title}`).join('\n'),
    );
  }

  const hits = ctx.records
    .search(userMessage, { limit: 6 })
    .filter((hit) => hit.record.type !== FACT_TYPE)
    .slice(0, 5);
  if (hits.length > 0) {
    sections.push(
      'Possibly relevant items from the workspace:\n' +
        hits
          .map(
            (hit) =>
              `- [${hit.record.type}] ${hit.record.title || 'Untitled'}: ${hit.snippet.replaceAll(/[⟪⟫]/g, '')}`,
          )
          .join('\n'),
    );
  }

  const today = todayStr();
  const todaysTasks = ctx.records
    .list({ type: 'task', limit: 300 })
    .filter((record) => {
      const props = record.props as { status?: string; dueDate?: string };
      return props.status === 'open' && props.dueDate === today;
    })
    .slice(0, 8);
  if (todaysTasks.length > 0) {
    sections.push(
      "Today's open tasks:\n" + todaysTasks.map((task) => `- ${task.title}`).join('\n'),
    );
  }

  return sections.join('\n\n');
}

const assistantPlugin: NibPluginModule = {
  manifest: {
    id: MODULE_ID,
    name: 'Assistant',
    version: '0.1.0',
    minAppVersion: '0.1.0',
    description:
      'The on-screen companion: chat over your local model, memory with an inspector, proactive nudges.',
    permissions: [
      'records:read:*',
      `records:write:${FACT_TYPE}`,
      'events:subscribe:*',
      'scheduler',
    ],
    contributes: {
      recordTypes: [{ type: FACT_TYPE, title: 'Assistant memory' }],
    },
  },

  activate(ctx) {
    const userData = app.getPath('userData');
    let config = loadConfig(userData);
    let endpointBaseUrl: string | undefined;
    let sidecar: Sidecar | undefined;
    let status: AssistantStatus = 'unconfigured';
    let lastNudgeAt = 0;

    const emitStatus = () => ctx.events.emit(`${MODULE_ID}.status`, { status });

    async function connect(): Promise<void> {
      sidecar?.stop();
      sidecar = undefined;
      try {
        if (config.mode === 'llama-server') {
          if (!config.modelPath) {
            status = 'unconfigured';
            emitStatus();
            return;
          }
          sidecar = createLlamaSidecar(config, ctx.log);
          endpointBaseUrl = await sidecar.start();
          status = 'ready';
        } else {
          endpointBaseUrl = config.endpointUrl;
          status = (await probeEndpoint(endpointBaseUrl)) ? 'ready' : 'offline';
        }
      } catch (error) {
        ctx.log.error('assistant endpoint failed to start', error);
        status = 'offline';
      }
      emitStatus();
    }
    void connect();
    app.on('will-quit', () => sidecar?.stop());

    const modeFor = (id: string) => DEFAULT_MODES.find((mode) => mode.id === id) ?? DEFAULT_MODES[0]!;

    async function extractFactsFrom(userText: string, replyText: string): Promise<void> {
      if (status !== 'ready' || !endpointBaseUrl) return;
      try {
        const raw = await chatCompletion({
          baseUrl: endpointBaseUrl,
          model: config.modelName,
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: `User said: ${userText}\nAssistant replied: ${replyText}` },
          ],
          timeoutMs: 30_000,
        });
        const facts = parseFacts(raw);
        let added = 0;
        for (const fact of facts) {
          if (rememberFact(ctx, fact, 'chat')) added += 1;
        }
        if (added > 0) ctx.events.emit(`${MODULE_ID}.memory-updated`, { added });
      } catch (error) {
        ctx.log.warn('fact extraction failed', error);
      }
    }

    ipcMain.handle(CH.status, () => ({
      status,
      endpointUrl: endpointBaseUrl,
      activeModeId: config.activeModeId,
    }));

    ipcMain.handle(CH.configGet, () => ({ config, modes: DEFAULT_MODES }));

    ipcMain.handle(CH.configSet, async (_event, patch: Partial<AssistantConfig>) => {
      const endpointChanged =
        (patch.mode !== undefined && patch.mode !== config.mode) ||
        (patch.endpointUrl !== undefined && patch.endpointUrl !== config.endpointUrl) ||
        (patch.modelPath !== undefined && patch.modelPath !== config.modelPath);
      config = { ...config, ...patch };
      saveConfig(userData, config);
      if (endpointChanged) await connect();
      return config;
    });

    ipcMain.handle(CH.chat, async (_event, history: ChatMessage[]) => {
      if (status !== 'ready' || !endpointBaseUrl) {
        throw new Error(
          'No model connected — set an endpoint or model path in Assistant settings.',
        );
      }
      const requestId = randomUUID();
      const lastUser = [...history].reverse().find((message) => message.role === 'user');
      const context = buildContext(ctx, lastUser?.content ?? '');
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `${modeFor(config.activeModeId).systemPrompt}\n\n${context}`,
        },
        ...history.slice(-MAX_HISTORY),
      ];

      try {
        const full = await chatCompletion({
          baseUrl: endpointBaseUrl,
          model: config.modelName,
          messages,
          onDelta: (text) => ctx.events.emit(`${MODULE_ID}.delta`, { requestId, text }),
        });
        ctx.events.emit(`${MODULE_ID}.done`, { requestId, text: full });
        if (lastUser) void extractFactsFrom(lastUser.content, full);
        return { requestId, text: full };
      } catch (error) {
        ctx.events.emit(`${MODULE_ID}.error`, {
          requestId,
          message: error instanceof Error ? error.message : 'chat failed',
        });
        throw error;
      }
    });

    const deliver = (kind: NudgePayload['kind'], text: string) => {
      if (!config.nudgesEnabled) return;
      if (!shouldDeliver(new Date(), lastNudgeAt, config.quietHours)) return;
      lastNudgeAt = Date.now();
      ctx.events.emit(`${MODULE_ID}.nudge`, { kind, text } satisfies NudgePayload);
    };

    ctx.events.on('nib.todo.milestone', (event) => {
      const { title, streak } = event.payload as { title: string; streak: number };
      // Celebrations answer a user action directly — never throttled or quieted.
      ctx.events.emit(`${MODULE_ID}.celebrate`, {
        kind: 'milestone',
        text: templateNudge('milestone', { title, streak }),
      } satisfies NudgePayload);
    });

    ctx.events.on('nib.diary.on-this-day', (event) => {
      const { count } = event.payload as { count: number };
      deliver('on-this-day', templateNudge('on-this-day', { count }));
    });

    ctx.scheduler.onJob('stale-scan', () => {
      const stale = staleTasks(ctx.records.list({ type: 'task', limit: 500 }), daysAgoStr(2));
      const first = stale[0];
      if (first) {
        deliver(
          'stale-task',
          templateNudge('stale-task', {
            title: first.title || 'An untitled task',
            dueDate: (first.props as { dueDate?: string }).dueDate,
          }),
        );
      }
      ctx.scheduler.schedule({ kind: 'stale-scan', runAt: nextHour(10), unique: true });
    });
    ctx.scheduler.schedule({ kind: 'stale-scan', runAt: nextHour(10), unique: true });
  },

  deactivate() {
    // Sidecar lifetime is bound to the app; nothing else to release here.
  },
};

export default assistantPlugin;
