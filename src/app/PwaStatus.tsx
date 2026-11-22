import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_MS = 60 * 60 * 1000; // People leave a study tab open for days; look for new versions hourly.
const OFFLINE_READY_MS = 6000;

/** Registers the service worker and shows "ready offline" and "update available" toasts. */
export function PwaToasts() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine && registration.installing == null) void registration.update();
      }, UPDATE_CHECK_MS);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), OFFLINE_READY_MS);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md animate-slide-in items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg sm:right-6 sm:left-auto sm:mx-0"
    >
      <p className="min-w-0 flex-1 text-sm text-fg">
        {needRefresh ? 'A new version of LevelUp is available.' : 'LevelUp is ready to use offline.'}
      </p>
      {needRefresh && (
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="inline-flex h-9 shrink-0 items-center rounded-lg bg-accent px-3 text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
        >
          Reload
        </button>
      )}
      <button
        type="button"
        onClick={() => (needRefresh ? setNeedRefresh(false) : setOfflineReady(false))}
        className="inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-fg-soft transition-colors hover:bg-subtle"
      >
        {needRefresh ? 'Later' : 'Dismiss'}
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
