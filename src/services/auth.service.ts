/**
 * Firebase Authentication wrapper.
 *
 * Every method throws `AuthServiceError`, whose message is safe to show a student —
 * raw Firebase error codes and stack traces never reach the UI.
 */

import { getFirebaseAuth, isFirebaseConfigured } from '@/config/firebase';
import { createUserProfile, ensureUserProfile } from '@/services/user.service';
import type { User } from 'firebase/auth';

export class AuthServiceError extends Error {
  constructor(
    message: string,
    /** Original Firebase error code, kept for logging only. */
    readonly code = 'unknown',
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address is not valid.',
  'auth/user-disabled': 'This account has been disabled. Contact your instructor.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account with this email already exists. Try logging in.',
  'auth/weak-password': 'Choose a stronger password of at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled in the Firebase project.',
  // Closing the Google window is a decision, not a fault — say nothing accusatory.
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
  'auth/account-exists-with-different-credential':
    'An account with this email already exists. Log in with your password instead.',
  'auth/unauthorized-domain':
    'This site is not an authorised domain for sign-in. Add it in Firebase Console → Authentication → Settings.',
};

/**
 * Popup failures that are about the *environment*, not the student's choice. These fall back
 * to a full-page redirect; `popup-closed-by-user` deliberately does not, since the student
 * closing the window is an answer.
 */
const POPUP_UNAVAILABLE_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
  'auth/internal-error',
]);

const NOT_CONFIGURED_MESSAGE =
  'CN Quest is not connected to Firebase yet. Copy .env.example to .env, add your Firebase keys, and restart the dev server.';

function toAuthError(error: unknown): AuthServiceError {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown';
  console.error('[auth]', code, error);
  if (FRIENDLY_MESSAGES[code]) return new AuthServiceError(FRIENDLY_MESSAGES[code], code);

  // Everything below is a failure nobody anticipated. "Something went wrong" tells the student
  // nothing and tells whoever has to fix it even less, so the detail is surfaced verbatim.
  if (code && code !== 'unknown') {
    return new AuthServiceError(`Sign-in failed (${code}).`, code);
  }

  // No Firebase code at all: a script that failed to load, a blocked request, a type error.
  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : `Unexpected ${typeof error}: ${String(error)}`;

  return new AuthServiceError(`Sign-in failed. ${detail}`, 'unknown');
}

function assertConfigured(): void {
  if (!isFirebaseConfigured()) {
    throw new AuthServiceError(NOT_CONFIGURED_MESSAGE, 'app/not-configured');
  }
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

/**
 * Creates the Firebase Auth user, sets the display name, and writes the
 * Firestore profile with the default statistics.
 */
export async function register({ name, email, password }: RegisterInput): Promise<User> {
  assertConfigured();
  const auth = await getFirebaseAuth();
  const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');

  let user: User;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    user = credential.user;
    await updateProfile(user, { displayName: name.trim() });
  } catch (error) {
    throw toAuthError(error);
  }

  try {
    await createUserProfile({ uid: user.uid, name: name.trim(), email: email.trim() });
  } catch (error) {
    // The account exists but the profile write failed (offline, or rules not deployed).
    // Session bootstrap retries this via ensureUserProfile on the next load.
    console.error('[auth] profile creation failed', error);
    throw new AuthServiceError(
      'Your account was created, but we could not save your profile. Log in again to finish setup.',
      'app/profile-write-failed',
    );
  }

  return user;
}

/** Signs in. `remember: false` keeps the session only until the tab is closed. */
export async function signIn(email: string, password: string, remember = true): Promise<User> {
  assertConfigured();
  const auth = await getFirebaseAuth();
  const {
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
  } = await import('firebase/auth');

  try {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return credential.user;
  } catch (error) {
    throw toAuthError(error);
  }
}

type AuthModule = typeof import('firebase/auth');

/** Resolved copies of the pieces the popup path needs, so the click itself awaits nothing slow. */
let warmAuthModule: AuthModule | null = null;
let warmAuth: Awaited<ReturnType<typeof getFirebaseAuth>> | null = null;

/**
 * Loads the Firebase Auth chunk and instance ahead of the click.
 *
 * A browser only allows `window.open` while the user's click is still "active", and that
 * activation does not survive a network fetch. Awaiting the lazily-imported auth chunk inside
 * the click handler meant the popup was requested too late and was blocked before Google was
 * ever contacted, which is why sign-in failed without an authorisation window ever appearing.
 *
 * Call this when the sign-in button is rendered; it is safe to call repeatedly.
 */
