import { useSyncExternalStore } from 'react';

/**
 * "Install app" support. Chromium browsers (Android, desktop) fire `beforeinstallprompt` once the app is
 * installable; we keep the event so a button can show the native prompt later. iOS has no prompt: people
 * install from the Share menu, so we show instructions instead.
 *
 * The listener is attached when this module loads (with PwaStatus, at startup), because the event can fire
 * before React mounts and is not repeated.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** installed: running as an installed app. prompt: native prompt available. ios: show Share-menu instructions. */
export type InstallState = 'installed' | 'prompt' | 'ios' | 'unavailable';

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function isStandalone() {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** iPhone, iPod and iPad (iPadOS reports itself as a Mac, but with touch). */
export function isIos(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints) {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Keep the browser's mini-infobar away; the sidebar button offers it instead.
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function getState(): InstallState {
  if (installed || isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIos()) return 'ios';
  return 'unavailable';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Shows the native install prompt; resolves true when the user accepts. The event can be used only once. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  emit();
  return outcome === 'accepted';
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getState, () => 'unavailable');
}
