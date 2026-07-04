import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ASSISTANT_CHANNELS as CH,
  OVERLAY_CHANNELS,
  type AssistantConfig,
  type AssistantMode,
  type AssistantStatus,
  type ChatMessage,
  type NudgePayload,
} from '../shared';

type SpriteState = 'idle' | 'walk' | 'think' | 'cheer' | 'nudge';

const styles = `
* { box-sizing: border-box; }
html, body, #root { margin: 0; height: 100%; background: transparent; overflow: hidden; }
.nib-overlay {
  position: relative;
  height: 100%;
  font-family: 'Figtree', system-ui, sans-serif;
  user-select: none;
}
@keyframes nib-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes nib-blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.15); } }
@keyframes nib-walk { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-3px) rotate(3deg); } }
@keyframes nib-think { 0%, 100% { opacity: 0.35; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
@keyframes nib-cheer { 0%, 100% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-7px) rotate(-8deg); } 75% { transform: translateY(-7px) rotate(8deg); } }
@keyframes nib-spark { 0% { opacity: 0; transform: scale(0.4) translateY(4px); } 50% { opacity: 1; } 100% { opacity: 0; transform: scale(1) translateY(-10px); } }
.nib-sprite-slot {
  position: absolute;
  bottom: 6px;
  width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: left 3s linear;
}
.nib-sprite {
  position: relative;
  width: 44px;
  height: 50px;
  border-radius: 15px 15px 17px 17px;
  background: #BF6B44;
  box-shadow: 0 6px 14px -4px rgba(191, 107, 68, 0.6);
  cursor: pointer;
}
.nib-sprite[data-state='idle'] { animation: nib-bob 3s ease-in-out infinite; }
.nib-sprite[data-state='walk'] { animation: nib-walk 0.7s ease-in-out infinite; }
.nib-sprite[data-state='think'] { animation: nib-bob 1.4s ease-in-out infinite; }
.nib-sprite[data-state='cheer'], .nib-sprite[data-state='nudge'] { animation: nib-cheer 0.8s ease-in-out infinite; }
.nib-sprite-eye {
  position: absolute;
  top: 17px;
  width: 7px;
  height: 9px;
  border-radius: 3px;
  background: #fff;
  animation: nib-blink 4s infinite;
}
.nib-sprite-eye[data-side='left'] { left: 10px; }
.nib-sprite-eye[data-side='right'] { right: 10px; }
.nib-sprite-antenna {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 10px;
  background: #BF6B44;
}
.nib-sprite-antenna::after {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #BF6B44;
}
.nib-think-dots { position: absolute; top: -26px; left: 50%; transform: translateX(-50%); display: flex; gap: 3px; }
.nib-think-dots span {
  width: 6px; height: 6px; border-radius: 50%; background: #BF6B44;
  animation: nib-think 1.2s ease-in-out infinite;
}
.nib-think-dots span:nth-child(2) { animation-delay: 0.2s; }
.nib-think-dots span:nth-child(3) { animation-delay: 0.4s; }
.nib-sparks { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; }
.nib-sparks span { font-size: 13px; animation: nib-spark 1s ease-out infinite; }
.nib-sparks span:nth-child(2) { animation-delay: 0.25s; }
.nib-sparks span:nth-child(3) { animation-delay: 0.5s; }
.nib-bubble {
  position: absolute;
  bottom: 70px;
  max-width: 260px;
  background: #FBFAF7;
  border: 1px solid rgba(30, 25, 18, 0.14);
  border-radius: 13px;
  box-shadow: 0 14px 30px -12px rgba(50, 38, 24, 0.45);
  padding: 10px 13px;
  font-size: 12.5px;
  line-height: 1.5;
  color: #26221D;
}
.nib-chat {
  position: absolute;
  bottom: 76px;
  width: 340px;
  max-width: calc(100vw - 24px);
  background: #FBFAF7;
  border: 1px solid rgba(30, 25, 18, 0.14);
  border-radius: 15px;
  box-shadow: 0 24px 50px -18px rgba(50, 38, 24, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.nib-chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid rgba(30, 25, 18, 0.08);
  font-size: 12px;
  font-weight: 700;
  color: #26221D;
}
.nib-chat-header select {
  margin-left: auto;
  font: inherit;
  font-size: 11px;
  font-weight: 400;
  border: 1px solid rgba(30, 25, 18, 0.12);
  border-radius: 6px;
  background: #F7F3EB;
  padding: 3px 6px;
  color: #26221D;
}
.nib-chat-header button {
  border: none; background: transparent; color: #8A8171; font-size: 14px; cursor: pointer; padding: 0 2px;
}
.nib-chat-status { font-size: 10px; font-weight: 400; color: #A54D3B; }
.nib-chat-status[data-ready='true'] { color: #4E6B4A; }
.nib-chat-messages {
  height: 240px;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nib-chat-msg {
  max-width: 85%;
  padding: 7px 11px;
  border-radius: 12px;
  font-size: 12.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.nib-chat-msg[data-role='user'] { align-self: flex-end; background: rgba(191, 107, 68, 0.15); color: #26221D; }
.nib-chat-msg[data-role='assistant'] { align-self: flex-start; background: #F1EDE6; color: #26221D; }
.nib-chat-msg[data-role='error'] { align-self: flex-start; background: rgba(191, 68, 68, 0.1); color: #A54D3B; }
.nib-chat-empty { font-size: 12px; color: #A79F92; text-align: center; margin: auto; }
.nib-chat-input { display: flex; border-top: 1px solid rgba(30, 25, 18, 0.08); }
.nib-chat-input input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  padding: 10px 12px;
  color: #26221D;
}
.nib-chat-input button {
  border: none;
  background: transparent;
  color: #BF6B44;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  padding: 0 14px;
  cursor: pointer;
}
.nib-chat-input button:disabled { color: #C9C2B4; }
`;

