/**
 * The single pipeline every game result flows through.
 *
 *   GameResult → save attempt → XP → level → topic progress → streak → achievements → profile
 *
 * Games must never do any of this themselves. They produce a GameResult and call
 * `processGameResult`; everything downstream is decided here, once, for all six modes.
 */

import { levelForXp, levelProgress, levelTitle } from '@/config/level.config';
import { BASE_XP } from '@/config/xp.config';
import { UNIT_MASTERED_THRESHOLD } from '@/config/progress.config';
import { getQuestions, getTopic } from '@/services/content.service';
import { evaluateAndUnlock } from '@/services/achievement.service';
import { mergeProgress } from '@/services/mastery.logic';
import { applyActivity, toLocalDateKey } from '@/services/streak.logic';
import { activeStore, countersOf } from '@/services/progress.store';
import {
  enqueueResult,
  isExhausted,
  markAttempted,
  pendingCount,
  pendingResults,
  removeQueued,
} from '@/services/sync-queue';
import { refreshProfile } from '@/state/session';
import type { Achievement } from '@/models/content';
import type { GameResult } from '@/models/game';
import type { ActivityCounters, GameAttempt, UserProgress } from '@/models/progress';
import type { UserProfile } from '@/models/user';

export interface ProcessedResult {
  /** XP from the round plus any achievement rewards. */
  xpAwarded: number;
  totalXP: number;

  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  newLevelTitle: string;
  xpToNextLevel: number;

  currentStreak: number;
  longestStreak: number;
  streakExtended: boolean;
  /** True when this was the first qualifying activity of the day. */
  firstActivityToday: boolean;

  topicProgress: UserProgress | null;
  masteryBefore: number;
  masteryAfter: number;

  unlockedAchievements: Achievement[];

  /** False when nothing could be persisted (signed out, or storage unavailable). */
  saved: boolean;
  /** True when the round was added to the offline queue to be synced later. */
  queued: boolean;
}

/** Extra facts a mode can report that the GameResult itself does not carry. */
export interface ResultExtras {
  /** Boss Battle: the student won. */
  bossVictory?: boolean;
  /** Riddles: how many were solved with no hint used. */
  riddlesSolvedWithoutHint?: number;
}

function unchangedResult(result: GameResult): ProcessedResult {
  const level = levelForXp(0);
  return {
    xpAwarded: result.xpEarned,
    totalXP: result.xpEarned,
    levelBefore: level,
    levelAfter: level,
    leveledUp: false,
    newLevelTitle: levelTitle(level),
    xpToNextLevel: 0,
    currentStreak: 0,
    longestStreak: 0,
    streakExtended: false,
    firstActivityToday: false,
    topicProgress: null,
    masteryBefore: 0,
    masteryAfter: 0,
    unlockedAchievements: [],
    saved: false,
    queued: false,
  };
}

function mergeCounters(
  current: ActivityCounters,
  result: GameResult,
  extras: ResultExtras,
): ActivityCounters {
  return {
    bossWins: current.bossWins + (extras.bossVictory ? 1 : 0),
    riddlesSolvedWithoutHint:
      current.riddlesSolvedWithoutHint + (extras.riddlesSolvedWithoutHint ?? 0),
    dictionaryTermsViewed: current.dictionaryTermsViewed,
    modesPlayed: [...new Set([...current.modesPlayed, result.gameType])],
  };
}

/**
 * Runs the full pipeline for a finished round.
 * Never throws: a storage failure still returns a result the UI can display, with
 * `saved: false`, so a student is never shown an error instead of their score.
 */
