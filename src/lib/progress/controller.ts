/**
 * In-memory progress state the UI subscribes to (useSyncExternalStore), with debounced
 * persistence to a ProgressStore. Mutations are synchronous for the UI; saving is async.
 * Every mutation produces a new immutable snapshot, sharing unchanged branches.
 */
import { ProgressFormatError, mergeProgress, normaliseProgress, toExportJson } from './normalise';
import { emptyProgress, type Bookmark, type ProgressData, type ProgressStore, type TopicState } from './types';

export interface SaveStatus {
  state: 'idle' | 'pending' | 'saved' | 'error';
  savedAt?: string;
  error?: string;
}

const SAVE_DELAY_MS = 300;

export class ProgressController {
  private data: ProgressData;
  private status: SaveStatus = { state: 'idle' };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private changedSinceLoad = false;
  private unwatch: (() => void) | undefined;

  constructor(
    private readonly backend: ProgressStore,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.data = this.parseOrEmpty(backend.peek?.());
    if (!backend.peek) {
      void backend.load().then((raw) => {
        if (!this.changedSinceLoad) this.replaceSnapshot(this.parseOrEmpty(raw));
      });
    }
    this.unwatch = backend.watch?.(() => {
      void backend.load().then((raw) => this.replaceSnapshot(this.parseOrEmpty(raw)));
    });
  }

  private parseOrEmpty(raw: unknown): ProgressData {
    if (raw === null || raw === undefined) return emptyProgress();
    try {
      return normaliseProgress(raw).data;
    } catch {
      return emptyProgress();
    }
  }

  // ----- subscription (useSyncExternalStore) -----
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.data;
  getStatus = () => this.status;

  private emit() {
    for (const l of this.listeners) l();
  }
  private replaceSnapshot(data: ProgressData) {
    this.data = data;
    this.emit();
  }
  private setStatus(status: SaveStatus) {
    this.status = status;
    this.emit();
  }

  private update(fn: (d: ProgressData) => ProgressData) {
    const next = fn(this.data);
    if (next === this.data) return;
    this.changedSinceLoad = true;
    this.data = next;
    this.status = { ...this.status, state: 'pending' };
    this.emit();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), SAVE_DELAY_MS);
  }

  /** Persist now (also called on page hide so nothing is lost). */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.status.state !== 'pending') return;
    try {
      await this.backend.save(this.data);
      this.setStatus({ state: 'saved', savedAt: this.now().toISOString() });
    } catch (e) {
      this.setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }

  dispose() {
    clearTimeout(this.timer);
    this.unwatch?.();
    this.listeners.clear();
  }

  private stamp = () => this.now().toISOString();

  // ----- topic state -----
  setTopicState(topicId: string, state: TopicState) {
    this.update((d) => {
      const current = d.topics[topicId];
      if (current?.state === state) return d;
      return { ...d, topics: { ...d.topics, [topicId]: { ...current, state, updatedAt: this.stamp() } } };
    });
  }

  /** Record that the user is reading a topic (and which section). Starts "in progress" on first visit. */
  recordVisit(topicId: string, sectionId?: string) {
    this.update((d) => {
      const current = d.topics[topicId];
      const at = this.stamp();
      // Avoid churn: same section within a minute is not a new visit.
      if (current?.lastSectionId === sectionId && current?.lastVisitedAt && Date.parse(at) - Date.parse(current.lastVisitedAt) < 60_000) return d;
      const base = current ?? { state: 'in-progress' as const, updatedAt: at };
      const state = base.state === 'not-started' ? 'in-progress' : base.state;
      return {
        ...d,
        topics: {
          ...d.topics,
          [topicId]: { ...base, state, updatedAt: state !== base.state ? at : base.updatedAt, lastVisitedAt: at, ...(sectionId ? { lastSectionId: sectionId } : {}) },
        },
      };
    });
  }

  // ----- bookmarks -----
  toggleBookmark(target: { topicId: string; anchor?: string; label: string }): boolean {
    const id = target.anchor ? `${target.topicId}#${target.anchor}` : target.topicId;
    const adding = !this.data.bookmarks[id];
    this.update((d) => {
      const bookmarks = { ...d.bookmarks };
      if (adding) {
        const b: Bookmark = { id, topicId: target.topicId, ...(target.anchor && { anchor: target.anchor }), label: target.label, createdAt: this.stamp() };
        bookmarks[id] = b;
      } else {
        delete bookmarks[id];
      }
      return { ...d, bookmarks };
    });
    return adding;
  }

  removeBookmark(id: string) {
    this.update((d) => {
      if (!d.bookmarks[id]) return d;
      const { [id]: _removed, ...bookmarks } = d.bookmarks;
      return { ...d, bookmarks };
    });
  }

  // ----- notes -----
  saveNote(topicId: string, body: string) {
    this.update((d) => {
      const current = d.notes[topicId];
      if ((current?.body ?? '') === body) return d;
      if (!body.trim()) {
        const { [topicId]: _removed, ...notes } = d.notes;
        return { ...d, notes };
      }
      return { ...d, notes: { ...d.notes, [topicId]: { body, updatedAt: this.stamp() } } };
    });
  }

  // ----- backup -----
  exportJson(): string {
    return toExportJson(this.data, this.now());
  }

  /** Parse and validate without applying, so the UI can preview. Throws ProgressFormatError. */
  previewImport(json: string): { data: ProgressData; dropped: number } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new ProgressFormatError('The file is not valid JSON.');
    }
    return normaliseProgress(parsed);
  }

  applyImport(data: ProgressData, mode: 'merge' | 'replace') {
    this.update((d) => (mode === 'replace' ? data : mergeProgress(d, data)));
  }

  reset() {
    this.update(() => emptyProgress());
  }
}
