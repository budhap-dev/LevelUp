import { ProgressController } from './controller';
import { LocalStorageProgressStore, PROGRESS_STORAGE_KEY } from './local-storage-store';
import { ProgressFormatError, mergeProgress, normaliseProgress } from './normalise';
import { emptyProgress, type ProgressData, type ProgressStore } from './types';

/** In-memory backend with a controllable clock. */
class MemoryStore implements ProgressStore {
  saved: ProgressData | null = null;
  saves = 0;
  constructor(private initial: unknown = null) {}
  peek() {
    return this.initial;
  }
  async load() {
    return this.initial;
  }
  async save(data: ProgressData) {
    this.saves += 1;
    this.saved = structuredClone(data);
  }
}

function clock(start = '2026-11-19T10:00:00.000Z') {
  let t = Date.parse(start);
  const now = () => new Date(t);
  now.advance = (ms: number) => (t += ms);
  return now;
}

describe('normaliseProgress', () => {
  it('keeps valid entries, drops invalid ones and counts them', () => {
    const { data, dropped } = normaliseProgress({
      schemaVersion: 1,
      topics: {
        caching: { state: 'learned', updatedAt: '2026-11-01T00:00:00Z', lastSectionId: 'tldr' },
        bad: { state: 'mastered', updatedAt: '2026-11-01T00:00:00Z' },
      },
      bookmarks: {
        caching: { topicId: 'caching', label: 'Caching', createdAt: '2026-11-01T00:00:00Z' },
        'caching#q-x': { topicId: 'caching', anchor: 'q-x', label: 'Q', createdAt: '2026-11-01T00:00:00Z' },
        mismatched: { topicId: 'other', label: 'x', createdAt: '2026-11-01T00:00:00Z' },
      },
      notes: { caching: { body: 'hello', updatedAt: 'not a date' } },
    });
    expect(Object.keys(data.topics)).toEqual(['caching']);
    expect(Object.keys(data.bookmarks)).toEqual(['caching', 'caching#q-x']);
    expect(data.notes).toEqual({});
    expect(dropped).toBe(3);
  });

  it('accepts the export wrapper', () => {
    const { data } = normaliseProgress({ app: 'levelup-engineer', exportedAt: 'x', data: { schemaVersion: 1, topics: {} } });
    expect(data).toEqual(emptyProgress());
  });

  it('rejects unrelated files and files from newer versions', () => {
    expect(() => normaliseProgress([1, 2])).toThrow(ProgressFormatError);
    expect(() => normaliseProgress({ name: 'package.json' })).toThrow(/Not a LevelUp progress file/);
    expect(() => normaliseProgress({ schemaVersion: 99, topics: {} })).toThrow(/newer version/);
  });
});

describe('mergeProgress', () => {
  it('keeps the most recently changed entry on each side, and the latest visit', () => {
    const a: ProgressData = {
      ...emptyProgress(),
      topics: { t: { state: 'learned', updatedAt: '2026-11-02T00:00:00Z', lastVisitedAt: '2026-11-01T00:00:00Z' } },
      notes: { t: { body: 'old', updatedAt: '2026-11-01T00:00:00Z' } },
      bookmarks: { t: { id: 't', topicId: 't', label: 'T', createdAt: '2026-11-01T00:00:00Z' } },
    };
    const b: ProgressData = {
      ...emptyProgress(),
      topics: { t: { state: 'needs-revision', updatedAt: '2026-11-01T00:00:00Z', lastVisitedAt: '2026-11-05T00:00:00Z', lastSectionId: 'scenario' } },
      notes: { t: { body: 'new', updatedAt: '2026-11-03T00:00:00Z' } },
      bookmarks: { u: { id: 'u', topicId: 'u', label: 'U', createdAt: '2026-11-01T00:00:00Z' } },
    };
    const merged = mergeProgress(a, b);
    expect(merged.topics.t).toEqual({ state: 'learned', updatedAt: '2026-11-02T00:00:00Z', lastVisitedAt: '2026-11-05T00:00:00Z', lastSectionId: 'scenario' });
    expect(merged.notes.t?.body).toBe('new');
    expect(Object.keys(merged.bookmarks).sort()).toEqual(['t', 'u']);
  });
});

