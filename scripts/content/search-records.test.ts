// @vitest-environment node
import { buildTopic } from './build-topic.ts';
import { Diagnostics } from './diagnostics.ts';
import { htmlToText } from './search-records.ts';

const source = `---
id: caching
title: Caching
group: data
tags: [perf, redis]
level: Senior
estimatedMinutes: 30
lastReviewed: 2026-11-19
status: draft
---
## TL;DR
- Caches trade **freshness** for speed.
- Second point.

## Core Concepts
Intro paragraph.

### Cache aside
Read the cache, then the DB.

\`\`\`ts
const secret = 'code is not indexed';
\`\`\`

## Interview Questions
### What is a stampede? {#stampede}
**Level:** Senior

**Model answer:** Many misses at once &amp; the DB falls over.

**What the interviewer is looking for:** Coalescing.

## Cheat Sheet
- **TTL** — time to live.
`;

describe('search records', () => {
  it('indexes the topic, sections, sub-headings, questions and cheat cards with anchors', async () => {
    const topic = await buildTopic({ file: 'data/caching.md', source }, new Diagnostics());
    const byKind = (k: string) => topic!.search.filter((r) => r.kind === k);

    expect(byKind('topic')).toEqual([
      expect.objectContaining({ id: 'caching', title: 'Caching', text: 'Caches trade freshness for speed. Second point.', tags: ['perf', 'redis'] }),
    ]);
    expect(byKind('section').map((r) => [r.title, r.anchor, r.text])).toEqual([
      ['Core Concepts', 'core-concepts', 'Intro paragraph.'],
      ['Cache aside', 'cache-aside', 'Read the cache, then the DB.'],
    ]);
    expect(byKind('question')).toEqual([
      expect.objectContaining({ title: 'What is a stampede?', anchor: 'q-stampede', level: 'Senior', text: 'Many misses at once & the DB falls over.' }),
    ]);
    expect(byKind('cheat')).toEqual([expect.objectContaining({ title: 'TTL', text: 'time to live.', anchor: 'cheat-sheet' })]);
    expect(JSON.stringify(topic!.search)).not.toContain('code is not indexed');
    expect(new Set(topic!.search.map((r) => r.id)).size).toBe(topic!.search.length);
  });

  it('converts generated HTML to text', () => {
    expect(htmlToText('<p>a &lt;b&gt; <code>c</code> &#x26; d&#38;e</p><pre><code>x</code></pre>')).toBe('a <b> c & d&e');
  });
});
