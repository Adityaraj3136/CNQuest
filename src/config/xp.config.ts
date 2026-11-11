/**
 * XP rules — every reward value in CN Quest lives here, never inline in a game.
 *
 * Phase 5's XPService owns awarding and persistence; these are the pure numbers and the
 * formula that turns a round into an XP figure.
 */

import type { Difficulty } from '../models/content.ts';

/** Base XP for one correct answer, per game mode. */
export const BASE_XP = {
  quizCorrect: 10,
  rapidFireCorrect: 8,
  riddleSolved: 15,
  matchingCompleted: 30,
  wordSearchCompleted: 40,
  bossVictory: 100,
  packetHopCorrect: 8,
  packetDelivered: 60,
  firstDailyActivity: 20,
} as const;

/** Added on top of the base for each correct answer, by question difficulty. */
export const DIFFICULTY_BONUS: Record<Difficulty, number> = {
  easy: 0,
  medium: 3,
  hard: 6,
};

/** One-off bonuses awarded on the round as a whole. */
export const ROUND_BONUS = {
  perfectRound: 50,
  /** Accuracy thresholds, checked highest first. */
  accuracy: [
    { minAccuracy: 90, xp: 20 },
    { minAccuracy: 75, xp: 10 },
  ],
  /** Best consecutive-correct run in the round, checked highest first. */
  streak: [
    { minStreak: 8, xp: 25 },
    { minStreak: 5, xp: 15 },
    { minStreak: 3, xp: 5 },
  ],
} as const;

/** Hints reduce a riddle's reward (Phase 7). */
export const RIDDLE_HINT_PENALTY = 5;

export interface RoundXpInput {
  /** XP already earned from individual correct answers. */
  answerXp: number;
  attempted: number;
  correct: number;
  bestStreak: number;
}

export interface RoundXpBreakdown {
  answerXp: number;
  accuracyBonus: number;
  streakBonus: number;
  perfectBonus: number;
  total: number;
}

/** XP for one correct answer of the given difficulty. */
export function xpForCorrectAnswer(base: number, difficulty: Difficulty): number {
  return base + DIFFICULTY_BONUS[difficulty];
}

/**
 * Totals a round's XP.
 * Deliberately transparent — a student can read the breakdown on the results screen and
 * see exactly where each point came from.
 */
export function calculateRoundXp({
  answerXp,
  attempted,
  correct,
  bestStreak,
}: RoundXpInput): RoundXpBreakdown {
  const accuracy = attempted === 0 ? 0 : (correct / attempted) * 100;

  const accuracyBonus = ROUND_BONUS.accuracy.find((tier) => accuracy >= tier.minAccuracy)?.xp ?? 0;
  const streakBonus = ROUND_BONUS.streak.find((tier) => bestStreak >= tier.minStreak)?.xp ?? 0;
  const perfectBonus = attempted > 0 && correct === attempted ? ROUND_BONUS.perfectRound : 0;

  return {
    answerXp,
    accuracyBonus,
    streakBonus,
    perfectBonus,
    total: answerXp + accuracyBonus + streakBonus + perfectBonus,
  };
}
