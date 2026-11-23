import { useSyncExternalStore } from 'react';
import { notesApi } from './client';
import type { NoteSummary } from './types';

/**
 * Notes state shared by the sidebar's Notes menu and the Notes page, so a note created or
 * renamed on the page shows up in the sidebar straight away.
 */
export interface NotesState {
  /** idle: not asked yet. unavailable: offline, or the API isn't reachable. */
  status: 'idle' | 'loading' | 'locked' | 'ready' | 'unavailable';
  /** Every note, most recently edited first. */
  notes: NoteSummary[];
}

let state: NotesState = { status: 'idle', notes: [] };
const listeners = new Set<() => void>();

const byUpdated = (a: NoteSummary, b: NoteSummary) => b.updatedAt.localeCompare(a.updatedAt);

function set(next: Partial<NotesState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export const notesStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Checks the session and loads the list. Never throws. */
  async refresh() {
    if (state.status === 'idle') set({ status: 'loading' });
    try {
      if (!(await notesApi.session())) return set({ status: 'locked', notes: [] });
      set({ status: 'ready', notes: (await notesApi.list()).sort(byUpdated) });
    } catch {
      set({ status: state.status === 'ready' ? 'ready' : 'unavailable' });
    }
  },

  /** The page loaded the full (unfiltered) list. */
  loaded(notes: NoteSummary[]) {
    set({ status: 'ready', notes: [...notes].sort(byUpdated) });
  },

  upsert(patch: Partial<NoteSummary> & { id: string }) {
    const existing = state.notes.find((n) => n.id === patch.id);
    const notes = existing
      ? state.notes.map((n) => (n.id === patch.id ? { ...n, ...patch } : n))
      : [{ title: '', snippet: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), attachmentCount: 0, ...patch }, ...state.notes];
    set({ notes: notes.sort(byUpdated) });
  },

  remove(id: string) {
    set({ notes: state.notes.filter((n) => n.id !== id) });
  },

  locked() {
    set({ status: 'locked', notes: [] });
  },

  /** Test hook. */
  reset() {
    state = { status: 'idle', notes: [] };
  },
};

export const useNotesState = () => useSyncExternalStore(notesStore.subscribe, notesStore.get);
