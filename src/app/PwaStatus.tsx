import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { versionLabel } from '@/lib/version';

const UPDATE_CHECK_MS = 60 * 60 * 1000; // People leave a study tab open for days; look for new versions hourly…
const FOCUS_CHECK_MS = 60 * 1000; // …and whenever the tab comes back into view, at most once a minute.
const OFFLINE_READY_MS = 6000;

export type UpdateCheck = 'unsupported' | 'found' | 'none';

type Pwa = {
  offlineReady: boolean;
  dismissOfflineReady: () => void;
  /** A new version is installed and waiting; reloading switches to it. */
  needRefresh: boolean;
  /** Activates the waiting version and reloads the page. */
  reload: () => void;
  /** A service worker is registered, so checkForUpdates can ask for a new version (false in dev and unsupported browsers). */
  canCheck: boolean;
  /** Asks the server for a new version now. */
  checkForUpdates: () => Promise<UpdateCheck>;
};

const PwaContext = createContext<Pwa>({
  offlineReady: false,
  dismissOfflineReady: () => {},
  needRefresh: false,
  reload: () => {},
  canCheck: false,
  checkForUpdates: async () => 'unsupported',
});

export const usePwa = () => useContext(PwaContext);

/** Registers the service worker once and shares its update state with the toast and the sidebar footer. */
export function PwaProvider({ children }: { children: ReactNode }) {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [canCheck, setCanCheck] = useState(false);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      setCanCheck(true);
      let lastCheck = Date.now();
      const check = (minGap: number) => {
        if (!navigator.onLine || registration.installing || Date.now() - lastCheck < minGap) return;
        lastCheck = Date.now();
        void registration.update();
      };
      setInterval(() => check(0), UPDATE_CHECK_MS);
      const onVisible = () => document.visibilityState === 'visible' && check(FOCUS_CHECK_MS);
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
    },
  });

  const checkForUpdates = useCallback(async (): Promise<UpdateCheck> => {
    const registration = registrationRef.current;
    if (!registration) return 'unsupported';
    await registration.update();
    return registration.installing || registration.waiting ? 'found' : 'none';
  }, []);

  // vite-plugin-pwa reloads on workbox's "controlling" event, which never fires for updates workbox-window calls
  // external (any found after the first install or a minute after load), so Reload swapped the worker but kept the
  // old page. Reload ourselves once the new worker takes control.
  const reload = useCallback(() => {
    const registration = registrationRef.current;
    // Another tab already activated it: only this page is stale.
    if (registration && !registration.waiting) return window.location.reload();
    let reloaded = false;
    const go = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', go, { once: true });
    // A page the old worker never controlled gets no controllerchange.
    if (registration) setTimeout(go, 3000);
    void updateServiceWorker(true);
  }, [updateServiceWorker]);

  const value = useMemo<Pwa>(
    () => ({
      offlineReady,
      dismissOfflineReady: () => setOfflineReady(false),
      needRefresh,
      reload,
      canCheck,
      checkForUpdates,
    }),
    [offlineReady, setOfflineReady, needRefresh, reload, canCheck, checkForUpdates],
  );
  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

/** "Ready offline" and "new version" toasts. "Later" only hides the toast; the sidebar footer keeps a Reload button. */
export function PwaToasts() {
  const { offlineReady, dismissOfflineReady, needRefresh, reload } = usePwa();
  const [laterClicked, setLaterClicked] = useState(false);

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(dismissOfflineReady, OFFLINE_READY_MS);
    return () => clearTimeout(t);
  }, [offlineReady, dismissOfflineReady]);

  const showUpdate = needRefresh && !laterClicked;
  if (!showUpdate && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md animate-slide-in items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg sm:right-6 sm:left-auto sm:mx-0"
    >
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-fg">{showUpdate ? 'A new version of LevelUp is available.' : 'LevelUp is ready to use offline.'}</p>
        {showUpdate && <p className="mt-0.5 text-xs text-muted">You're on {versionLabel}. Reload to update.</p>}
      </div>
      {showUpdate && (
        <button
          type="button"
          onClick={reload}
          className="inline-flex h-9 shrink-0 items-center rounded-lg bg-accent px-3 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          Reload
        </button>
      )}
      <button
        type="button"
        onClick={() => (showUpdate ? setLaterClicked(true) : dismissOfflineReady())}
        className="inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-fg-soft transition-colors hover:bg-subtle"
      >
        {showUpdate ? 'Later' : 'Dismiss'}
      </button>
    </div>
  );
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

/** Small header badge shown while the browser reports no connection. */
export function OfflineBadge() {
  const online = useOnline();
  if (online) return null;
  return (
    <span
      title="You're offline. Topics, progress and reviews still work; new diagrams need a connection the first time."
      className="inline-flex h-7 animate-pop-in items-center gap-1.5 rounded-full border border-line bg-subtle px-2.5 text-xs font-medium text-fg-soft"
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-muted" />
      Offline
    </span>
  );
}
