import { useCallback, useEffect, useState } from 'react';
import type { NibRecord } from '@nib/plugin-api';
import {
  ASSISTANT_CHANNELS as CH,
  FACT_TYPE,
  MODULE_ID,
  type AssistantConfig,
  type AssistantStatus,
} from '../shared';

const styles = `
.nib-assistant { display: flex; flex-direction: column; height: 100%; min-width: 0; }
.nib-assistant-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--nib-border);
  flex: none;
}
.nib-assistant-tab {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  padding: 6px 12px;
  border-radius: 8px;
  color: var(--nib-ink-2);
  cursor: default;
}
.nib-assistant-tab[data-active='true'] { background: rgba(191, 107, 68, 0.13); color: var(--nib-ink); font-weight: 600; }
.nib-assistant-status {
  margin-left: auto;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  color: var(--nib-danger);
}
.nib-assistant-status[data-ready='true'] { color: var(--nib-streak-ink); }
.nib-assistant-body { flex: 1; overflow-y: auto; padding: 16px 20px 40px; }
.nib-assistant-empty { color: var(--nib-muted); font-size: 13px; padding: 20px 0; }
.nib-fact {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--nib-border);
  border-radius: 11px;
  background: var(--nib-paper);
  margin-bottom: 8px;
}
.nib-fact-text { flex: 1; font-size: 13px; color: var(--nib-ink); line-height: 1.45; }
.nib-fact-meta {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  color: var(--nib-section);
  margin-top: 3px;
}
.nib-fact button {
  border: none;
  background: transparent;
  color: var(--nib-placeholder);
  font-size: 14px;
  cursor: default;
  padding: 0 2px;
  flex: none;
}
.nib-fact button:hover { color: var(--nib-danger); }
.nib-assistant-note { font-size: 12px; color: var(--nib-muted); line-height: 1.5; margin-bottom: 16px; max-width: 64ch; }
.nib-settings { display: flex; flex-direction: column; gap: 14px; max-width: 460px; }
.nib-settings label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 600; color: var(--nib-ink-2); }
.nib-settings input[type='text'], .nib-settings select {
  font: inherit;
  font-size: 13px;
  font-weight: 400;
  padding: 7px 10px;
  border: 1px solid var(--nib-border-strong);
  border-radius: 8px;
  background: var(--nib-paper);
  color: var(--nib-ink);
  outline: none;
}
.nib-settings-row { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 400; color: var(--nib-ink); flex-direction: row !important; }
.nib-settings-hint { font-size: 11.5px; color: var(--nib-section); font-weight: 400; line-height: 1.5; }
`;

