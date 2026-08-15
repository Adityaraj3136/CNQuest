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

const NOT_CONFIGURED_MESSAGE =
  'CN Quest is not connected to Firebase yet. Copy .env.example to .env, add your Firebase keys, and restart the dev server.';

function toAuthError(error: unknown): AuthServiceError {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown';
  console.error('[auth]', code, error);
  return new AuthServiceError(
    FRIENDLY_MESSAGES[code] ?? 'Something went wrong. Please try again.',
    code,
  );
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

/**
 * Signs in with Google.
 *
 * Google hands back a display name and photo but no Firestore profile, so this calls
 * `ensureUserProfile` — the same idempotent path session bootstrap uses — rather than
 * `createUserProfile`, which would fail the second time the student signs in.
 */
export async function signInWithGoogle(remember = true): Promise<User> {
  assertConfigured();
  const auth = await getFirebaseAuth();
  const {
    GoogleAuthProvider,
    signInWithPopup,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
  } = await import('firebase/auth');

  let user: User;
  try {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const provider = new GoogleAuthProvider();
    // Always show the chooser: shared and lab machines are the normal case here.
    provider.setCustomParameters({ prompt: 'select_account' });
    user = (await signInWithPopup(auth, provider)).user;
  } catch (error) {
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
