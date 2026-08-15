/**
 * Single source of truth for "who is signed in".
 *
 * Wraps Firebase's `onAuthStateChanged` so the router, navbar and pages read one
 * cached value instead of each subscribing to the SDK.
 */

import { getFirebaseAuth, isFirebaseConfigured } from '@/config/firebase';
import { ensureUserProfile } from '@/services/user.service';
import { endGuestSession, getGuestProfile, isGuestActive, startGuestSession } from '@/state/guest';

/** The stored guest profile, but only while a guest session is actually open. */
function activeGuestProfile(): UserProfile | null {
  return isGuestActive() ? getGuestProfile() : null;
}
import type { UserProfile } from '@/models/user';
import type { User } from 'firebase/auth';

export interface Session {
  /** The Firebase user, or null in guest mode. */
  user: User | null;
  profile: UserProfile | null;
  /** True when signed in locally as a guest rather than through Firebase. */
  isGuest: boolean;
  /** True once the first auth-state callback has been received. */
  ready: boolean;
}

let state: Session = { user: null, profile: null, isGuest: false, ready: false };
const listeners = new Set<(session: Session) => void>();
let readyPromise: Promise<void> | null = null;

function setState(next: Partial<Session>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
}

/** Falls back to the email local-part when a provider gives us no display name. */
function displayNameFor(user: User): string {
  return user.displayName?.trim() || user.email?.split('@')[0] || 'Student';
}

/**
 * Starts listening for auth changes. Resolves once the initial state is known,
 * so the router can make a correct guard decision on first paint.
 */
export function initSession(): Promise<void> {
  readyPromise ??= new Promise<void>((resolve) => {
    const guest = activeGuestProfile();

    if (!isFirebaseConfigured()) {
      // No backend yet: a stored guest profile is the whole session.
      setState({ user: null, profile: guest, isGuest: guest !== null, ready: true });
      resolve();
      return;
    }

    // Show the guest immediately; the Firebase callback below wins if a real user exists.
    if (guest) setState({ profile: guest, isGuest: true });

    void (async () => {
      const auth = await getFirebaseAuth();
      const { onAuthStateChanged } = await import('firebase/auth');

      // A student returning from Google's redirect flow arrives here with a pending
      // credential. Processing it before the listener attaches means the first auth callback
      // already carries the signed-in user, instead of reporting nobody and bouncing them
      // back to the login screen.
      const { completeGoogleRedirect } = await import('@/services/auth.service');
      await completeGoogleRedirect();

      onAuthStateChanged(
        auth,
        (user) => {
          void handleUser(user).finally(() => {
            setState({ ready: true });
            resolve();
          });
        },
        (error) => {
          console.error('[session] auth listener failed', error);
          const fallback = activeGuestProfile();
          setState({
            user: null,
            profile: fallback,
            isGuest: fallback !== null,
            ready: true,
          });
          resolve();
        },
      );
    })();
  });

  return readyPromise;
}

async function handleUser(user: User | null): Promise<void> {
  if (!user) {
    const guest = activeGuestProfile();
    setState({ user: null, profile: guest, isGuest: guest !== null });
    return;
  }

  // A real account supersedes guest mode. Local guest progress is deliberately NOT merged:
  // combining two independent XP/mastery histories needs a conflict policy (which streak
  // wins? do attempts double-count?) that has not been designed. Guest data is kept on the
  // device, so nothing is destroyed — see "Known limitations" in the README.
  endGuestSession();
  setState({ user, isGuest: false });

  try {
    const profile = await ensureUserProfile({
      uid: user.uid,
      name: displayNameFor(user),
      email: user.email ?? '',
      ...(user.photoURL ? { photoURL: user.photoURL } : {}),
    });
    setState({ profile });
  } catch (error) {
    // Offline or rules not deployed: stay signed in, screens fall back to auth data.
    console.error('[session] could not load profile', error);
    setState({ profile: null });
  }
}

export function getSession(): Session {
  return state;
}

/** True for a Firebase user *or* an active guest — both may enter protected routes. */
export function isAuthenticated(): boolean {
  return state.user !== null || state.isGuest;
}

/** Starts guest mode and publishes it to every subscriber. */
export function beginGuestSession(name?: string): void {
  const profile = startGuestSession(name);
  setState({ user: null, profile, isGuest: true, ready: true });
}

/** Clears guest mode. Firebase sign-out is handled separately by AuthService. */
export function clearGuestSession(): void {
  endGuestSession();
  if (state.isGuest) setState({ user: null, profile: null, isGuest: false });
}

/** Resolves once the initial auth state is known. */
export async function sessionReady(): Promise<void> {
  await initSession();
}

/** Subscribes to session changes. Returns an unsubscribe function. */
export function onSessionChange(listener: (session: Session) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-reads the profile, e.g. after XP is awarded in a later phase. */
export async function refreshProfile(): Promise<void> {
  if (state.user) {
    await handleUser(state.user);
    return;
  }
  if (state.isGuest) setState({ profile: activeGuestProfile() });
}
