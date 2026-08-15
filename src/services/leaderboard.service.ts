/**
 * Reads and writes `leaderboard/{uid}` — a mirror of the public-safe slice of a profile.
 *
 * Why a second collection: `users/{uid}` is readable only by its owner and holds an email
 * plus every achievement counter. Ranking students means reading other students' rows, so
 * the ranking table gets its own documents carrying nothing but uid, name, level and XP.
 * The rules pin each document to its owner's uid and keep XP monotonic, exactly like the
 * profile rules — the mirror is no more trustworthy than the profile it copies, and no less.
 */

import { getFirestoreDb } from '@/config/firebase';
import { publicEntryOf } from '@/services/leaderboard.logic';
import type { LeaderboardEntry } from '@/services/leaderboard.logic';
import type { UserProfile } from '@/models/user';

const COLLECTION = 'leaderboard';

/** Rows fetched for the table. Beyond this the page stops being a ranking and starts being a list. */
export const LEADERBOARD_SIZE = 50;

/**
 * Mirrors the public-safe fields after a profile write.
 * Called from the Firestore progress store; a failure here must not lose the round that
 * was just played, so it is logged rather than thrown.
 */
export async function publishLeaderboardEntry(profile: UserProfile): Promise<void> {
  try {
    const db = await getFirestoreDb();
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

    await setDoc(doc(db, COLLECTION, profile.uid), {
      ...publicEntryOf(profile),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    // The student's own progress is already saved; only their ranking row is stale.
    console.error('[leaderboard] could not publish ranking entry', error);
  }
}

/** The top students by XP. Ordering on a single field needs no composite index. */
export async function getTopEntries(max = LEADERBOARD_SIZE): Promise<LeaderboardEntry[]> {
  const db = await getFirestoreDb();
  const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore');

  const snapshot = await getDocs(
    query(collection(db, COLLECTION), orderBy('totalXP', 'desc'), limit(max)),
  );
  return snapshot.docs.map((entry) => entry.data() as LeaderboardEntry);
}
