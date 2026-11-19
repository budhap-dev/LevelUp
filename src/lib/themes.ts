/** Theme ids and metadata. Colours live in src/styles/themes.css. */
export const THEMES = [
  { id: 'light', label: 'Daylight', mode: 'light' },
  { id: 'dark', label: 'Midnight', mode: 'dark' },
  { id: 'sepia', label: 'Sepia', mode: 'light' },
  { id: 'rose', label: 'Rose', mode: 'light' },
  { id: 'forest', label: 'Forest', mode: 'dark' },
  { id: 'ocean', label: 'Ocean', mode: 'dark' },
  { id: 'contrast', label: 'High contrast', mode: 'dark' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export type ThemeMode = 'light' | 'dark';
/** What the user picked: a theme, or follow the OS light/dark setting. */
export type ThemePreference = ThemeId | 'system';

export const STORAGE_KEY = 'levelup:theme';
/** Stored alongside the theme so the pre-paint script in index.html needs no theme table. */
export const STORAGE_MODE_KEY = 'levelup:theme-mode';

export const getTheme = (id: string) => THEMES.find((t) => t.id === id);
export const isThemeId = (id: unknown): id is ThemeId => typeof id === 'string' && !!getTheme(id);
