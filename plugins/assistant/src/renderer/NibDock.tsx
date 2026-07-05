import { useEffect, useState } from 'react';
import {
  ASSISTANT_CHANNELS as CH,
  DEFAULT_MODES,
  type AssistantConfig,
  type AssistantStatus,
  type NudgePayload,
} from '../shared';

const styles = `
.nib-dock {
  display: flex;
  align-items: center;
  gap: 9px;
  background: #FBFAF7;
  border: 1px solid rgba(30, 25, 18, 0.1);
  border-radius: 10px;
  padding: 8px 10px;
  margin-top: 8px;
  cursor: default;
  position: relative;
}
.nib-dock:hover { border-color: rgba(191, 107, 68, 0.4); }
.nib-dock[data-collapsed='true'] { justify-content: center; padding: 8px 0; }
.nib-dock-sprite {
  width: 22px;
  height: 26px;
  border-radius: 8px 8px 9px 9px;
  background: #BF6B44;
  position: relative;
  flex: none;
}
.nib-dock[data-nudging='true'] .nib-dock-sprite { animation: nib-bob 1.2s ease-in-out infinite; }
.nib-dock-sprite-eye { position: absolute; top: 9px; width: 3.5px; height: 5px; border-radius: 2px; background: #fff; }
.nib-dock-sprite-eye[data-side='left'] { left: 5px; }
.nib-dock-sprite-eye[data-side='right'] { right: 5px; }
.nib-dock-text { flex: 1; min-width: 0; }
.nib-dock-name { font-size: 12px; font-weight: 600; line-height: 1.2; }
.nib-dock-mode { font-size: 10.5px; color: #8A8171; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nib-dock-status { width: 7px; height: 7px; border-radius: 50%; background: #C3BBAD; flex: none; }
.nib-dock-status[data-ready='true'] { background: #6E8B6A; }
.nib-dock-status[data-offline='true'] { background: #C0533B; }
.nib-dock-bubble {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  background: #FBFAF7;
  border: 1px solid rgba(30, 25, 18, 0.14);
  border-radius: 11px;
  box-shadow: 0 12px 26px -12px rgba(50, 38, 24, 0.45);
  padding: 9px 11px;
  font-size: 12px;
  line-height: 1.45;
  color: #26221D;
  z-index: 20;
}
`;

export interface NibDockProps {
  onPop(): void;
  collapsed: boolean;
}

export function NibDock({ onPop, collapsed }: NibDockProps) {
  const [status, setStatus] = useState<AssistantStatus>('unconfigured');
  const [modeTitle, setModeTitle] = useState('Assistant');
  const [bubble, setBubble] = useState<string>();

  useEffect(() => {
    void window.nib
      ?.invoke(CH.status)
      .then((result) => setStatus((result as { status: AssistantStatus }).status))
      .catch(() => {});
    void window.nib
      ?.invoke(CH.configGet)
      .then((result) => {
        const { config } = result as { config: AssistantConfig };
        const mode = DEFAULT_MODES.find((m) => m.id === config.activeModeId);
        setModeTitle(mode?.title ?? 'Assistant');
      })
      .catch(() => {});
    if (!window.nib) return;
    const offs = [
      window.nib.events.on('nib.assistant.status', (event) =>
        setStatus((event.payload as { status: AssistantStatus }).status),
      ),
      window.nib.events.on('nib.assistant.nudge', (event) => {
        setBubble((event.payload as NudgePayload).text);
      }),
      window.nib.events.on('nib.assistant.celebrate', (event) => {
        setBubble((event.payload as NudgePayload).text);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    if (!bubble) return;
    const timer = setTimeout(() => setBubble(undefined), 8000);
    return () => clearTimeout(timer);
  }, [bubble]);

  return (
    <div
      className="nib-dock"
      data-collapsed={collapsed}
      data-nudging={Boolean(bubble)}
      title="Send Nib out to wander"
      onClick={onPop}
    >
      <style>{styles}</style>
      {bubble && !collapsed && (
        <div
          className="nib-dock-bubble"
          onClick={(event) => {
            event.stopPropagation();
            setBubble(undefined);
          }}
        >
          {bubble}
        </div>
      )}
      <div className="nib-dock-sprite">
        <div className="nib-dock-sprite-eye" data-side="left" />
        <div className="nib-dock-sprite-eye" data-side="right" />
      </div>
      {!collapsed && (
        <div className="nib-dock-text">
          <div className="nib-dock-name">Nib</div>
          <div className="nib-dock-mode">{modeTitle}</div>
        </div>
      )}
      <div
        className="nib-dock-status"
        data-ready={status === 'ready'}
        data-offline={status === 'offline'}
      />
    </div>
  );
}
