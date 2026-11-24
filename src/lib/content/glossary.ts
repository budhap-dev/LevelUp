import type { GlossaryEntry } from './schema';

/** The glossary is a separate chunk (src/generated/glossary.json), loaded the first time it's needed. */
const loader = import.meta.glob<GlossaryEntry[]>('/src/generated/glossary.json', { import: 'default' });

let cache: Promise<GlossaryEntry[]> | undefined;

export function loadGlossary(): Promise<GlossaryEntry[]> {
  const load = Object.values(loader)[0];
  return (cache ??= load ? load() : Promise.resolve([]));
}
