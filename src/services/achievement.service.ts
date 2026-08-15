/**
 * Achievement awarding — the I/O half of the achievement system.
 *
 * `achievement.logic.ts` decides *what* is earned (pure, tested); this decides *when* to ask
 * and persists the result. Both the game pipeline and the dictionary call `evaluateAndUnlock`,
 * so a badge can never be awarded by one path and missed by the other.
 */

import { getAchievements, getTopics } from '@/services/content.service';
import { evaluateAchievements } from '@/services/achievement.logic';
import { isUnitMastered, unitMastery } from '@/services/mastery.logic';
import { countersOf } from '@/services/progress.store';
import type { ProgressStore } from '@/services/progress.store';
import type { AchievementContext } from '@/services/achievement.logic';
import type { Achievement } from '@/models/content';
import type { UserProgress } from '@/models/progress';
import type { UserProfile } from '@/models/user';

/** How many units currently sit at or above the mastery threshold. */
export async function countMasteredUnits(allProgress: readonly UserProgress[]): Promise<number> {
  const topics = await getTopics();
  const byUnit = new Map<string, { masteries: number[]; total: number }>();

  for (const topic of topics) {
    const entry = byUnit.get(topic.unitId) ?? { masteries: [], total: 0 };
    entry.total += 1;
    byUnit.set(topic.unitId, entry);
  }
  for (const progress of allProgress) {
    byUnit.get(progress.unitId)?.masteries.push(progress.mastery);
  }

  let mastered = 0;
  for (const { masteries, total } of byUnit.values()) {
    if (isUnitMastered(unitMastery(masteries, total))) mastered += 1;
  }
  return mastered;
}

/** Totals that already include whatever activity just happened. */
export interface AchievementTotals {
  gamesPlayed: number;
  correctAnswers: number;
  currentStreak: number;
}

/**
 * Builds the context, evaluates the catalogue and persists any new unlocks.
 * Returns the achievements earned by this call — already-held ones are never returned.
 */
export async function evaluateAndUnlock(
  store: ProgressStore,
  profile: UserProfile,
  totals: AchievementTotals,
  overrides: Partial<AchievementContext> = {},
): Promise<Achievement[]> {
  const counters = countersOf(profile);

  const [catalogue, held, allProgress] = await Promise.all([
    getAchievements(),
    store.loadUnlockedAchievements(),
    store.loadAllProgress(),
  ]);

  const context: AchievementContext = {
    totalCorrectAnswers: totals.correctAnswers,
    totalGamesPlayed: totals.gamesPlayed,
    currentStreak: totals.currentStreak,
    bossWins: counters.bossWins,
    riddlesSolvedWithoutHint: counters.riddlesSolvedWithoutHint,
    dictionaryTermsViewed: counters.dictionaryTermsViewed,
    modesPlayed: counters.modesPlayed,
    unitsMastered: await countMasteredUnits(allProgress),
    ...overrides,
  };

  const unlocked = evaluateAchievements(catalogue, context, held);
  if (unlocked.length > 0) {
    await store.unlockAchievements(unlocked.map((achievement) => achievement.id));
  }
  return unlocked;
}
