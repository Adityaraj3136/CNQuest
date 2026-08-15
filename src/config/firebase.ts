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

/** Env keys that are still blank. Empty array means the project is configured. */
export function missingFirebaseKeys(): string[] {
  return REQUIRED_KEYS.filter((key) => !env[key]);
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
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    ...(env.VITE_FIREBASE_MEASUREMENT_ID
      ? { measurementId: env.VITE_FIREBASE_MEASUREMENT_ID }
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
