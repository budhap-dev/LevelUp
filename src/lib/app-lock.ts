/**
 * The deployed app sits behind the passphrase gate (middleware.ts + api/_lib/gate.ts). The PWA's service
 * worker would otherwise keep serving the cached app to a browser whose session has ended, so locking, or
 * finding the session gone on start-up, also drops the offline copy and reloads into the unlock page.
 * Dev (`npm run dev`) has no gate, so this only acts in production builds.
 */
import { notesApi } from './notes/client';

const GATED = import.meta.env.PROD;
const RELOAD_GUARD = 'levelup:gate-reload';

async function dropOfflineCopy() {
  if ('serviceWorker' in navigator) {
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
  }
  if ('caches' in window) {
    for (const key of await caches.keys()) await caches.delete(key);
  }
}

/** Sign this browser out of the whole app (and Notes). */
export async function lockApp() {
  await notesApi.lock().catch(() => undefined);
  if (!GATED) return;
  await dropOfflineCopy().catch(() => undefined);
  window.location.replace('/');
}

/**
 * Called once on start-up. Offline, the cached app keeps working: this browser was unlocked to install it.
 * Online with no valid session (expired, or locked on another tab), go to the unlock page.
 */
export async function enforceAppSession() {
  if (!GATED || navigator.onLine === false) return;
  const res = await fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
  try {
    if (res?.ok) return sessionStorage.removeItem(RELOAD_GUARD);
    if (res?.status !== 401 || sessionStorage.getItem(RELOAD_GUARD)) return; // never loop if the gate isn't deployed
    sessionStorage.setItem(RELOAD_GUARD, '1');
  } catch {
    return; // no sessionStorage: can't guard against a reload loop, so don't reload
  }
  await dropOfflineCopy().catch(() => undefined);
  window.location.reload();
}
