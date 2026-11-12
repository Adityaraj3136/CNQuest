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

/** Marks that this tab has already been told about a pending update. */
const UPDATE_NOTICE_KEY = 'cn-quest.update-notified';

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

/** How often an open app asks the server for a newer build. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** How long to wait for a just-found update to finish downloading. */
const INSTALL_WAIT_MS = 20_000;

/** The build this copy of the app came from, shown in Settings so a phone can be checked. */
export const BUILD_ID = __APP_BUILD__;

export async function applyUpdate(): Promise<void> {
  await updateServiceWorker?.(true);
}

export type UpdateResult = 'updating' | 'current' | 'unsupported';

/** Resolves with the new worker once it has downloaded, or null if it fails or takes too long. */
function waitForInstall(registration: ServiceWorkerRegistration): Promise<ServiceWorker | null> {
  const worker = registration.installing;
  if (!worker) return Promise.resolve(registration.waiting);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(registration.waiting), INSTALL_WAIT_MS);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' || worker.state === 'redundant') {
        window.clearTimeout(timer);
        resolve(worker.state === 'installed' ? worker : null);
      }
    });
  });
}

/**
 * Asks the server for a newer build now instead of waiting for the next visit. When one is
 * found it is activated and the page reloads into it. Progress lives in localStorage and
 * Firestore, never in the service worker's cache, so nothing is lost.
 */
export async function checkForUpdate(): Promise<UpdateResult> {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return 'unsupported';

  await registration.update();
  const waiting = registration.waiting ?? (await waitForInstall(registration));
  if (!waiting) return 'current';

  if (updateServiceWorker) {
    await updateServiceWorker(true); // tells the new worker to take over, then reloads
  } else {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  return 'updating';
}

/**
 * Last resort for a device stuck on an old version: removes the service worker and every
 * cached app file, then reloads from the network. Sign-in (IndexedDB) and progress
 * (localStorage, Firestore) are untouched; only downloadable files are thrown away.
 */
export async function repairOfflineCopy(): Promise<void> {
  const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  window.location.reload();
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

// ---------------------------------------------------------------- exit guard

/**
 * In the installed app, the system back button on the first screen closes the app, which is
 * easy to do by accident mid-revision. The launch entry is marked and a guard entry pushed
 * above it; arriving back on the marked entry means the next back would exit, so it asks.
 * Declining restores the screen the student was on. Browser tabs keep normal back behaviour.
 */
export function initExitGuard(currentHash: () => string): void {
  if (!isInstalled()) return;
  history.replaceState({ cnRoot: true }, '', window.location.href);
  history.pushState({ cnGuard: true }, '', window.location.href);

  window.addEventListener('popstate', (event) => {
    if (!(event.state as { cnRoot?: boolean } | null)?.cnRoot) return;
    if (window.confirm('Exit CN Quest?')) {
      history.back(); // leave from the launch entry: the app closes
      return;
    }
    history.pushState({ cnGuard: true }, '', currentHash() || window.location.href);
  });
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
      // The worker re-checks for updates on every navigation, so an unreloaded update
      // re-fired this toast on every screen change. Once per session is a notice; on every
      // page view it is nagging, and students learn to dismiss it without reading.
      if (sessionStorage.getItem(UPDATE_NOTICE_KEY)) return;
      sessionStorage.setItem(UPDATE_NOTICE_KEY, '1');

      showToast('A new version is ready. Reopen the app, or go to Settings → Check for updates. Your progress is safe.', {
        title: 'Update available',
        variant: 'info',
        durationMs: 0,
      });
    },
    onRegisteredSW(_url: string, registration: ServiceWorkerRegistration | undefined) {
      if (!registration) return;
      // An installed app can stay open for days. Without these checks it would only learn
      // about a new build when fully closed and reopened, which is why phones lagged behind.
      const check = (): void => {
        if (navigator.onLine) void registration.update().catch(() => {});
      };
      window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
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