interface Bubble {
  text: string;
  kind: NudgePayload['kind'];
}

interface DisplayMessage {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

function setInteractive(interactive: boolean): void {
  void window.nib?.invoke(OVERLAY_CHANNELS.setInteractive, interactive);
}

export function OverlayApp() {
  const [spriteState, setSpriteState] = useState<SpriteState>('idle');
  const [spriteX, setSpriteX] = useState(120);
  const [chatOpen, setChatOpen] = useState(false);
  const [bubble, setBubble] = useState<Bubble>();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<AssistantStatus>('unconfigured');
  const [modes, setModes] = useState<AssistantMode[]>([]);
  const [activeModeId, setActiveModeId] = useState('quick');

  const interactiveRef = useRef(false);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = chatOpen;
  const pendingRef = useRef(false);
  pendingRef.current = pending;
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Wander: pick a new spot along the strip every so often while idle.
  useEffect(() => {
    const timer = setInterval(() => {
      if (chatOpenRef.current || pendingRef.current) return;
      const max = Math.max(window.innerWidth - 100, 120);
      setSpriteX(20 + Math.random() * (max - 20));
      setSpriteState('walk');
      setTimeout(() => {
        setSpriteState((current) => (current === 'walk' ? 'idle' : current));
      }, 3100);
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  // Bus events: streaming, celebrations, nudges, status.
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
      window.nib.events.on('nib.assistant.status', (event) => {
        setStatus((event.payload as { status: AssistantStatus }).status);
      }),
      window.nib.events.on('nib.assistant.celebrate', (event) => {
        const payload = event.payload as NudgePayload;
        setSpriteState('cheer');
        setBubble({ text: payload.text, kind: payload.kind });
        setTimeout(() => {
          setSpriteState((current) => (current === 'cheer' ? 'idle' : current));
          setBubble((current) => (current?.text === payload.text ? undefined : current));
        }, 6000);
      }),
      window.nib.events.on('nib.assistant.nudge', (event) => {
        const payload = event.payload as NudgePayload;
        setSpriteState('nudge');
        setBubble({ text: payload.text, kind: payload.kind });
        setTimeout(() => {
          setSpriteState((current) => (current === 'nudge' ? 'idle' : current));
          setBubble((current) => (current?.text === payload.text ? undefined : current));
        }, 9000);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  // Per-pixel-ish click-through: the OS forwards mouse moves; we flip
  // interactivity whenever the cursor enters/leaves an interactive element.
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const overInteractive = Boolean(element?.closest('[data-interactive]'));
      if (overInteractive !== interactiveRef.current) {
        interactiveRef.current = overInteractive;
        setInteractive(overInteractive);
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

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
        .filter((message): message is DisplayMessage & { role: 'user' | 'assistant' } =>
          message.role !== 'error',
        )
        .map((message) => ({ role: message.role, content: message.content })),
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

  return (
    <div className="nib-overlay">
      <style>{styles}</style>
      <div className="nib-sprite-slot" style={{ left: spriteX }}>
        {bubble && !chatOpen && (
          <div className="nib-bubble" data-interactive onClick={() => setBubble(undefined)}>
            {bubble.text}
          </div>
        )}
        <div
          className="nib-sprite"
          data-state={spriteState}
          data-interactive
          title="Nib"
          onClick={() => setChatOpen((open) => !open)}
        >
          {spriteState === 'think' && (
            <div className="nib-think-dots">
              <span />
              <span />
              <span />
            </div>
          )}
          {spriteState === 'cheer' && (
            <div className="nib-sparks">
              <span>✦</span>
              <span>✧</span>
              <span>✦</span>
            </div>
          )}
          <div className="nib-sprite-antenna" />
          <div className="nib-sprite-eye" data-side="left" />
          <div className="nib-sprite-eye" data-side="right" />
        </div>
      </div>

      {chatOpen && (
        <div
          className="nib-chat"
          data-interactive
          style={{ left: Math.min(spriteX, Math.max(window.innerWidth - 360, 12)) }}
        >
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