export async function warmUpGoogleSignIn(): Promise<void> {
  if (!isFirebaseConfigured() || warmAuthModule) return;
  try {
    const [module, auth] = await Promise.all([import('firebase/auth'), getFirebaseAuth()]);
    warmAuthModule = module;
    warmAuth = auth;
  } catch (error) {
    // Not fatal: the click path still works, it is just slower and may hit the popup blocker.
    console.error('[auth] could not pre-load Google sign-in', error);
  }
}

/**
 * Finishes a redirect sign-in after the browser comes back from Google.
 *
 * Called once during session bootstrap. Without it the credential sits unprocessed and the
 * student lands back on the login screen having apparently done nothing. Returns null on a
 * normal load, when there is no redirect to complete.
 */
export async function completeGoogleRedirect(): Promise<User | null> {
  if (!isFirebaseConfigured()) return null;

  try {
    const [{ getRedirectResult }, auth] = await Promise.all([
      import('firebase/auth'),
      getFirebaseAuth(),
    ]);
    const result = await getRedirectResult(auth);
    if (!result) return null;

    const { user } = result;
    await ensureUserProfile({
      uid: user.uid,
      name: user.displayName?.trim() || user.email?.split('@')[0] || 'Student',
      email: user.email ?? '',
      ...(user.photoURL ? { photoURL: user.photoURL } : {}),
    });
    return user;
  } catch (error) {
    console.error('[auth] could not complete redirect sign-in', error);
    return null;
  }
}

/**
 * Signs in with Google.
 *
 * Google hands back a display name and photo but no Firestore profile, so this calls
 * `ensureUserProfile` — the same idempotent path session bootstrap uses — rather than
 * `createUserProfile`, which would fail the second time the student signs in.
 */
export async function signInWithGoogle(remember = true): Promise<User> {
  assertConfigured();
  const authModule = warmAuthModule ?? (await import('firebase/auth'));
  const auth = warmAuth ?? (await getFirebaseAuth());
  const {
    GoogleAuthProvider,
    signInWithPopup,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
  } = authModule;

  const provider = new GoogleAuthProvider();
  // Always show the chooser: shared and lab machines are the normal case here.
  provider.setCustomParameters({ prompt: 'select_account' });

  let user: User;
  try {
    // The popup is opened first and persistence set afterwards. Awaiting a storage write before
    // opening the window is another chance for the browser to decide the click has gone stale.
    user = (await signInWithPopup(auth, provider)).user;
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

    // A popup is the better experience when it works, but plenty of environments refuse it:
    // in-app browsers, strict popup blockers, and hosting the app on an origin that is not the
    // auth domain, where the hidden gapi iframe the popup depends on fails to load at all.
    // That last one throws a bare Error with no Firebase code, so anything uncoded falls back
    // too. Redirect uses no iframe, which is exactly why it survives those environments.
    //
    // `popup-closed-by-user` is deliberately excluded: closing the window is an answer, and
    // navigating the student to Google anyway would override a decision they just made.
    const cancelled = code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';

    if (!cancelled && (POPUP_UNAVAILABLE_CODES.has(code) || !code)) {
      console.warn('[auth] popup unavailable, falling back to redirect', code || error);
      const { signInWithRedirect } = await import('firebase/auth');
      await signInWithRedirect(auth, provider);
      // The page navigates away; completeGoogleRedirect() picks the session up on return.
      return new Promise<User>(() => {});
    }

    throw toAuthError(error);
  }

  try {
    await ensureUserProfile({
      uid: user.uid,
      name: user.displayName?.trim() || user.email?.split('@')[0] || 'Student',
      email: user.email ?? '',
      ...(user.photoURL ? { photoURL: user.photoURL } : {}),
    });
  } catch (error) {
    // The account is valid; only the profile write failed. Session bootstrap retries it.
    console.error('[auth] profile creation failed after Google sign-in', error);
  }

  return user;
}

export async function signOut(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const auth = await getFirebaseAuth();
  const { signOut: firebaseSignOut } = await import('firebase/auth');

  try {
    await firebaseSignOut(auth);
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  assertConfigured();
  const auth = await getFirebaseAuth();
  const { sendPasswordResetEmail } = await import('firebase/auth');

  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    // Do not reveal whether an address is registered — treat "not found" as success.
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'auth/user-not-found') return;
    throw toAuthError(error);
  }
}
