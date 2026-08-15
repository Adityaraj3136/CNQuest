/**
 * Ranking rules for the leaderboard, kept pure so they can be tested without Firestore.
 *
 * The leaderboard deliberately holds a *copy* of the public-safe fields rather than reading
 * `users/{uid}`: the profile document carries an email and every counter the achievement
 * engine needs, and exposing that to every signed-in student to draw a ranking table would
 * be a bad trade. See `leaderboard.service.ts` for the mirror write.
 */

import type { UserProfile } from '../models/user.ts';

/** The only fields any other student is allowed to see. */
export interface LeaderboardEntry {
  uid: string;
  name: string;
  level: number;
  totalXP: number;
}

export interface RankedEntry extends LeaderboardEntry {
  /** Competition ranking: equal XP shares a rank, and the next rank skips (1, 2, 2, 4). */
  rank: number;
  isCurrentUser: boolean;
}

/** Longest name Firestore rules will accept — matches `leaderboardIsCoherent` in firestore.rules. */
export const MAX_NAME_LENGTH = 60;

/** Projects a profile down to the public-safe subset. Nothing else may be published. */
export function publicEntryOf(profile: UserProfile): LeaderboardEntry {
  return {
    uid: profile.uid,
    name: (profile.name || 'Student').slice(0, MAX_NAME_LENGTH),
    level: profile.level,
    totalXP: profile.totalXP,
  };
}

/**
 * Sorts by XP, then by name so two students on the same XP never swap places between loads,
 * and assigns competition ranks.
 */
export function rankEntries(
  entries: readonly LeaderboardEntry[],
  currentUid: string | null,
): RankedEntry[] {
  const ordered = [...entries].sort(
    (a, b) => b.totalXP - a.totalXP || a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid),
  );

  let lastXp: number | null = null;
  let lastRank = 0;

  return ordered.map((entry, index) => {
    const rank = entry.totalXP === lastXp ? lastRank : index + 1;
    lastXp = entry.totalXP;
    lastRank = rank;

    return { ...entry, rank, isCurrentUser: entry.uid === currentUid };
  });
}
