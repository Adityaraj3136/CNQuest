/** User profile stored at `users/{uid}` in Firestore. */

import type { Timestamp } from 'firebase/firestore';
import type { ActivityCounters } from './progress.ts';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;

  totalXP: number;
  level: number;

  currentStreak: number;
  longestStreak: number;
  /** Local calendar date of the last qualifying activity, as `YYYY-MM-DD`. */
  lastActiveDate?: string;

  gamesPlayed: number;
  questionsAnswered: number;
  correctAnswers: number;

  /**
   * Counters only some modes produce (boss wins, hint-free riddles, dictionary views,
   * modes played). Kept on the profile rather than in a separate collection so one read
   * gives the achievement engine everything it needs.
   */
  counters?: ActivityCounters;

  /**
   * Dictionary term ids the student has opened. Stored as ids rather than a bare count so
   * re-reading the same term cannot inflate the Dictionary Explorer achievement.
   */
  viewedTerms?: string[];

  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** Statistics every new student starts with. */
export const DEFAULT_USER_STATS = {
  totalXP: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  gamesPlayed: 0,
  questionsAnswered: 0,
  correctAnswers: 0,
} as const;

/** Fields a student is allowed to edit on their own profile (Phase 6 profile screen). */
export const EDITABLE_PROFILE_FIELDS = ['name', 'photoURL'] as const;
export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];
