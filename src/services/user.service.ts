/** Reads and writes the `users/{uid}` profile document. */

import { getFirestoreDb } from '@/config/firebase';
import { DEFAULT_USER_STATS } from '@/models/user';
import type { EditableProfileField, UserProfile } from '@/models/user';

const COLLECTION = 'users';

/**
 * Creates the profile document for a newly registered student.
 * Uses `setDoc` with the auth uid as the document id so the security rules can
 * match `request.auth.uid == userId`.
 */
export async function createUserProfile(input: {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
}): Promise<void> {
  const db = await getFirestoreDb();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

  await setDoc(doc(db, COLLECTION, input.uid), {
    uid: input.uid,
    name: input.name,
    email: input.email,
    ...(input.photoURL ? { photoURL: input.photoURL } : {}),
    ...DEFAULT_USER_STATS,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = await getFirestoreDb();
  const { doc, getDoc } = await import('firebase/firestore');

  const snapshot = await getDoc(doc(db, COLLECTION, uid));
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}

/**
 * Returns the profile, creating it first if it is missing.
 * Covers accounts created before the profile write succeeded, and future
 * provider sign-ins (e.g. Google) that skip the registration form.
 */
export async function ensureUserProfile(input: {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
}): Promise<UserProfile | null> {
  const existing = await getUserProfile(input.uid);
  if (existing) return existing;

  await createUserProfile(input);
  return getUserProfile(input.uid);
}

/** Updates the student-editable subset of their own profile. */
export async function updateUserProfile(
  uid: string,
  changes: Partial<Pick<UserProfile, EditableProfileField>>,
): Promise<void> {
  const db = await getFirestoreDb();
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');

  await updateDoc(doc(db, COLLECTION, uid), { ...changes, updatedAt: serverTimestamp() });
}
