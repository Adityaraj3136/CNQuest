/**
 * Firebase Authentication wrapper.
 *
 * Every method throws `AuthServiceError`, whose message is safe to show a student —
 * raw Firebase error codes and stack traces never reach the UI.
 */

import { getFirebaseAuth, isFirebaseConfigured } from '@/config/firebase';
import { createUserProfile, ensureUserProfile } from '@/services/user.service';
import type { User } from 'firebase/auth';
import { isInstalled } from '@/pwa/pwa';

/**
 * Whether a sign-in should outlive closing the app. The installed app always keeps the student
 * signed in: "until the tab closes" means every time the app is swiped away, which is never
 * what someone who installed it wants. In a browser tab the "Keep me signed in" box decides.
 * Lasting sessions use IndexedDB, Firebase's most durable store.
 */
function keepSignedIn(remember: boolean): boolean {
  return remember || isInstalled();
}

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
  'auth/account-exists-with-different-credential':
    'An account with this email already exists. Log in with your password instead.',
  'auth/unauthorized-domain':
    'This site is not an authorised domain for sign-in. Add it in Firebase Console → Authentication → Settings.',
};

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
    indexedDBLocalPersistence,
    browserSessionPersistence,
  } = await import('firebase/auth');

  try {
    await setPersistence(auth, keepSignedIn(remember) ? indexedDBLocalPersistence : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return credential.user;
  } catch (error) {
    throw toAuthError(error);
  }
}

type AuthModule = typeof import('firebase/auth');

/** Resolved copies of the auth pieces, so finishing a Google sign-in awaits nothing slow. */
let warmAuthModule: AuthModule | null = null;
let warmAuth: Awaited<ReturnType<typeof getFirebaseAuth>> | null = null;

/**
 * Loads the Firebase Auth chunk and instance while the student is still choosing an account,
 * so the token exchange starts the moment they pick one.
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
    // Not fatal: sign-in still works, it just loads the chunk on demand.
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

    await ensureGoogleProfile(result.user);
    return result.user;
  } catch (error) {
    console.error('[auth] could not complete redirect sign-in', error);
    return null;
  }
}

async function ensureGoogleProfile(user: User): Promise<void> {
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
}

/**
 * Finishes an in-app Google sign-in: the ID token comes from Google Identity Services (the
 * account chooser shown over the page, see google-identity.ts) and Firebase turns it into a
 * session. No window or tab is opened.
 *
 * Google hands back a display name and photo but no Firestore profile, so this calls
 * `ensureUserProfile`, the same idempotent path session bootstrap uses.
 */
export async function signInWithGoogleIdToken(idToken: string, remember = true): Promise<User> {
  assertConfigured();
  const authModule = warmAuthModule ?? (await import('firebase/auth'));
  const auth = warmAuth ?? (await getFirebaseAuth());
  const { GoogleAuthProvider, signInWithCredential, setPersistence, indexedDBLocalPersistence, browserSessionPersistence } =
    authModule;

  let user: User;
  try {
    await setPersistence(auth, keepSignedIn(remember) ? indexedDBLocalPersistence : browserSessionPersistence);
    user = (await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))).user;
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    // The shared message for this code talks about passwords; a Google token has none.
    if (code === 'auth/invalid-credential') {
      throw new AuthServiceError('Google sign-in could not be verified. Try again.', code);
    }
    throw toAuthError(error);
  }
  await ensureGoogleProfile(user);
  return user;
}

/**
 * Fallback when Google Identity Services cannot load (offline at first paint, blocked script,
 * origin not yet authorised): a full-page redirect in the same tab. Never a popup window.
 * completeGoogleRedirect() picks the session up when the browser comes back.
 */
export async function signInWithGoogle(remember = true): Promise<User> {
  assertConfigured();
  const authModule = warmAuthModule ?? (await import('firebase/auth'));
  const auth = warmAuth ?? (await getFirebaseAuth());
  const { GoogleAuthProvider, signInWithRedirect, setPersistence, indexedDBLocalPersistence, browserSessionPersistence } =
    authModule;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await setPersistence(auth, keepSignedIn(remember) ? indexedDBLocalPersistence : browserSessionPersistence);
    await signInWithRedirect(auth, provider);
  } catch (error) {
    throw toAuthError(error);
  }
  return new Promise<User>(() => {}); // the page navigates away
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