function MemoryTab() {
  const [facts, setFacts] = useState<NibRecord[]>([]);

  const refresh = useCallback(() => {
    void window.nib?.records.list({ type: FACT_TYPE, limit: 1000 }).then(setFacts);
  }, []);

  useEffect(() => {
    refresh();
    if (!window.nib) return;
    const offMemory = window.nib.events.on('nib.assistant.memory-updated', refresh);
    const offRecords = window.nib.events.on('record.deleted', refresh);
    return () => {
      offMemory();
      offRecords();
    };
  }, [refresh]);

  const forget = async (id: string) => {
    await window.nib?.records.softDelete(MODULE_ID, id);
    refresh();
  };

  return (
    <div>
      <p className="nib-assistant-note">
        Everything Nib remembers about you, extracted from conversations. Deleting a fact removes
        it from every future chat's context — nothing here is ever shared off this device.
      </p>
      {facts.length === 0 && (
        <div className="nib-assistant-empty">
          Nothing remembered yet — facts appear here as you chat with the sprite.
        </div>
      )}
      {facts.map((fact) => (
        <div key={fact.id} className="nib-fact">
          <div className="nib-fact-text">
            {fact.title}
            <div className="nib-fact-meta">
              {String((fact.props as { source?: string }).source ?? 'chat')} ·{' '}
              {new Date(fact.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button title="Forget this" onClick={() => void forget(fact.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ onStatus }: { onStatus(status: AssistantStatus): void }) {
  const [config, setConfig] = useState<AssistantConfig>();

  useEffect(() => {
    void window.nib?.invoke(CH.configGet).then((result) => {
      setConfig((result as { config: AssistantConfig }).config);
    });
  }, []);

  const apply = async (patch: Partial<AssistantConfig>) => {
    const next = (await window.nib?.invoke(CH.configSet, patch)) as AssistantConfig;
    setConfig(next);
    const state = (await window.nib?.invoke(CH.status)) as { status: AssistantStatus };
    onStatus(state.status);
  };

  if (!config) return null;

  return (
    <div className="nib-settings">
      <label>
        Connection
        <select
          value={config.mode}
          onChange={(event) => void apply({ mode: event.target.value as AssistantConfig['mode'] })}
        >
          <option value="endpoint">OpenAI-compatible endpoint (Ollama, LM Studio, llama.cpp…)</option>
          <option value="llama-server">Let Nib run llama-server with a GGUF model</option>
        </select>
      </label>

      {config.mode === 'endpoint' ? (
        <label>
          Endpoint URL
          <input
            type="text"
            defaultValue={config.endpointUrl}
            onBlur={(event) =>
              event.target.value !== config.endpointUrl &&
              void apply({ endpointUrl: event.target.value })
            }
          />
          <span className="nib-settings-hint">
            The /v1 base of any OpenAI-compatible server, e.g. http://127.0.0.1:11434/v1
          </span>
        </label>
      ) : (
        <>
          <label>
            GGUF model path
            <input
              type="text"
              defaultValue={config.modelPath ?? ''}
              placeholder="C:\\models\\my-model.gguf"
              onBlur={(event) =>
                event.target.value !== (config.modelPath ?? '') &&
                void apply({ modelPath: event.target.value || undefined })
              }
            />
          </label>
          <label>
            llama-server binary (optional, defaults to PATH)
            <input
              type="text"
              defaultValue={config.serverBinaryPath ?? ''}
              placeholder="llama-server"
              onBlur={(event) =>
                event.target.value !== (config.serverBinaryPath ?? '') &&
                void apply({ serverBinaryPath: event.target.value || undefined })
              }
            />
          </label>
        </>
      )}

      <label className="nib-settings-row">
        <input
          type="checkbox"
          checked={config.nudgesEnabled}
          onChange={(event) => void apply({ nudgesEnabled: event.target.checked })}
        />
        Proactive nudges (max one per hour, quiet {config.quietHours.start}:00–
        {config.quietHours.end}:00)
      </label>
    </div>
  );
}

export function AssistantView() {
  const [tab, setTab] = useState<'memory' | 'settings'>('memory');
  const [status, setStatus] = useState<AssistantStatus>('unconfigured');

  useEffect(() => {
    void window.nib
      ?.invoke(CH.status)
      .then((result) => setStatus((result as { status: AssistantStatus }).status))
      .catch(() => {});
    return window.nib?.events.on('nib.assistant.status', (event) => {
      setStatus((event.payload as { status: AssistantStatus }).status);
    });
  }, []);

  return (
    <div className="nib-assistant">
      <style>{styles}</style>
      <div className="nib-assistant-header">
        <button className="nib-assistant-tab" data-active={tab === 'memory'} onClick={() => setTab('memory')}>
          Memory
        </button>
        <button
          className="nib-assistant-tab"
          data-active={tab === 'settings'}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
        <span className="nib-assistant-status" data-ready={status === 'ready'}>
          {status === 'ready' ? 'model connected' : status === 'offline' ? 'model offline' : 'no model configured'}
        </span>
      </div>
      <div className="nib-assistant-body">
        {tab === 'memory' ? <MemoryTab /> : <SettingsTab onStatus={setStatus} />}
      </div>
    </div>
  );
}
