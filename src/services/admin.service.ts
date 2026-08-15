/**
 * Content administration.
 *
 * Deliberately generic: nine content collections with different shapes would otherwise mean
 * nine bespoke forms to build and keep in sync with `models/content.ts`. One document editor
 * over raw JSON covers all of them, and the bundled seed data doubles as the shape reference.
 *
 * Nothing here is a security boundary. `isAdmin()` decides what the interface offers; the
 * `isAdmin()` rule in firestore.rules decides what Firestore accepts. A student who forges
 * their way onto the screen gets a dashboard whose every write is refused.
 */

import { getFirestoreDb } from '@/config/firebase';
import { ADMIN_EMAIL } from '@/config/app.config';
import { getSession } from '@/state/session';
import { clearContentCache } from '@/services/content.service';
import { parseDocumentInput, summarise } from '@/services/admin.logic';
import {
  ACHIEVEMENTS,
  BOSSES,
  DICTIONARY,
  MATCHING_SETS,
  QUESTIONS,
  RIDDLES,
  TOPICS,
  UNITS,
  WORD_SEARCH_SETS,
} from '@/data/index';

export interface ContentCollection {
  /** Firestore collection name. */
  id: string;
  label: string;
  /**
   * The copy shipped in the bundle, used for "publish" and as the shape reference.
   * Only `id` is required here — the nine collections have nine different shapes, and the
   * editor works on whole documents rather than known fields.
   */
  bundled: readonly { readonly id: string }[];
}

/** Every collection the admin may edit. Matches the content blocks in firestore.rules. */
export const CONTENT_COLLECTIONS: readonly ContentCollection[] = [
  { id: 'units', label: 'Units', bundled: UNITS },
  { id: 'topics', label: 'Topics', bundled: TOPICS },
  { id: 'questions', label: 'Questions', bundled: QUESTIONS },
  { id: 'riddles', label: 'Riddles', bundled: RIDDLES },
  { id: 'dictionary', label: 'Dictionary', bundled: DICTIONARY },
  {
    id: 'achievements',
    label: 'Achievements',
    bundled: ACHIEVEMENTS,
  },
  {
    id: 'matchingSets',
    label: 'Matching sets',
    bundled: MATCHING_SETS,
  },
  {
    id: 'wordSearchSets',
    label: 'Word search sets',
    bundled: WORD_SEARCH_SETS,
  },
  { id: 'bosses', label: 'Bosses', bundled: BOSSES },
];

export function collectionById(id: string): ContentCollection | null {
  return CONTENT_COLLECTIONS.find((entry) => entry.id === id) ?? null;
}

/** True when the signed-in account is the course owner. Guests are never admins. */
export function isAdmin(): boolean {
  const { user } = getSession();
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export interface AdminDocument {
  id: string;
  data: Record<string, unknown>;
}

export async function listDocuments(collectionName: string): Promise<AdminDocument[]> {
  const db = await getFirestoreDb();
  const { collection, getDocs } = await import('firebase/firestore');

  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Writes one document. `merge: false` — the editor shows the whole document, so a removed
 * field is a deliberate removal, not an omission to be quietly preserved.
 */
export async function saveDocument(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const db = await getFirestoreDb();
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, collectionName, id), data);
  clearContentCache();
}

export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  const db = await getFirestoreDb();
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, collectionName, id));
  clearContentCache();
}

/**
 * Uploads the bundled copy of a collection.
 *
 * This is `scripts/seed.mjs` without the service-account key: the admin is already
 * authenticated and the rules already permit their writes, so seeding needs no private key
 * on anyone's disk. Existing documents with the same id are overwritten; documents that
 * exist only in Firestore are left alone, so a hand-edited extra is never silently destroyed.
 */
export async function publishBundled(collectionName: string): Promise<number> {
  const entry = collectionById(collectionName);
  if (!entry) throw new Error(`Unknown collection "${collectionName}"`);

  const db = await getFirestoreDb();
  const { doc, writeBatch } = await import('firebase/firestore');

  // Firestore caps a batch at 500 writes; questions alone is 90 today, but chunking keeps
  // this correct if the syllabus grows.
  const BATCH_LIMIT = 450;
  let written = 0;

  for (let start = 0; start < entry.bundled.length; start += BATCH_LIMIT) {
    const chunk = entry.bundled.slice(start, start + BATCH_LIMIT);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const id = typeof item.id === 'string' ? item.id : null;
      if (!id) throw new Error(`A bundled ${collectionName} document has no string id`);
      batch.set(doc(db, collectionName, id), item);
    }

    await batch.commit();
    written += chunk.length;
  }

  clearContentCache();
  return written;
}

// Re-exported so screens import one module; the implementations are pure and tested.
export { parseDocumentInput, summarise };
