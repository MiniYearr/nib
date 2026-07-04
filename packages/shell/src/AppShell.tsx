import { CommandPalette } from './CommandPalette';

const tokens = {
  paper: '#FBFAF7',
  ink: '#26221D',
  inkMuted: '#8A8171',
  accent: '#BF6B44',
};

export function AppShell() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: tokens.paper,
        color: tokens.ink,
        fontFamily: "'Figtree', system-ui, sans-serif",
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 44,
          height: 50,
          borderRadius: '15px 15px 17px 17px',
          background: tokens.accent,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 17,
            left: 10,
            width: 7,
            height: 9,
            borderRadius: 3,
            background: '#fff',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 17,
            right: 10,
            width: 7,
            height: 9,
            borderRadius: 3,
            background: '#fff',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 3,
            height: 10,
            background: tokens.accent,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -15,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: tokens.accent,
          }}
        />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.015em' }}>Nib</div>
      <div style={{ fontSize: 13.5, color: tokens.inkMuted }}>
        The core spine is live — press <kbd>Ctrl</kbd>+<kbd>K</kbd> for the command palette.
      </div>
      <CommandPalette />
    </div>
  );
}
