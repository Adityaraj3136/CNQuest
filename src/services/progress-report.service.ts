/**
 * Assembles the Progress screen's report in one pass of parallel reads.
 */

import { getAchievements, getTopics, getUnits } from '@/services/content.service';
import { activeStore, countersOf } from '@/services/progress.store';
import { weakestTopics } from '@/services/mastery.logic';
import { overallProgress, unitBreakdown } from '@/services/insights.logic';
import {
  dailySeries,
  modePerformance,
  overallAccuracy,
  strongestTopics,
  totalMinutesPlayed,
} from '@/services/analytics.logic';
import type { DayPoint, ModePerformance } from '@/services/analytics.logic';
import type { Topic, Unit } from '@/models/content';
import type { GameAttempt, UserProgress } from '@/models/progress';
import type { UserProfile } from '@/models/user';

export interface TopicRow {
  topic: Topic;
  progress: UserProgress | null;
}

export interface UnitRow {
  unit: Unit;
  mastery: number;
  topicsStarted: number;
  topicsTotal: number;
  topics: TopicRow[];
}

export interface ProgressReport {
  profile: UserProfile;

  overallCompletion: number;
  overallAccuracy: number;
  questionsAnswered: number;
  correctAnswers: number;
  minutesPlayed: number;
  bossWins: number;
  achievementsUnlocked: number;
  achievementsTotal: number;

  units: UnitRow[];
  weakest: Array<{ topic: Topic | undefined; progress: UserProgress }>;
  strongest: Array<{ topic: Topic | undefined; progress: UserProgress }>;
  modes: ModePerformance[];
  series: DayPoint[];
  recentAttempts: GameAttempt[];
}

const SERIES_DAYS = 14;
const ATTEMPT_WINDOW = 60;
const RECENT_LIMIT = 8;

export async function loadProgressReport(): Promise<ProgressReport | null> {
  const store = activeStore();
  if (!store) return null;

  const [profile, progress, attempts, topics, units, achievements, held] = await Promise.all([
    store.loadProfile(),
    store.loadAllProgress(),
    store.loadAttempts(ATTEMPT_WINDOW),
    getTopics(),
    getUnits(),
    getAchievements(),
    store.loadUnlockedAchievements(),
  ]);

  if (!profile) return null;

  const progressByTopic = new Map(progress.map((entry) => [entry.topicId, entry]));
  const breakdown = new Map(unitBreakdown(progress, topics).map((row) => [row.unitId, row]));

  const unitRows: UnitRow[] = units.map((unit) => {
    const row = breakdown.get(unit.id);
    return {
      unit,
      mastery: row?.mastery ?? 0,
      topicsStarted: row?.topicsStarted ?? 0,
      topicsTotal: row?.topicsTotal ?? 0,
      topics: topics
        .filter((topic) => topic.unitId === unit.id)
        .sort((a, b) => a.order - b.order)
        .map((topic) => ({ topic, progress: progressByTopic.get(topic.id) ?? null })),
    };
  });

  const withTopic = (entry: UserProgress) => ({
    topic: topics.find((topic) => topic.id === entry.topicId),
    progress: entry,
  });

  const accuracy = overallAccuracy(progress);

  return {
    profile,
    overallCompletion: overallProgress(progress, topics.length),
    overallAccuracy: accuracy.accuracy,
    questionsAnswered: profile.questionsAnswered,
    correctAnswers: profile.correctAnswers,
    minutesPlayed: totalMinutesPlayed(attempts),
    bossWins: countersOf(profile).bossWins,
    achievementsUnlocked: new Set(held).size,
    achievementsTotal: achievements.length,
    units: unitRows,
    weakest: weakestTopics(progress, 3).map(withTopic),
    strongest: strongestTopics(progress, 3).map(withTopic),
    modes: modePerformance(attempts),
    series: dailySeries(attempts, SERIES_DAYS),
    recentAttempts: [...attempts]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, RECENT_LIMIT),
  };
}

/** Topic progress for a single topic — used by the topic detail page's mastery bar. */
export async function loadTopicProgress(topicId: string): Promise<UserProgress | null> {
  const store = activeStore();
  if (!store) return null;

  try {
    return await store.loadTopicProgress(topicId);
  } catch (error) {
    console.error('[progress] could not read topic progress', error);
    return null;
  }
}
