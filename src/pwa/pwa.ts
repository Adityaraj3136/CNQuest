/**
 * PWA runtime: service-worker registration, update prompts, the install prompt and
 * reconnect-triggered syncing.
 *
 * All of it degrades silently — a browser without service workers or `beforeinstallprompt`
 * still gets a fully working app, just without offline caching or an install button.
 */

import { registerSW } from 'virtual:pwa-register';
import { showToast } from '@/components/toast';
import { pendingCount } from '@/services/sync-queue';

/** Chrome fires this instead of showing its own install UI, letting us place the button. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let updateServiceWorker: ((reload?: boolean) => Promise<void>) | null = null;
const installListeners = new Set<(available: boolean) => void>();

// ---------------------------------------------------------------- install

export function canInstall(): boolean {
  return deferredPrompt !== null;
}

/** True when the app is already running as an installed PWA. */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari reports installation this way rather than through display-mode.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function onInstallAvailabilityChange(listener: (available: boolean) => void): () => void {
  installListeners.add(listener);
  return () => installListeners.delete(listener);
}

function notifyInstallListeners(): void {
  installListeners.forEach((listener) => listener(canInstall()));
}

/** Shows the browser's install dialog. Returns true if the student accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  const event = deferredPrompt;
  // The event can only be used once, whatever the outcome.
  deferredPrompt = null;
  notifyInstallListeners();

  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === 'accepted';
  } catch (error) {
    console.error('[pwa] install prompt failed', error);
    return false;
  }
}

// ---------------------------------------------------------------- updates

export async function applyUpdate(): Promise<void> {
  await updateServiceWorker?.(true);
}

// ---------------------------------------------------------------- sync

/**
 * Replays queued offline results and tells the student what happened.
 *
 * The pipeline is imported dynamically: it pulls in the content bundle and Firestore, and
 * this module is loaded on the landing page where neither is needed.
 */
export async function syncNow(announce = true): Promise<void> {
  if (pendingCount() === 0) return;

  const { syncPendingResults } = await import('@/services/game-result.service');
  const { synced, remaining } = await syncPendingResults();

  if (announce && synced > 0) {
    showToast(
      `${synced} offline ${synced === 1 ? 'round' : 'rounds'} synced${remaining > 0 ? `, ${remaining} still pending` : ''}.`,
      { title: 'Progress synced', variant: 'success' },
    );
  }
}

// ---------------------------------------------------------------- bootstrap

/** Wires the service worker, install prompt and reconnect sync. Call once at start-up. */
export function initPwa(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // suppress the mini-infobar; Settings offers the button instead
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyInstallListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyInstallListeners();
    showToast('CN Quest is installed. It now opens like an app and works offline.', {
      title: 'Installed',
      variant: 'success',
    });
  });

  // Coming back online is the moment to flush anything played offline.
  window.addEventListener('online', () => void syncNow());

  updateServiceWorker = registerSW({
    onNeedRefresh() {
      showToast('A new version is ready. Reload to update — your progress is safe.', {
        title: 'Update available',
        variant: 'info',
        durationMs: 0,
      });
    },
    onOfflineReady() {
      console.info('[pwa] app shell cached — CN Quest now works offline');
    },
    onRegisterError(error: unknown) {
      console.error('[pwa] service worker registration failed', error);
    },
  });

  // Anything queued from a previous session syncs as soon as we know we are online.
  if (navigator.onLine) void syncNow(false);
}
