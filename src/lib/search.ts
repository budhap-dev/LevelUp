/**
 * Global search over topics, sections, interview questions and cheat-sheet cards.
 * The index (src/generated/search.json) and Fuse.js are loaded on first use.
 */
import type { FuseResult, FuseResultMatch, IFuseOptions } from 'fuse.js';
import type { SearchKind, SearchRecord } from './content/schema';

const indexLoader = import.meta.glob<SearchRecord[]>('/src/generated/search.json', { import: 'default' });

export interface SearchHit {
  record: SearchRecord;
  score: number;
  /** [start, end] inclusive ranges in record.title to highlight. */
  titleRanges: [number, number][];
}

export interface SearchEngine {
  records: SearchRecord[];
  search(query: string, limit?: number): SearchHit[];
}

const OPTIONS: IFuseOptions<SearchRecord> = {
  keys: [
    { name: 'title', weight: 0.55 },
    { name: 'text', weight: 0.2 },
    { name: 'tags', weight: 0.15 },
    { name: 'topicTitle', weight: 0.1 },
  ],
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true, // match anywhere in long text
  threshold: 0.32,
  minMatchCharLength: 2,
};

/** Fuse scores are 0 (perfect) … 1; nudge topics and questions above sections and cards on ties. */
const KIND_FACTOR: Record<SearchKind, number> = { topic: 0.8, question: 0.9, section: 1, cheat: 1 };

function titleRanges(matches: readonly FuseResultMatch[] | undefined): [number, number][] {
  const ranges = matches?.filter((m) => m.key === 'title').flatMap((m) => m.indices) ?? [];
  // Ignore single-character fuzzy hits; they make highlights noisy.
  return ranges.filter(([start, end]) => end - start >= 1).map(([s, e]) => [s, e]);
}

let engine: Promise<SearchEngine> | null = null;

export function loadSearch(): Promise<SearchEngine> {
  return (engine ??= (async () => {
    const load = Object.values(indexLoader)[0];
    if (!load) throw new Error('Search index missing. Run "npm run content".');
    const [{ default: Fuse }, records] = await Promise.all([import('fuse.js'), load()]);
    const fuse = new Fuse(records, OPTIONS);

    return {
      records,
      search(query, limit = 40) {
        const q = query.trim();
        if (q.length < 2) return [];
        return fuse
          .search(q, { limit: limit * 2 })
          .map((r: FuseResult<SearchRecord>) => ({
            record: r.item,
            score: (r.score ?? 1) * KIND_FACTOR[r.item.kind],
            titleRanges: titleRanges(r.matches),
          }))
          .sort((a, b) => a.score - b.score)
          .slice(0, limit);
      },
    };
  })());
}

/** Split text into plain and highlighted parts for rendering. */
export function highlight(text: string, ranges: [number, number][]): { text: string; match: boolean }[] {
  if (ranges.length === 0) return [{ text, match: false }];
  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    if (start < cursor) continue;
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
    parts.push({ text: text.slice(start, end + 1), match: true });
    cursor = end + 1;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}

export const hrefFor = (r: SearchRecord) => `/topics/${r.topicId}${r.anchor ? `#${r.anchor}` : ''}`;
