/**
 * Dashboard insights — pure derivations from stored progress, no I/O.
 * Recommendations moved out in Phase 11; see services/adaptive/.
 */

import type { Topic } from '../models/content.ts';
import type { GameAttempt, UserProgress } from '../models/progress.ts';
import { daysBetween, toLocalDateKey } from './streak.logic.ts';
import { unitMastery } from './mastery.logic.ts';

// ---------------------------------------------------------------- overall progress

/**
 * Overall course completion: the mean mastery across **every** topic in the syllabus.
 * Topics never attempted count as 0 — otherwise answering one question on one topic would
 * read as 100% of the course.
 */
export function overallProgress(progress: readonly UserProgress[], totalTopics: number): number {
  if (totalTopics <= 0) return 0;
  const total = progress.reduce((sum, entry) => sum + entry.mastery, 0);
  return Math.max(0, Math.min(100, Math.round(total / totalTopics)));
}

export interface UnitBreakdown {
  unitId: string;
  mastery: number;
  topicsStarted: number;
  topicsTotal: number;
}

export function unitBreakdown(
  progress: readonly UserProgress[],
  topics: readonly Topic[],
): UnitBreakdown[] {
  const byUnit = new Map<string, { masteries: number[]; total: number }>();

  for (const topic of topics) {
    const entry = byUnit.get(topic.unitId) ?? { masteries: [], total: 0 };
    entry.total += 1;
    byUnit.set(topic.unitId, entry);
  }
  for (const entry of progress) {
    byUnit.get(entry.unitId)?.masteries.push(entry.mastery);
  }

  return [...byUnit.entries()].map(([unitId, { masteries, total }]) => ({
    unitId,
    mastery: unitMastery(masteries, total),
    topicsStarted: masteries.length,
    topicsTotal: total,
  }));
}

// ---------------------------------------------------------------- recent activity

export interface RecentPerformance {
  games: number;
  questions: number;
  correct: number;
  accuracy: number;
  xpEarned: number;
}

/** Totals over attempts from the last `days` calendar days, today included. */
export function recentPerformance(
  attempts: readonly GameAttempt[],
  days = 7,
  today: string = toLocalDateKey(),
): RecentPerformance {
  const recent = attempts.filter((attempt) => {
    const key = attempt.createdAt.slice(0, 10);
    const age = daysBetween(key, today);
    return age >= 0 && age < days;
  });

  const questions = recent.reduce((sum, attempt) => sum + attempt.attempted, 0);
  const correct = recent.reduce((sum, attempt) => sum + attempt.correct, 0);

  return {
    games: recent.length,
    questions,
    correct,
    accuracy: questions === 0 ? 0 : Math.round((correct / questions) * 100),
    xpEarned: recent.reduce((sum, attempt) => sum + attempt.xpEarned, 0),
  };
}

/** The topic of the most recent attempt, ignoring mixed-topic rounds. */
export function lastActiveTopicId(attempts: readonly GameAttempt[]): string | null {
  const sorted = [...attempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sorted.find((attempt) => attempt.topicId && attempt.topicId !== 'mixed')?.topicId ?? null;
}

// The recommender that used to live here is now services/adaptive/rule-based.engine.ts,
// behind the AdaptiveLearningEngine interface. Keeping a second copy here would have meant
// two sources of truth for "what should this student do next".

// ---------------------------------------------------------------- daily quest

/** Correct answers needed to clear the daily quest, and what clearing it pays. */
export const DAILY_QUEST_TARGET = 10;
export const DAILY_QUEST_REWARD_XP = 75;

export interface DailyQuest {
  target: number;
  /** Correct answers so far today, capped at the target so the bar cannot overfill. */
  progress: number;
  percent: number;
  complete: boolean;
  rewardXp: number;
}

/**
 * Progress towards today's quest, measured in correct answers rather than rounds played.
 *
 * Counting rounds would reward opening and abandoning games; counting correct answers only
 * moves when the student actually knew something. "Today" is the local calendar date, the
 * same rule the streak uses, so the two can never disagree about when a day ended.
 */
export function dailyQuest(
  attempts: readonly GameAttempt[],
  today: Date = new Date(),
  target: number = DAILY_QUEST_TARGET,
): DailyQuest {
  const key = toLocalDateKey(today);

  const correctToday = attempts
    .filter((attempt) => toLocalDateKey(new Date(attempt.createdAt)) === key)
    .reduce((sum, attempt) => sum + attempt.correct, 0);

  const progress = Math.min(correctToday, target);

  return {
    target,
    progress,
    percent: target === 0 ? 0 : Math.round((progress / target) * 100),
    complete: correctToday >= target,
    rewardXp: DAILY_QUEST_REWARD_XP,
  };
}