describe('ProgressController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('marks a topic in progress on first visit and does not downgrade a learned topic', () => {
    const c = new ProgressController(new MemoryStore(), clock());
    c.recordVisit('caching', 'tldr');
    expect(c.getSnapshot().topics.caching).toMatchObject({ state: 'in-progress', lastSectionId: 'tldr' });
    c.setTopicState('caching', 'learned');
    c.recordVisit('caching', 'scenario');
    expect(c.getSnapshot().topics.caching).toMatchObject({ state: 'learned', lastSectionId: 'scenario' });
  });

  it('batches saves and reports the status', async () => {
    const store = new MemoryStore();
    const c = new ProgressController(store, clock());
    c.setTopicState('a', 'learned');
    c.saveNote('a', 'note');
    expect(c.getStatus().state).toBe('pending');
    await vi.advanceTimersByTimeAsync(400);
    expect(store.saves).toBe(1);
    expect(store.saved?.notes.a?.body).toBe('note');
    expect(c.getStatus()).toMatchObject({ state: 'saved' });
  });

  it('reports a failed save', async () => {
    const store = new MemoryStore();
    store.save = async () => {
      throw new Error('QuotaExceededError');
    };
    const c = new ProgressController(store, clock());
    c.setTopicState('a', 'learned');
    await c.flush();
    expect(c.getStatus()).toEqual({ state: 'error', error: 'QuotaExceededError' });
  });

  it('only creates a new snapshot when something changed', () => {
    const c = new ProgressController(new MemoryStore(), clock());
    c.setTopicState('a', 'learned');
    const before = c.getSnapshot();
    c.setTopicState('a', 'learned');
    c.saveNote('a', '');
    c.removeBookmark('missing');
    expect(c.getSnapshot()).toBe(before);
  });

  it('toggles bookmarks and deletes empty notes', () => {
    const c = new ProgressController(new MemoryStore(), clock());
    expect(c.toggleBookmark({ topicId: 'caching', anchor: 'q-x', label: 'Q' })).toBe(true);
    expect(c.getSnapshot().bookmarks['caching#q-x']).toMatchObject({ topicId: 'caching', anchor: 'q-x', label: 'Q' });
    expect(c.toggleBookmark({ topicId: 'caching', anchor: 'q-x', label: 'Q' })).toBe(false);
    expect(c.getSnapshot().bookmarks).toEqual({});
    c.saveNote('caching', 'text');
    c.saveNote('caching', '   ');
    expect(c.getSnapshot().notes).toEqual({});
  });

  it('round-trips: export → reset → import gives identical data', () => {
    const now = clock();
    const c = new ProgressController(new MemoryStore(), now);
    c.recordVisit('caching', 'trade-offs');
    now.advance(1000);
    c.setTopicState('typescript', 'needs-revision');
    c.toggleBookmark({ topicId: 'caching', anchor: 'q-cache-stampede', label: 'What is a cache stampede?' });
    c.saveNote('caching', 'Remember: delete, do not update.');
    const before = structuredClone(c.getSnapshot());

    const json = c.exportJson();
    c.reset();
    expect(c.getSnapshot()).toEqual(emptyProgress());

    const { data, dropped } = c.previewImport(json);
    expect(dropped).toBe(0);
    c.applyImport(data, 'replace');
    expect(c.getSnapshot()).toEqual(before);
  });

  it('rejects invalid JSON on import', () => {
    const c = new ProgressController(new MemoryStore(), clock());
    expect(() => c.previewImport('{nope')).toThrow(/not valid JSON/);
  });

  it('starts empty when stored data is corrupt', () => {
    const c = new ProgressController(new MemoryStore('garbage'), clock());
    expect(c.getSnapshot()).toEqual(emptyProgress());
  });
});

describe('LocalStorageProgressStore', () => {
  beforeEach(() => localStorage.clear());

  it('persists and reloads through localStorage', async () => {
    const store = new LocalStorageProgressStore();
    const c = new ProgressController(store);
    c.setTopicState('caching', 'learned');
    await c.flush();
    expect(JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY)!).topics.caching.state).toBe('learned');
    expect(new ProgressController(new LocalStorageProgressStore()).getSnapshot().topics.caching?.state).toBe('learned');
  });

  it('survives corrupt JSON in storage', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{oops');
    expect(new ProgressController(new LocalStorageProgressStore()).getSnapshot()).toEqual(emptyProgress());
  });
});
