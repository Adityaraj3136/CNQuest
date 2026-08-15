/**
 * Analytics derivations — pure functions over stored attempts and progress.
 * No I/O, no DOM, so every figure on the Progress screen is testable.
 */

import type { GameType } from '../models/content.ts';
import type { GameAttempt, UserProgress } from '../models/progress.ts';
import { daysBetween, toLocalDateKey } from './streak.logic.ts';

// ---------------------------------------------------------------- per-mode

export interface ModePerformance {
  gameType: GameType;
  sessions: number;
  questions: number;
  correct: number;
  /** Mean accuracy across attempted questions, not the mean of session accuracies. */
  accuracy: number;
  xpEarned: number;
  bestAccuracy: number;
}

/** One row per mode actually played, best-performing first. */
export function modePerformance(attempts: readonly GameAttempt[]): ModePerformance[] {
  const byMode = new Map<GameType, GameAttempt[]>();

  for (const attempt of attempts) {
    const bucket = byMode.get(attempt.gameType) ?? [];
    bucket.push(attempt);
    byMode.set(attempt.gameType, bucket);
  }

  return [...byMode.entries()]
    .map(([gameType, rows]) => {
      const questions = rows.reduce((sum, row) => sum + row.attempted, 0);
      const correct = rows.reduce((sum, row) => sum + row.correct, 0);

      return {
        gameType,
        sessions: rows.length,
        questions,
        correct,
        // Weighted by questions, so a 1-question round cannot skew the average.
        accuracy: questions === 0 ? 0 : Math.round((correct / questions) * 100),
        xpEarned: rows.reduce((sum, row) => sum + row.xpEarned, 0),
        bestAccuracy: rows.reduce((max, row) => Math.max(max, row.accuracy), 0),
      };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

// ---------------------------------------------------------------- time series

export interface DayPoint {
  /** `YYYY-MM-DD`, local. */
  date: string;
  /** Day of month, for axis labels. */
  label: string;
  xp: number;
  questions: number;
  correct: number;
  /** 0-100, or null on a day with no activity — a gap, not a zero. */
  accuracy: number | null;
}

/**
 * A continuous daily series ending today, including days with no activity.
 * Gaps matter: a chart that silently skips empty days misrepresents consistency.
 */
export function dailySeries(
  attempts: readonly GameAttempt[],
  days = 14,
  today: string = toLocalDateKey(),
): DayPoint[] {
  const buckets = new Map<string, { xp: number; questions: number; correct: number }>();

  for (const attempt of attempts) {
    const date = attempt.createdAt.slice(0, 10);
    const age = daysBetween(date, today);
    if (age < 0 || age >= days) continue;

    const bucket = buckets.get(date) ?? { xp: 0, questions: 0, correct: 0 };
    bucket.xp += attempt.xpEarned;
    bucket.questions += attempt.attempted;
    bucket.correct += attempt.correct;
    buckets.set(date, bucket);
  }

  const [year, month, day] = today.split('-').map(Number);
  const series: DayPoint[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1, day - offset));
    const key = date.toISOString().slice(0, 10);
    const bucket = buckets.get(key);

    series.push({
      date: key,
      label: String(date.getUTCDate()),
      xp: bucket?.xp ?? 0,
      questions: bucket?.questions ?? 0,
      correct: bucket?.correct ?? 0,
      accuracy:
        bucket && bucket.questions > 0 ? Math.round((bucket.correct / bucket.questions) * 100) : null,
    });
  }

  return series;
}

// ---------------------------------------------------------------- topic rankings

/** Strongest topics first; topics never attempted are excluded. */
export function strongestTopics(progress: readonly UserProgress[], limit = 3): UserProgress[] {
  return [...progress]
    .filter((entry) => entry.attempted > 0)
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, limit);
}

export interface AccuracySummary {
  questions: number;
  correct: number;
  accuracy: number;
}

/** Lifetime accuracy across every recorded topic. */
export function overallAccuracy(progress: readonly UserProgress[]): AccuracySummary {
  const questions = progress.reduce((sum, entry) => sum + entry.attempted, 0);
  const correct = progress.reduce((sum, entry) => sum + entry.correct, 0);

  return {
    questions,
    correct,
    accuracy: questions === 0 ? 0 : Math.round((correct / questions) * 100),
  };
}

/** Total time spent in games, in whole minutes. */
export function totalMinutesPlayed(attempts: readonly GameAttempt[]): number {
  return Math.round(attempts.reduce((sum, attempt) => sum + attempt.durationSeconds, 0) / 60);
}
