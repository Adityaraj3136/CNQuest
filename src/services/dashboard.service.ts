/**
 * Assembles everything the dashboard shows in one pass.
 *
 * One call, one set of parallel reads — the dashboard must not fan out a query per widget.
 */

import { getAchievements, getTopic, getTopics } from '@/services/content.service';
import { activeStore, countersOf } from '@/services/progress.store';
import { weakestTopics } from '@/services/mastery.logic';
import { achievementProgress } from '@/services/achievement.logic';
import { isStreakExpired } from '@/services/streak.logic';
import { lastActiveTopicId, overallProgress, recentPerformance } from '@/services/insights.logic';
import { activeEngine, buildStudentState } from '@/services/adaptive';
import type { RecentPerformance } from '@/services/insights.logic';
import type { Recommendation } from '@/services/adaptive/adaptive.types';
import type { Achievement, Topic } from '@/models/content';
import type { UserProgress } from '@/models/progress';
import type { UserProfile } from '@/models/user';

export interface WeakTopic {
  topic: Topic | undefined;
  progress: UserProgress;
}

export interface DashboardData {
  profile: UserProfile;
  /** True when the stored streak has lapsed and should be shown as at risk. */
  streakAtRisk: boolean;

  overallCompletion: number;
  topicsStarted: number;
  topicsTotal: number;

  continueTopic: Topic | null;
  weakTopics: WeakTopic[];
  week: RecentPerformance;
  recommendation: Recommendation;
  recommendedTopic: Topic | null;
  recentAchievements: Achievement[];
  achievementsUnlocked: number;
  achievementsTotal: number;
}

const WEAK_TOPIC_LIMIT = 3;
const RECENT_ACHIEVEMENT_LIMIT = 4;
const ATTEMPT_WINDOW = 30;

/** Returns null when nobody is signed in (guest or account). */
export async function loadDashboard(): Promise<DashboardData | null> {
  const store = activeStore();
  if (!store) return null;

  const [profile, progress, attempts, topics, catalogue, held] = await Promise.all([
    store.loadProfile(),
    store.loadAllProgress(),
    store.loadAttempts(ATTEMPT_WINDOW),
    getTopics(),
    getAchievements(),
    store.loadUnlockedAchievements(),
  ]);

  if (!profile) return null;

  const streakState = {
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    ...(profile.lastActiveDate ? { lastActiveDate: profile.lastActiveDate } : {}),
  };

  const ordered = [...topics].sort((a, b) => a.order - b.order);
  const recommendation = activeEngine().recommendNextActivity(
    buildStudentState(progress, attempts, {
      currentStreak: profile.currentStreak,
      ...(profile.lastActiveDate ? { lastActiveDate: profile.lastActiveDate } : {}),
      syllabusOrder: ordered.map((topic) => topic.id),
      topicTitles: Object.fromEntries(ordered.map((topic) => [topic.id, topic.title])),
    }),
  );

  const continueTopicId = lastActiveTopicId(attempts);
  const [continueTopic, recommendedTopic] = await Promise.all([
    continueTopicId ? getTopic(continueTopicId) : Promise.resolve(null),
    recommendation.topicId ? getTopic(recommendation.topicId) : Promise.resolve(null),
  ]);

  const counters = countersOf(profile);
  const heldSet = new Set(held);
  const recentAchievements = achievementProgress(
    catalogue,
    {
      totalCorrectAnswers: profile.correctAnswers,
      totalGamesPlayed: profile.gamesPlayed,
      currentStreak: profile.currentStreak,
      bossWins: counters.bossWins,
      riddlesSolvedWithoutHint: counters.riddlesSolvedWithoutHint,
      dictionaryTermsViewed: counters.dictionaryTermsViewed,
      modesPlayed: counters.modesPlayed,
      unitsMastered: 0,
    },
    held,
  )
    .filter((row) => row.unlocked)
    .slice(0, RECENT_ACHIEVEMENT_LIMIT)
    .map((row) => row.achievement);

  return {
    profile,
    streakAtRisk: isStreakExpired(streakState),
    overallCompletion: overallProgress(progress, topics.length),
    topicsStarted: progress.filter((entry) => entry.attempted > 0).length,
    topicsTotal: topics.length,
    continueTopic,
    weakTopics: weakestTopics(progress, WEAK_TOPIC_LIMIT).map((entry) => ({
      topic: topics.find((topic) => topic.id === entry.topicId),
      progress: entry,
    })),
    week: recentPerformance(attempts),
    recommendation,
    recommendedTopic,
    recentAchievements,
    achievementsUnlocked: heldSet.size,
    achievementsTotal: catalogue.length,
  };
}
