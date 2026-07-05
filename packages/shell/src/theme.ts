import { useCallback, useEffect, useState } from 'react';

export type ThemeName = 'light' | 'dark';
const STORAGE_KEY = 'nib.theme';

/**
 * The whole palette as CSS custom properties. Components reference `var(--nib-*)`
 * so a single `data-theme` on <html> flips the entire app. Accent stays constant
 * across themes; everything structural (surfaces, ink, borders) has a dark twin.
 */
export const themeCss = `
:root {
  --nib-app: #FBFAF7;
  --nib-titlebar: #EFEAE1;
  --nib-sidebar: #F3EFE7;
  --nib-paper: #FBFAF7;
  --nib-surface: #F5F1E9;
  --nib-chip: #F1EDE6;
  --nib-border: rgba(30, 25, 18, 0.09);
  --nib-border-strong: rgba(30, 25, 18, 0.13);
  --nib-ink: #26221D;
  --nib-ink-2: #5F594E;
  --nib-muted: #8A8171;
  --nib-faint: #9B948A;
  --nib-section: #A79F92;
  --nib-placeholder: #C9C2B4;
  --nib-accent: #BF6B44;
  --nib-accent-ink: #8C4F33;
  --nib-accent-soft: rgba(191, 107, 68, 0.13);
  --nib-streak: #6E8B6A;
  --nib-streak-ink: #4E6B4A;
  --nib-diary: #8A6BC8;
  --nib-book: #5B8AC8;
  --nib-danger: #A54D3B;
  --nib-info: #6B7C9B;
  --nib-shadow: rgba(50, 38, 24, 0.5);
  color-scheme: light;
}
:root[data-theme='dark'] {
  --nib-app: #201D17;
  --nib-titlebar: #191612;
  --nib-sidebar: #1A1712;
  --nib-paper: #252118;
  --nib-surface: #201D16;
  --nib-chip: #2E2A20;
  --nib-border: rgba(255, 255, 255, 0.07);
  --nib-border-strong: rgba(255, 255, 255, 0.12);
  --nib-ink: #ECE6DB;
  --nib-ink-2: #C4BCAD;
  --nib-muted: #9A9184;
  --nib-faint: #7C7568;
  --nib-section: #6B6355;
  --nib-placeholder: #5A5449;
  --nib-accent: #BF6B44;
  --nib-accent-ink: #D98A63;
  --nib-accent-soft: rgba(191, 107, 68, 0.22);
  --nib-streak: #6E8B6A;
  --nib-streak-ink: #8FB08A;
  --nib-diary: #9F82D8;
  --nib-book: #6B9AD8;
  --nib-danger: #D57460;
  --nib-info: #8296B5;
  --nib-shadow: rgba(0, 0, 0, 0.6);
  color-scheme: dark;
}
`;

function readTheme(): ThemeName {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function useTheme(): { theme: ThemeName; setTheme(theme: ThemeName): void } {
  const [theme, setThemeState] = useState<ThemeName>(readTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
