import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ASSISTANT_CHANNELS as CH,
  type AssistantConfig,
  type AssistantMode,
  type AssistantStatus,
  type ChatMessage,
  type NudgePayload,
} from '../shared';
import { Sprite, spriteStyles, type SpriteState } from './Sprite';

const SPRITE_W = 60;
const SPRITE_H = 66;
const CHAT_W = 340;

const styles = `
.nib-stage { position: absolute; inset: 0; pointer-events: none; z-index: 50; }
.nib-stage > * { pointer-events: auto; }
.nib-stage-sprite {
  position: absolute;
  width: ${SPRITE_W}px;
  display: flex;
  justify-content: center;
  transition: left 2.6s ease-in-out, top 2.6s ease-in-out;
}
.nib-stage-bubble {
  position: absolute;
  max-width: 260px;
  background: #FBFAF7;
  border: 1px solid rgba(30, 25, 18, 0.14);
  border-radius: 13px;
  box-shadow: 0 14px 30px -12px rgba(50, 38, 24, 0.45);
  padding: 10px 13px;
  font-size: 12.5px;
  line-height: 1.5;
  color: #26221D;
  z-index: 55;
}
.nib-chat {
  position: absolute;
  width: ${CHAT_W}px;
  max-width: calc(100% - 24px);
  background: #FBFAF7;
  border: 1px solid rgba(30, 25, 18, 0.14);
  border-radius: 15px;
  box-shadow: 0 24px 50px -18px rgba(50, 38, 24, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 60;
}
.nib-chat-header { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 1px solid rgba(30, 25, 18, 0.08); font-size: 12px; font-weight: 700; color: #26221D; }
.nib-chat-header select { margin-left: auto; font: inherit; font-size: 11px; font-weight: 400; border: 1px solid rgba(30, 25, 18, 0.12); border-radius: 6px; background: #F7F3EB; padding: 3px 6px; color: #26221D; }
.nib-chat-header button { border: none; background: transparent; color: #8A8171; font-size: 14px; cursor: default; padding: 0 2px; }
.nib-chat-status { font-size: 10px; font-weight: 400; color: #A54D3B; }
.nib-chat-status[data-ready='true'] { color: #4E6B4A; }
.nib-chat-messages { height: 240px; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
.nib-chat-msg { max-width: 85%; padding: 7px 11px; border-radius: 12px; font-size: 12.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.nib-chat-msg[data-role='user'] { align-self: flex-end; background: rgba(191, 107, 68, 0.15); color: #26221D; }
.nib-chat-msg[data-role='assistant'] { align-self: flex-start; background: #F1EDE6; color: #26221D; }
.nib-chat-msg[data-role='error'] { align-self: flex-start; background: rgba(191, 68, 68, 0.1); color: #A54D3B; }
.nib-chat-empty { font-size: 12px; color: #A79F92; text-align: center; margin: auto; }
.nib-chat-input { display: flex; border-top: 1px solid rgba(30, 25, 18, 0.08); }
.nib-chat-input input { flex: 1; border: none; outline: none; background: transparent; font: inherit; font-size: 12.5px; padding: 10px 12px; color: #26221D; }
.nib-chat-input button { border: none; background: transparent; color: #BF6B44; font: inherit; font-size: 12px; font-weight: 700; padding: 0 14px; cursor: default; }
.nib-chat-input button:disabled { color: #C9C2B4; }
`;

interface DisplayMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

export interface NibStageProps {
  onDock(): void;
}

