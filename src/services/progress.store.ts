/**
 * Storage for everything a student earns.
 *
 * One interface, two implementations: guest progress lives in localStorage, account progress
 * lives in Firestore. The gamification pipeline never branches on which — it asks
 * `activeStore()` and writes. That is what lets guest mode and accounts share one code path.
 */

import { getFirestoreDb } from '@/config/firebase';
import { getSession } from '@/state/session';
import { GUEST_STORAGE_KEYS, getGuestProfile, saveGuestProfile } from '@/state/guest';
import { EMPTY_COUNTERS } from '@/models/progress';
import type { ActivityCounters, GameAttempt, UserProgress } from '@/models/progress';
import type { UserProfile } from '@/models/user';

export interface ProgressStore {
  readonly userId: string;
  loadProfile(): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile): Promise<void>;
  loadTopicProgress(topicId: string): Promise<UserProgress | null>;
  loadAllProgress(): Promise<UserProgress[]>;
  saveTopicProgress(progress: UserProgress): Promise<void>;
  saveAttempt(attempt: GameAttempt): Promise<void>;
  loadAttempts(limit?: number): Promise<GameAttempt[]>;
  loadUnlockedAchievements(): Promise<string[]>;
  unlockAchievements(ids: readonly string[]): Promise<void>;
}

export function countersOf(profile: UserProfile | null): ActivityCounters {
  return { ...EMPTY_COUNTERS, ...(profile?.counters ?? {}) };
}

// ------------------------------------------------------------------ guest

const GUEST_KEYS = GUEST_STORAGE_KEYS;

/** Keeps localStorage bounded — the dashboard only ever shows recent activity. */
const GUEST_ATTEMPT_LIMIT = 100;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (error) {
    console.error(`[store] unreadable local data at "${key}", resetting`, error);
    localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Quota or private browsing: the round still played, it just will not persist.
    console.error(`[store] could not save "${key}" locally`, error);
  }
}

class GuestStore implements ProgressStore {
  readonly userId = 'guest-local';

  async loadProfile(): Promise<UserProfile | null> {
    return getGuestProfile();
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    saveGuestProfile(profile);
  }

  async loadTopicProgress(topicId: string): Promise<UserProgress | null> {
    return readJson<Record<string, UserProgress>>(GUEST_KEYS.progress, {})[topicId] ?? null;
  }

  async loadAllProgress(): Promise<UserProgress[]> {
    return Object.values(readJson<Record<string, UserProgress>>(GUEST_KEYS.progress, {}));
  }

  async saveTopicProgress(progress: UserProgress): Promise<void> {
    const all = readJson<Record<string, UserProgress>>(GUEST_KEYS.progress, {});
    all[progress.topicId] = progress;
    writeJson(GUEST_KEYS.progress, all);
  }

  async saveAttempt(attempt: GameAttempt): Promise<void> {
    const attempts = readJson<GameAttempt[]>(GUEST_KEYS.attempts, []);
    attempts.unshift(attempt);
    writeJson(GUEST_KEYS.attempts, attempts.slice(0, GUEST_ATTEMPT_LIMIT));
  }

  async loadAttempts(limit = 20): Promise<GameAttempt[]> {
    return readJson<GameAttempt[]>(GUEST_KEYS.attempts, []).slice(0, limit);
  }

  async loadUnlockedAchievements(): Promise<string[]> {
    return readJson<string[]>(GUEST_KEYS.achievements, []);
  }

  async unlockAchievements(ids: readonly string[]): Promise<void> {
    const held = new Set(readJson<string[]>(GUEST_KEYS.achievements, []));
    ids.forEach((id) => held.add(id));
    writeJson(GUEST_KEYS.achievements, [...held]);
  }
}

// ------------------------------------------------------------------ firestore

class FirestoreStore implements ProgressStore {
  constructor(readonly userId: string) {}

  /** Composite id keeps one document per user+topic and makes the rules trivial. */
  private progressId(topicId: string): string {
    return `${this.userId}__${topicId}`;
  }

  async loadProfile(): Promise<UserProfile | null> {
    const db = await getFirestoreDb();
    const { doc, getDoc } = await import('firebase/firestore');
    const snapshot = await getDoc(doc(db, 'users', this.userId));
    return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    const db = await getFirestoreDb();
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const { createdAt: _ignored, ...writable } = profile;
    await setDoc(
      doc(db, 'users', this.userId),
      { ...writable, updatedAt: serverTimestamp() },
      { merge: true },
    );

    // The ranking table cannot read `users/{uid}`, so every profile write mirrors the
    // public-safe fields across. Never blocks the save above — it logs and moves on.
    const { publishLeaderboardEntry } = await import('@/services/leaderboard.service');
    await publishLeaderboardEntry({ ...profile, uid: this.userId });
  }

  async loadTopicProgress(topicId: string): Promise<UserProgress | null> {
    const db = await getFirestoreDb();
    const { doc, getDoc } = await import('firebase/firestore');
    const snapshot = await getDoc(doc(db, 'userProgress', this.progressId(topicId)));
    return snapshot.exists() ? (snapshot.data() as UserProgress) : null;
  }

  async loadAllProgress(): Promise<UserProgress[]> {
    const db = await getFirestoreDb();
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const snapshot = await getDocs(
      query(collection(db, 'userProgress'), where('userId', '==', this.userId)),
    );
    return snapshot.docs.map((entry) => entry.data() as UserProgress);
  }

  async saveTopicProgress(progress: UserProgress): Promise<void> {
    const db = await getFirestoreDb();
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'userProgress', this.progressId(progress.topicId)), progress, {
      merge: true,
    });
  }

  async saveAttempt(attempt: GameAttempt): Promise<void> {
    const db = await getFirestoreDb();
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'gameAttempts', attempt.id), attempt);
  }

  async loadAttempts(max = 20): Promise<GameAttempt[]> {
    const db = await getFirestoreDb();
    const { collection, getDocs, limit, orderBy, query, where } = await import('firebase/firestore');
    const snapshot = await getDocs(
      query(
        collection(db, 'gameAttempts'),
        where('userId', '==', this.userId),
        orderBy('createdAt', 'desc'),
        limit(max),
      ),
    );
    return snapshot.docs.map((entry) => entry.data() as GameAttempt);
  }

  async loadUnlockedAchievements(): Promise<string[]> {
    const db = await getFirestoreDb();
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const snapshot = await getDocs(
      query(collection(db, 'userAchievements'), where('userId', '==', this.userId)),
    );
    return snapshot.docs.map((entry) => (entry.data() as { achievementId: string }).achievementId);
  }

  async unlockAchievements(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getFirestoreDb();
    const { doc, setDoc } = await import('firebase/firestore');

    await Promise.all(
      ids.map((achievementId) =>
        // Deterministic id: a duplicate unlock overwrites rather than creating a second row.
        setDoc(doc(db, 'userAchievements', `${this.userId}__${achievementId}`), {
          userId: this.userId,
          achievementId,
          unlockedAt: new Date().toISOString(),
        }),
      ),
    );
  }
}

// ------------------------------------------------------------------ selection

/** The store matching the current session, or null when nobody is signed in. */
export function activeStore(): ProgressStore | null {
  const { user, isGuest } = getSession();
  if (user) return new FirestoreStore(user.uid);
  if (isGuest) return new GuestStore();
  return null;
}
