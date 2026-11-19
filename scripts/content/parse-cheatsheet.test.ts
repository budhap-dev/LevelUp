// @vitest-environment node
import { parseMarkdown } from './markdown.ts';
import { parseCheatSheet } from './parse-cheatsheet.ts';

const parse = (md: string) => parseCheatSheet('topic', parseMarkdown(md).children);

describe('parseCheatSheet', () => {
  it('turns "**Front** — back" bullets into cards with all separator styles', async () => {
    const { flashcards, skipped } = await parse(`
### Patterns
- **Cache-aside** — app reads cache, then DB, then fills the \`cache\`.
- **Write-through**: write cache and DB together.
- **TTL** - time to live.
- **Front with colon:** back text
`);
    expect(skipped).toBe(0);
    expect(flashcards.map((c) => c.front)).toEqual(['Cache-aside', 'Write-through', 'TTL', 'Front with colon']);
    expect(flashcards[0]?.backHtml).toBe('app reads cache, then DB, then fills the <code>cache</code>.');
    expect(flashcards[0]?.id).toBe('fc-cache-aside');
    expect(flashcards[3]?.backHtml).toBe('back text');
  });

  it('skips bullets without the front/back shape', async () => {
    const { flashcards, skipped } = await parse(`
- Plain bullet
- **Bold**-ish word, no separator
- **Bold** with no separator either
`);
    expect(flashcards).toEqual([]);
    expect(skipped).toBe(3);
  });

  it('gives duplicate fronts unique ids', async () => {
    const { flashcards } = await parse(`- **X** — a\n- **X** — b\n`);
    expect(flashcards.map((c) => c.id)).toEqual(['fc-x', 'fc-x-1']);
  });
});
