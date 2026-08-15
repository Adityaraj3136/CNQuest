/**
 * Per-student progress documents.
 * No imports beyond types, so the Node test runner can load them directly.
 */

import type { Difficulty, GameType } from './content.ts';

/** One document per user + topic. Firestore id is `${userId}__${topicId}`. */
export interface UserProgress {
  userId: string;
  topicId: string;
  unitId: string;

  attempted: number;
  correct: number;

  /** 0-100, rounded. */
  accuracy: number;
  /** 0-100 — how much of the topic's question bank has been seen. */
  completion: number;
  /** 0-100 — the weighted score from progress.config.ts. */
  mastery: number;

  lastAttemptAt: string | null;
}

/** An immutable record of one finished round. */
export interface GameAttempt {
  id: string;
  userId: string;
  gameType: GameType;

  unitId?: string;
  topicId: string;

  attempted: number;
  correct: number;
  wrong: number;

  score: number;
  accuracy: number;

  xpEarned: number;
  durationSeconds: number;

  difficulty?: Difficulty | 'mixed';
  createdAt: string;
}

export interface UserAchievement {
  userId: string;
  achievementId: string;
  unlockedAt: string;
  rewardXP: number;
}

/** Counters that only some game modes or screens produce. */
export interface ActivityCounters {
  bossWins: number;
  riddlesSolvedWithoutHint: number;
  dictionaryTermsViewed: number;
  /** Game types the student has played at least once. */
  modesPlayed: GameType[];
}

export const EMPTY_COUNTERS: ActivityCounters = {
  bossWins: 0,
  riddlesSolvedWithoutHint: 0,
  dictionaryTermsViewed: 0,
  modesPlayed: [],
};
