import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'levelup:theme';

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function applyTheme(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(read);

  useEffect(() => {
    applyTheme(preference);
    try {
      if (preference === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, preference);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const cycle = useCallback(
    () => setPreference((p) => (p === 'system' ? 'light' : p === 'light' ? 'dark' : 'system')),
    [],
  );

  return { preference, setPreference, cycle };
}
