/**
 * Achievement evaluation — pure, no storage.
 *
 * Each achievement maps to one measure function returning the student's current value for
 * that counter. An achievement unlocks when `measure >= target` and it is not already held,
 * which is what makes duplicate awards structurally impossible.
 */

import type { Achievement, GameType } from '../models/content.ts';
import type { GameResult } from '../models/game.ts';

export interface AchievementContext {
  /** Lifetime totals, already including the round that just finished. */
  totalCorrectAnswers: number;
  totalGamesPlayed: number;
  currentStreak: number;

  /** The round that just finished, if this evaluation follows one. */
  round?: GameResult;

  bossWins: number;
  riddlesSolvedWithoutHint: number;
  dictionaryTermsViewed: number;
  modesPlayed: readonly GameType[];
  unitsMastered: number;
}

/** Returns the student's current value for the counter an achievement tracks. */
type Measure = (ctx: AchievementContext) => number;

/** Round-scoped accuracy, but only for the named game mode. */
function roundAccuracyFor(gameType: GameType): Measure {
  return (ctx) => (ctx.round?.gameType === gameType ? ctx.round.accuracy : 0);
}

/**
 * Measures keyed by achievement id. An achievement with no entry here can never unlock —
 * that is deliberate, so a typo in seed data fails loudly in the tests rather than silently
 * awarding or silently never awarding.
 */
export const MEASURES: Record<string, Measure> = {
  'first-steps': (ctx) => ctx.totalGamesPlayed,
  'quiz-master': (ctx) => ctx.totalCorrectAnswers,
  'on-fire': (ctx) => ctx.currentStreak,
  'speed-demon': roundAccuracyFor('rapid-fire'),
  'boss-slayer': (ctx) => ctx.bossWins,
  perfectionist: roundAccuracyFor('quiz'),
  'dictionary-explorer': (ctx) => ctx.dictionaryTermsViewed,
  'riddle-solver': (ctx) => ctx.riddlesSolvedWithoutHint,
  'all-rounder': (ctx) => new Set(ctx.modesPlayed).size,
  'network-expert': (ctx) => ctx.unitsMastered,
};

export interface AchievementProgress {
  achievement: Achievement;
  value: number;
  target: number;
  percent: number;
  unlocked: boolean;
}

export function measureFor(achievementId: string): Measure | null {
  return MEASURES[achievementId] ?? null;
}

/** Achievements newly earned by this context. Already-held ones are never returned again. */
export function evaluateAchievements(
  catalogue: readonly Achievement[],
  ctx: AchievementContext,
  alreadyUnlocked: readonly string[],
): Achievement[] {
  const held = new Set(alreadyUnlocked);

  return catalogue.filter((achievement) => {
    if (held.has(achievement.id)) return false;
    const measure = MEASURES[achievement.id];
    if (!measure) return false;
    return measure(ctx) >= achievement.target;
  });
}

/** Progress towards every achievement — what the Achievements screen renders. */
export function achievementProgress(
  catalogue: readonly Achievement[],
  ctx: AchievementContext,
  alreadyUnlocked: readonly string[],
): AchievementProgress[] {
  const held = new Set(alreadyUnlocked);

  return catalogue.map((achievement) => {
    const unlocked = held.has(achievement.id);
    const measure = MEASURES[achievement.id];
    // A held achievement always shows full, even if the measure is round-scoped.
    const value = unlocked ? achievement.target : Math.min(measure?.(ctx) ?? 0, achievement.target);

    return {
      achievement,
      value,
      target: achievement.target,
      percent: achievement.target === 0 ? 100 : Math.round((value / achievement.target) * 100),
      unlocked,
    };
  });
}
