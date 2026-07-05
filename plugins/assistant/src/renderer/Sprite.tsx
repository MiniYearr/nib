export type SpriteState = 'idle' | 'walk' | 'think' | 'cheer' | 'nudge';

export const spriteStyles = `
@keyframes nib-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes nib-blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.15); } }
@keyframes nib-walk { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-3px) rotate(3deg); } }
@keyframes nib-think { 0%, 100% { opacity: 0.35; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
@keyframes nib-cheer { 0%, 100% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-7px) rotate(-8deg); } 75% { transform: translateY(-7px) rotate(8deg); } }
@keyframes nib-spark { 0% { opacity: 0; transform: scale(0.4) translateY(4px); } 50% { opacity: 1; } 100% { opacity: 0; transform: scale(1) translateY(-10px); } }
.nib-sprite {
  position: relative;
  width: 44px;
  height: 50px;
  border-radius: 15px 15px 17px 17px;
  background: var(--nib-accent);
  box-shadow: 0 6px 14px -4px rgba(191, 107, 68, 0.6);
  cursor: pointer;
}
.nib-sprite[data-state='idle'] { animation: nib-bob 3s ease-in-out infinite; }
.nib-sprite[data-state='walk'] { animation: nib-walk 0.7s ease-in-out infinite; }
.nib-sprite[data-state='think'] { animation: nib-bob 1.4s ease-in-out infinite; }
.nib-sprite[data-state='cheer'], .nib-sprite[data-state='nudge'] { animation: nib-cheer 0.8s ease-in-out infinite; }
.nib-sprite-eye { position: absolute; top: 17px; width: 7px; height: 9px; border-radius: 3px; background: #fff; animation: nib-blink 4s infinite; }
.nib-sprite-eye[data-side='left'] { left: 10px; }
.nib-sprite-eye[data-side='right'] { right: 10px; }
.nib-sprite-antenna { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); width: 3px; height: 10px; background: var(--nib-accent); }
.nib-sprite-antenna::after { content: ''; position: absolute; top: -6px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; border-radius: 50%; background: var(--nib-accent); }
.nib-think-dots { position: absolute; top: -26px; left: 50%; transform: translateX(-50%); display: flex; gap: 3px; }
.nib-think-dots span { width: 6px; height: 6px; border-radius: 50%; background: var(--nib-accent); animation: nib-think 1.2s ease-in-out infinite; }
.nib-think-dots span:nth-child(2) { animation-delay: 0.2s; }
.nib-think-dots span:nth-child(3) { animation-delay: 0.4s; }
.nib-sparks { position: absolute; top: -18px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; }
.nib-sparks span { font-size: 13px; animation: nib-spark 1s ease-out infinite; }
.nib-sparks span:nth-child(2) { animation-delay: 0.25s; }
.nib-sparks span:nth-child(3) { animation-delay: 0.5s; }
`;

export interface SpriteProps {
  state: SpriteState;
  size?: number;
  onClick?(event: React.MouseEvent): void;
  onContextMenu?(event: React.MouseEvent): void;
  title?: string;
}

export function Sprite({ state, size = 50, onClick, onContextMenu, title }: SpriteProps) {
  const scale = size / 50;
  return (
    <div
      className="nib-sprite"
      data-state={state}
      title={title}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ transform: `scale(${scale})`, transformOrigin: 'bottom center' }}
    >
      {state === 'think' && (
        <div className="nib-think-dots">
          <span />
          <span />
          <span />
        </div>
      )}
      {state === 'cheer' && (
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
  );
}
