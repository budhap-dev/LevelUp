// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THEMES } from '../../src/lib/themes.ts';

/** WCAG AA contrast for every theme in src/styles/themes.css. */
const css = readFileSync(fileURLToPath(new URL('../../src/styles/themes.css', import.meta.url)), 'utf8');

/** Parse `[data-theme='x'] { --token: #hex; }` blocks. */
function parseThemes(source: string): Map<string, Record<string, string>> {
  const result = new Map<string, Record<string, string>>();
  const block = /((?:\s*(?::root|\[data-theme='[a-z-]+'\])\s*,?)+)\s*\{([^}]*)\}/g;
  for (const [, selectors, body] of source.matchAll(block)) {
    const tokens = Object.fromEntries([...body!.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
    for (const [, id] of selectors!.matchAll(/\[data-theme='([a-z-]+)'\]/g)) result.set(id!, tokens);
  }
  return result;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TOKENS = ['canvas', 'surface', 'subtle', 'line', 'fg', 'fg-soft', 'muted', 'accent', 'on-accent', 'accent-soft', 'accent-ink', 'code', 'scrim', 'danger', 'on-danger'];

/** [foreground, background, minimum ratio] — WCAG AA: 4.5 for text, 3 for UI components. */
const PAIRS: [string, string, number][] = [
  ['fg', 'canvas', 7],
  ['fg', 'surface', 7],
  ['fg-soft', 'canvas', 4.5],
  ['fg-soft', 'surface', 4.5],
  ['muted', 'canvas', 4.5],
  ['muted', 'surface', 4.5],
  ['muted', 'subtle', 4.5],
  ['accent-ink', 'canvas', 4.5],
  ['accent-ink', 'surface', 4.5],
  ['accent-ink', 'accent-soft', 4.5],
  ['fg', 'accent-soft', 4.5],
  ['fg-soft', 'accent-soft', 4.5],
  ['fg-soft', 'subtle', 4.5],
  ['on-accent', 'accent', 4.5],
  ['accent', 'canvas', 3],
  ['accent', 'surface', 3],
  ['fg', 'code', 7],
  ['danger', 'canvas', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'subtle', 4.5],
  ['on-danger', 'danger', 4.5],
];

const themes = parseThemes(css);

describe('themes', () => {
  it('defines every theme listed in themes.ts, and nothing else', () => {
    expect([...themes.keys()].sort()).toEqual(THEMES.map((t) => t.id).sort());
  });

  describe.each(THEMES.map((t) => t.id))('%s', (id) => {
    const tokens = themes.get(id)!;

    it('defines every token as a solid 6-digit hex colour', () => {
      expect(Object.keys(tokens).sort()).toEqual([...TOKENS].sort());
    });

    it.each(PAIRS)('%s on %s ≥ %s:1', (fg, bg, min) => {
      expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(min);
    });
  });
});