export async function processGameResult(
  result: GameResult,
  extras: ResultExtras = {},
  /**
   * Whether a failure should be added to the offline queue. False during replay, so a
   * failing entry is not re-queued under a new id and can actually exhaust its retries.
   */
  queueOnFailure = true,
): Promise<ProcessedResult> {
  const store = activeStore();
  if (!store) return unchangedResult(result);

  try {
    const profile = await store.loadProfile();
    if (!profile) return unchangedResult(result);

    // ---- Streak: evaluated once per local calendar day, not per game.
    const today = toLocalDateKey();
    const streak = applyActivity(
      {
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        ...(profile.lastActiveDate ? { lastActiveDate: profile.lastActiveDate } : {}),
      },
      today,
    );
    const firstActivityToday = streak.incremented;

    // ---- XP: round XP, plus the first-activity-of-the-day bonus.
    let xpAwarded = result.xpEarned + (firstActivityToday ? BASE_XP.firstDailyActivity : 0);

    // ---- Topic progress. Rounds spanning topics are recorded but not attributed to one.
    let topicProgress: UserProgress | null = null;
    let masteryBefore = 0;

    if (result.topicId && result.topicId !== 'mixed') {
      const [previous, topic] = await Promise.all([
        store.loadTopicProgress(result.topicId),
        getTopic(result.topicId),
      ]);
      masteryBefore = previous?.mastery ?? 0;

      const pool = (await getQuestions({ topicId: result.topicId })).length;
      topicProgress = mergeProgress(
        previous,
        {
          userId: store.userId,
          topicId: result.topicId,
          unitId: result.unitId ?? topic?.unitId ?? 'unknown',
          attempted: result.attempted,
          correct: result.correct,
        },
        pool,
      );
      await store.saveTopicProgress(topicProgress);
    }

    // ---- Attempt record (immutable audit trail).
    const attempt: GameAttempt = {
      id: `${store.userId}__${Date.now()}`,
      userId: store.userId,
      gameType: result.gameType,
      ...(result.unitId ? { unitId: result.unitId } : {}),
      topicId: result.topicId,
      attempted: result.attempted,
      correct: result.correct,
      wrong: result.wrong,
      score: result.score,
      accuracy: result.accuracy,
      xpEarned: result.xpEarned,
      durationSeconds: result.durationSeconds,
      ...(result.difficulty ? { difficulty: result.difficulty } : {}),
      createdAt: new Date().toISOString(),
    };
    await store.saveAttempt(attempt);

    // ---- Achievements, evaluated against the totals *including* this round.
    const counters = mergeCounters(countersOf(profile), result, extras);
    const totals = {
      gamesPlayed: profile.gamesPlayed + 1,
      questionsAnswered: profile.questionsAnswered + result.attempted,
      correctAnswers: profile.correctAnswers + result.correct,
    };

    // The profile passed here already carries the merged counters, so boss wins and
    // hint-free riddles from *this* round count towards the badges.
    const unlocked = await evaluateAndUnlock(
      store,
      { ...profile, counters },
      {
        gamesPlayed: totals.gamesPlayed,
        correctAnswers: totals.correctAnswers,
        currentStreak: streak.currentStreak,
      },
      { round: result },
    );

    if (unlocked.length > 0) {
      xpAwarded += unlocked.reduce((sum, achievement) => sum + achievement.rewardXP, 0);
    }

    // ---- Profile write: one update carrying XP, level, streak and totals.
    const levelBefore = levelForXp(profile.totalXP);
    const totalXP = profile.totalXP + xpAwarded;
    const after = levelProgress(totalXP);

    const updated: UserProfile = {
      ...profile,
      ...totals,
      totalXP,
      level: after.level,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
      counters,
    };
    await store.saveProfile(updated);
    await refreshProfile();

    return {
      xpAwarded,
      totalXP,
      levelBefore,
      levelAfter: after.level,
      leveledUp: after.level > levelBefore,
      newLevelTitle: after.title,
      xpToNextLevel: after.xpForLevel - after.xpIntoLevel,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      streakExtended: streak.incremented,
      firstActivityToday,
      topicProgress,
      masteryBefore,
      masteryAfter: topicProgress?.mastery ?? masteryBefore,
      unlockedAchievements: unlocked,
      saved: true,
      queued: false,
    };
  } catch (error) {
    // Offline, rules not deployed, quota — queue the round so nothing is lost, show the
    // score, and flag that it has not been saved yet.
    console.error('[game-result] could not process result', error);
    if (queueOnFailure) enqueueResult(store.userId, result, extras);
    return { ...unchangedResult(result), queued: queueOnFailure };
  }
}

/**
 * Replays every queued result for the current user through the pipeline.
 * Safe to call repeatedly: entries are removed only once they succeed.
 */
export async function syncPendingResults(): Promise<{ synced: number; remaining: number }> {
  const store = activeStore();
  if (!store || !navigator.onLine) {
    return { synced: 0, remaining: pendingCount(store?.userId) };
  }

  let synced = 0;

  for (const entry of pendingResults(store.userId)) {
    if (isExhausted(entry)) continue;

    // queueOnFailure: false — a failed replay must stay as *this* entry so its attempt
    // count climbs, rather than reappearing as a fresh one that retries forever.
    const outcome = await processGameResult(entry.result, entry.extras, false);

    if (outcome.saved) {
      removeQueued(entry.id);
      synced += 1;
    } else {
      markAttempted(entry.id);
    }
  }

  return { synced, remaining: pendingCount(store.userId) };
}

export { UNIT_MASTERED_THRESHOLD };
