import type { ProgressData, ProgressStore } from './types';

export const PROGRESS_STORAGE_KEY = 'levelup:progress';

/** ProgressStore backed by window.localStorage. Synced across tabs via the `storage` event. */
export class LocalStorageProgressStore implements ProgressStore {
  constructor(private readonly key = PROGRESS_STORAGE_KEY) {}

  peek(): unknown {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null; // blocked storage or corrupt JSON: start empty rather than crash
    }
  }

  async load(): Promise<unknown> {
    return this.peek();
  }

  async save(data: ProgressData): Promise<void> {
    // Throws on quota exceeded / blocked storage; the controller reports it.
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  watch(onChange: () => void): () => void {
    const listener = (e: StorageEvent) => {
      if (e.key === this.key || e.key === null) onChange();
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }
}
