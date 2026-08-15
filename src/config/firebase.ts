/**
 * Firebase bootstrap.
 *
 * The SDK is initialised lazily so that Phase 1 (landing + auth layouts) still runs
 * when `.env` has not been filled in yet. Auth and Firestore modules are dynamically
 * imported to keep them out of the initial bundle.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const env = import.meta.env;

/**
 * Reads one config value, trimming surrounding whitespace.
 *
 * These arrive from `.env` files and CI secrets, where a value pasted with a stray leading
 * space is invisible and survives every review. A space in `authDomain` sent every sign-in to
 * "%20cn-quest.firebaseapp.com", which does not resolve, so auth failed with a DNS error that
 * looked nothing like a configuration mistake.
 */
function readValue(key: (typeof REQUIRED_KEYS)[number] | 'VITE_FIREBASE_MEASUREMENT_ID'): string {
  const raw = env[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Env keys that are still blank. Empty array means the project is configured. */
export function missingFirebaseKeys(): string[] {
  // Whitespace-only counts as missing: it fails later and less helpfully than an empty value.
  return REQUIRED_KEYS.filter((key) => !readValue(key));
}

export function isFirebaseConfigured(): boolean {
  return missingFirebaseKeys().length === 0;
}

function readOptions(): FirebaseOptions {
  const missing = missingFirebaseKeys();
  if (missing.length > 0) {
    throw new Error(
      `Firebase is not configured. Copy .env.example to .env and set: ${missing.join(', ')}`,
    );
  }

  return {
    apiKey: readValue('VITE_FIREBASE_API_KEY'),
    authDomain: readValue('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: readValue('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: readValue('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readValue('VITE_FIREBASE_APP_ID'),
    ...(readValue('VITE_FIREBASE_MEASUREMENT_ID')
      ? { measurementId: readValue('VITE_FIREBASE_MEASUREMENT_ID') }
      : {}),
  };
}

/** Returns the singleton FirebaseApp, creating it on first use. */
export function getFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(readOptions());
}

const useEmulators = env.VITE_USE_FIREBASE_EMULATORS === 'true';

let authPromise: Promise<Auth> | null = null;
let dbPromise: Promise<Firestore> | null = null;

/** Lazily loads Firebase Auth (and wires the emulator when enabled). */
export function getFirebaseAuth(): Promise<Auth> {
  authPromise ??= (async () => {
    const { getAuth, connectAuthEmulator } = await import('firebase/auth');
    const auth = getAuth(getFirebaseApp());
    if (useEmulators) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    return auth;
  })();
  return authPromise;
}

/** Lazily loads Cloud Firestore (and wires the emulator when enabled). */
export function getFirestoreDb(): Promise<Firestore> {
  dbPromise ??= (async () => {
    const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
    const db = getFirestore(getFirebaseApp());
    if (useEmulators) {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    return db;
  })();
  return dbPromise;
}