export function NibStage({ onDock }: NibStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ w: 800, h: 600 });
  const [pos, setPos] = useState({ x: 600, y: 480 });
  const [spriteState, setSpriteState] = useState<SpriteState>('idle');
  const [chatOpen, setChatOpen] = useState(false);
  const [bubble, setBubble] = useState<string>();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<AssistantStatus>('unconfigured');
  const [modes, setModes] = useState<AssistantMode[]>([]);
  const [activeModeId, setActiveModeId] = useState('quick');

  const pendingRef = useRef(false);
  pendingRef.current = pending;
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Measure the parent content area — the sprite never leaves these bounds.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setBounds({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Start near the bottom-right corner of the content area.
  useEffect(() => {
    setPos({ x: Math.max(bounds.w - SPRITE_W - 28, 8), y: Math.max(bounds.h - SPRITE_H - 20, 8) });
  }, [bounds.w, bounds.h]);

  // Wander within bounds while idle (only once popped out — this component
  // only mounts when the user sent Nib out).
  useEffect(() => {
    const timer = setInterval(() => {
      if (chatOpenRef.current || pendingRef.current) return;
      const x = 8 + Math.random() * Math.max(bounds.w - SPRITE_W - 16, 0);
      const y = 8 + Math.random() * Math.max(bounds.h - SPRITE_H - 16, 0);
      setPos({ x, y });
      setSpriteState('walk');
      setTimeout(() => setSpriteState((s) => (s === 'walk' ? 'idle' : s)), 2700);
    }, 7000);
    return () => clearInterval(timer);
  }, [bounds.w, bounds.h]);

  useEffect(() => {
    void window.nib
      ?.invoke(CH.configGet)
      .then((result) => {
        const { config, modes: allModes } = result as {
          config: AssistantConfig;
          modes: AssistantMode[];
        };
        setModes(allModes);
        setActiveModeId(config.activeModeId);
      })
      .catch(() => {});
    void window.nib
      ?.invoke(CH.status)
      .then((result) => setStatus((result as { status: AssistantStatus }).status))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!window.nib) return;
    const offs = [
      window.nib.events.on('nib.assistant.delta', (event) => {
        const { text } = event.payload as { text: string };
        if (!pendingRef.current) return;
        setMessages((current) => {
          const next = [...current];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { role: 'assistant', content: last.content + text };
          }
          return next;
        });
      }),
      window.nib.events.on('nib.assistant.status', (event) =>
        setStatus((event.payload as { status: AssistantStatus }).status),
      ),
      window.nib.events.on('nib.assistant.celebrate', (event) => {
        setSpriteState('cheer');
        setBubble((event.payload as NudgePayload).text);
        setTimeout(() => setSpriteState((s) => (s === 'cheer' ? 'idle' : s)), 6000);
      }),
      window.nib.events.on('nib.assistant.nudge', (event) => {
        setSpriteState('nudge');
        setBubble((event.payload as NudgePayload).text);
        setTimeout(() => setSpriteState((s) => (s === 'nudge' ? 'idle' : s)), 9000);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    if (!bubble) return;
    const timer = setTimeout(() => setBubble(undefined), 9000);
    return () => clearTimeout(timer);
  }, [bubble]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || pendingRef.current || !window.nib) return;
    setDraft('');
    setBubble(undefined);
    const history: ChatMessage[] = [
      ...messages
        .filter((m): m is DisplayMessage & { role: 'user' | 'assistant' } => m.role !== 'error')
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];
    setMessages((current) => [
      ...current,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ]);
    setPending(true);
    setSpriteState('think');
    try {
      const result = (await window.nib.invoke(CH.chat, history)) as { text: string };
      setMessages((current) => {
        const next = [...current];
        next[next.length - 1] = { role: 'assistant', content: result.text };
        return next;
      });
    } catch (error) {
      setMessages((current) => [
        ...current.slice(0, -1),
        {
          role: 'error',
          content: error instanceof Error ? error.message.replace(/^.*Error: /, '') : 'Chat failed',
        },
      ]);
    } finally {
      setPending(false);
      setSpriteState('idle');
    }
  }, [draft, messages]);

  const changeMode = (modeId: string) => {
    setActiveModeId(modeId);
    void window.nib?.invoke(CH.configSet, { activeModeId: modeId });
  };

  // Chat panel anchored to the sprite, clamped inside the content area.
  const chatPos = useMemo(() => {
    const left = Math.min(Math.max(pos.x - CHAT_W / 2, 12), Math.max(bounds.w - CHAT_W - 12, 12));
    const bottom = Math.max(bounds.h - pos.y + 8, 12);
    return { left, bottom };
  }, [pos, bounds]);

  const bubblePos = useMemo(
    () => ({
      left: Math.min(Math.max(pos.x - 100, 8), Math.max(bounds.w - 268, 8)),
      bottom: Math.max(bounds.h - pos.y + SPRITE_H, 12),
    }),
    [pos, bounds],
  );

  return (
    <div className="nib-stage" ref={rootRef}>
      <style>{spriteStyles}</style>
      <style>{styles}</style>

      {bubble && !chatOpen && (
        <div className="nib-stage-bubble" style={bubblePos} onClick={() => setBubble(undefined)}>
          {bubble}
        </div>
      )}

      <div className="nib-stage-sprite" style={{ left: pos.x, top: pos.y }}>
        <Sprite
          state={spriteState}
          title="Nib — click to chat, right-click to send home"
          onClick={() => setChatOpen((open) => !open)}
          onContextMenu={(event) => {
            event.preventDefault();
            onDock();
          }}
        />
      </div>

      {chatOpen && (
        <div className="nib-chat" style={chatPos}>
          <div className="nib-chat-header">
            <span>Nib</span>
            <span className="nib-chat-status" data-ready={status === 'ready'}>
              {status === 'ready' ? '● connected' : status === 'offline' ? '● offline' : '● no model'}
            </span>
            <select value={activeModeId} onChange={(event) => changeMode(event.target.value)}>
              {modes.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.title}
                </option>
              ))}
            </select>
            <button title="Close" onClick={() => setChatOpen(false)}>
              ×
            </button>
          </div>
          <div className="nib-chat-messages">
            {messages.length === 0 && (
              <div className="nib-chat-empty">
                Ask about your notes, tasks, or day.
                {status !== 'ready' && ' (No model connected yet — see Assistant settings.)'}
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className="nib-chat-msg" data-role={message.role}>
                {message.content || (message.role === 'assistant' && pending ? '…' : '')}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="nib-chat-input">
            <input
              autoFocus
              placeholder="Type to Nib…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void send();
                if (event.key === 'Escape') setChatOpen(false);
              }}
            />
            <button disabled={pending || !draft.trim()} onClick={() => void send()}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
