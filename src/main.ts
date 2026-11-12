/** Application entry point: styles, session bootstrap, router boot, connectivity watcher. */

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@/styles/variables.css';
import '@/styles/global.css';
import '@/styles/components.css';
import '@fontsource/russo-one/latin-400.css';
import '@fontsource/share-tech-mono/latin-400.css';
import '@/styles/theme/index.css';

import { Router } from '@/router';
import { routes } from '@/routes';
import { watchConnectivity } from '@/components/footer';
import { startUserStateSync } from '@/services/user-state.store';
import { applyPreferences } from '@/state/preferences';
import { initPwa } from '@/pwa/pwa';
import { isFirebaseConfigured, missingFirebaseKeys } from '@/config/firebase';
import { getSession, initSession, isAuthenticated, onSessionChange, sessionReady } from '@/state/session';

// Bootstrap's CSS is loaded, but no Bootstrap JS bundle is needed yet — the navbar
// toggle is a small custom control. Import the bundle only when a JS-driven
// Bootstrap component (modal, offcanvas) is actually used in a later phase.

function warnIfUnconfigured(): void {
  if (isFirebaseConfigured()) return;
  console.warn(
    '[CN Quest] Firebase is not configured yet. Copy .env.example to .env and fill in:\n  ' +
      missingFirebaseKeys().join('\n  ') +
      '\nPublic screens still run; sign-in and registration will report a clear error.',
  );
}

/**
 * Guarded routes wait for the initial auth state so first paint is never a false negative.
 * Guests may enter protected routes, but are not bounced off /login and /register —
 * that is how they upgrade to a real account.
 */
const router = new Router(
  routes,
  async () => {
    await sessionReady();
    return isAuthenticated();
  },
  async () => {
    await sessionReady();
    return getSession().user !== null;
  },
);

// Signing in or out changes which routes are legal, so re-resolve. A profile-only
// update (name, XP) just needs the navbar redrawn.
let lastIdentity = identityOf(getSession());
onSessionChange((session) => {
  const identity = identityOf(session);
  if (identity !== lastIdentity) {
    lastIdentity = identity;
    router.reload();
    return;
  }
  router.refreshChrome();
});

function identityOf(session: ReturnType<typeof getSession>): string {
  if (session.user) return `user:${session.user.uid}`;
  return session.isGuest ? 'guest' : 'anonymous';
}

applyPreferences();
watchConnectivity();
startUserStateSync();
warnIfUnconfigured();
initPwa();
void initSession();
router.start();
