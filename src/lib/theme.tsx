import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useMediaQuery } from './useMediaQuery';
import { getTheme, isThemeId, STORAGE_KEY, STORAGE_MODE_KEY, type ThemeId, type ThemeMode, type ThemePreference } from './themes';

interface ThemeContextValue {
  preference: ThemePreference;
  /** The theme actually applied (system resolved to light/dark). */
  theme: ThemeId;
  mode: ThemeMode;
  /** Switch theme. Pass the click origin to animate a circular reveal from that point. */
  setPreference: (next: ThemePreference, origin?: { x: number; y: number }) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeId(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function persist(preference: ThemePreference, mode: ThemeMode) {
  try {
    if (preference === 'system') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_MODE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, preference);
      localStorage.setItem(STORAGE_MODE_KEY, mode);
    }
  } catch {
    /* storage unavailable (private mode): the theme still applies for this visit */
  }
}

/** Apply a theme to <html>: data-theme for colours, .dark for `dark:` variants, and the browser UI colour. */
export function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  const mode = getTheme(theme)?.mode ?? 'light';
  root.dataset.theme = theme;
  root.classList.toggle('dark', mode === 'dark');
  const canvas = getComputedStyle(root).getPropertyValue('--canvas').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', canvas);
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme: ThemeId = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  const mode = getTheme(theme)?.mode ?? 'light';

  useEffect(() => {
    applyTheme(theme);
    persist(preference, mode);
  }, [theme, preference, mode]);

  const setPreference = useCallback((next: ThemePreference, origin?: { x: number; y: number }) => {
    const nextTheme: ThemeId = next === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : next;
    const commit = () => {
      flushSync(() => setPreferenceState(next));
      applyTheme(nextTheme);
    };

    if (!document.startViewTransition || prefersReducedMotion()) {
      commit();
      return;
    }
    const root = document.documentElement;
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? 0;
    root.style.setProperty('--reveal-x', `${x}px`);
    root.style.setProperty('--reveal-y', `${y}px`);
    root.style.setProperty('--reveal-r', `${Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))}px`);
    document.startViewTransition(commit);
  }, []);

  const value = useMemo(() => ({ preference, theme, mode, setPreference }), [preference, theme, mode, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
