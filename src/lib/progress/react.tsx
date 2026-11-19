import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ProgressController } from './controller';
import { LocalStorageProgressStore } from './local-storage-store';
import type { ProgressData, ProgressStore } from './types';

const ProgressContext = createContext<ProgressController | null>(null);

/** Provides progress state. Pass a different `store` to swap the backend (e.g. an API, or a fake in tests). */
export function ProgressProvider({ store, children }: { store?: ProgressStore; children: ReactNode }) {
  const [controller] = useState(() => new ProgressController(store ?? new LocalStorageProgressStore()));

  useEffect(() => {
    // Save immediately when the page is hidden or closed, instead of waiting for the debounce.
    const flush = () => void controller.flush();
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush(); // don't drop changes still waiting for the save debounce
    };
  }, [controller]);

  return <ProgressContext.Provider value={controller}>{children}</ProgressContext.Provider>;
}

export function useProgressController(): ProgressController {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgressController must be used inside <ProgressProvider>');
  return ctx;
}

/**
 * Subscribe to a slice of progress. The selector must return existing objects from the
 * snapshot (or primitives), not new arrays/objects, so unchanged slices don't re-render.
 */
export function useProgress<T>(selector: (data: ProgressData) => T): T {
  const c = useProgressController();
  return useSyncExternalStore(c.subscribe, () => selector(c.getSnapshot()), () => selector(c.getSnapshot()));
}

export function useSaveStatus() {
  const c = useProgressController();
  return useSyncExternalStore(c.subscribe, c.getStatus, c.getStatus);
}
