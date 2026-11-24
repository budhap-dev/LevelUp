import { highlight, hrefFor, loadSearch } from './search';

describe('search', () => {
  it('finds an interview question by its wording and links to its anchor', async () => {
    const engine = await loadSearch();
    // The glossary term of the same name may rank first; the question must still be found.
    const top = engine.search('cache stampede').find((h) => h.record.kind === 'question');
    expect(top?.record.kind).toBe('question');
    expect(top?.record.topicId).toBe('caching');
    expect(hrefFor(top!.record)).toBe('/topics/caching#q-cache-stampede');
    expect(top?.titleRanges.length).toBeGreaterThan(0);
  });

  it('finds glossary terms and links them to the glossary page', async () => {
    const engine = await loadSearch();
    const hit = engine.search('idempotency').find((h) => h.record.kind === 'glossary');
    expect(hit).toBeDefined();
    expect(hrefFor(hit!.record)).toBe('/glossary#idempotency');
  });

  it('ranks the topic near the top for its name and tolerates typos', async () => {
    const engine = await loadSearch();
    const top3 = engine.search('observabilty').slice(0, 3).map((h) => h.record);
    expect(top3).toContainEqual(expect.objectContaining({ kind: 'topic', topicId: 'observability-sre' }));
  });

  it('matches tags and stub topics', async () => {
    const engine = await loadSearch();
    expect(engine.search('kafka').some((h) => h.record.topicId === 'messaging-event-streaming')).toBe(true);
    expect(engine.search('Kubernetes').some((h) => h.record.kind === 'topic' && h.record.topicId === 'docker-kubernetes')).toBe(true);
  });

  it('ignores queries shorter than two characters', async () => {
    const engine = await loadSearch();
    expect(engine.search(' a ')).toEqual([]);
  });

  it('splits text into highlighted parts', () => {
    expect(highlight('Cache stampede', [[6, 13]])).toEqual([
      { text: 'Cache ', match: false },
      { text: 'stampede', match: true },
    ]);
  });
});
