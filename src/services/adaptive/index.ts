/**
 * Adaptive layer entry point: builds the student state from storage and hands it to whichever
 * engine is active. Screens call `recommendNext()` and never see which engine answered.
 */

import { getTopics } from '@/services/content.service';
import { activeStore } from '@/services/progress.store';
import { toLocalDateKey } from '@/services/streak.logic';
import { getPreferences } from '@/state/preferences';
import { difficultyForAccuracy, ruleBasedEngine } from '@/services/adaptive/rule-based.engine';
import { QLearningAdaptiveEngine } from '@/services/adaptive/q-learning.engine';
import type { QTable, QTableStore } from '@/services/adaptive/q-learning.engine';
import type {
  AdaptiveLearningEngine,
  LearningOutcome,
  Recommendation,
  StudentLearningState,
} from '@/services/adaptive/adaptive.types';
import { STRUGGLE_ACCURACY } from '@/services/adaptive/adaptive.types';
import type { Difficulty } from '@/models/content';
import type { GameAttempt, UserProgress } from '@/models/progress';

const Q_TABLE_KEY = 'cn-quest.q-table';
/** Rounds considered "recent" when measuring accuracy, pace and repeated failure. */
const RECENT_ROUNDS = 5;

const qTableStore: QTableStore = {
  load(): QTable {
    try {
      const raw = localStorage.getItem(Q_TABLE_KEY);
      return raw ? (JSON.parse(raw) as QTable) : {};
    } catch (error) {
      console.error('[adaptive] Q-table unreadable, starting fresh', error);
      localStorage.removeItem(Q_TABLE_KEY);
      return {};
    }
  },
  save(table: QTable): void {
    try {
      localStorage.setItem(Q_TABLE_KEY, JSON.stringify(table));
    } catch (error) {
      console.error('[adaptive] could not persist Q-table', error);
    }
  },
};

const qLearningEngine = new QLearningAdaptiveEngine(qTableStore);

/** The engine currently in charge. Q-learning is opt-in from Settings. */
export function activeEngine(): AdaptiveLearningEngine {
  return getPreferences().experimentalAdaptive ? qLearningEngine : ruleBasedEngine;
}

export function clearLearnedPolicy(): void {
  localStorage.removeItem(Q_TABLE_KEY);
}

/** How many state/action pairs the policy has learned — shown in Settings. */
export function learnedPolicySize(): number {
  return Object.values(qTableStore.load()).reduce(
    (sum, row) => sum + Object.keys(row ?? {}).length,
    0,
  );
}

/** Projects stored progress and recent attempts into the engine's input shape. */
export function buildStudentState(
  progress: readonly UserProgress[],
  attempts: readonly GameAttempt[],
  options: {
    currentStreak: number;
    lastActiveDate?: string;
    syllabusOrder: string[];
    topicTitles: Record<string, string>;
    currentDifficulty?: Difficulty;
    today?: string;
  },
): StudentLearningState {
  const topicMastery: Record<string, number> = {};
  const topicAccuracy: Record<string, number> = {};
  const topicAttempts: Record<string, number> = {};

  for (const entry of progress) {
    topicMastery[entry.topicId] = entry.mastery;
    topicAccuracy[entry.topicId] = entry.accuracy;
    topicAttempts[entry.topicId] = entry.attempted;
  }

  const recent = [...attempts]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, RECENT_ROUNDS);

  const recentQuestions = recent.reduce((sum, attempt) => sum + attempt.attempted, 0);
  const recentCorrect = recent.reduce((sum, attempt) => sum + attempt.correct, 0);
  const recentSeconds = recent.reduce((sum, attempt) => sum + attempt.durationSeconds, 0);

  // Consecutive weak rounds, counted back from the newest.
  let consecutiveWeakRounds = 0;
  for (const attempt of recent) {
    if (attempt.attempted > 0 && attempt.accuracy < STRUGGLE_ACCURACY) consecutiveWeakRounds += 1;
    else break;
  }

  const incorrectTopics = [...progress]
    .filter((entry) => entry.attempted > 0 && entry.accuracy < STRUGGLE_ACCURACY)
    .sort((a, b) => a.accuracy - b.accuracy)
    .map((entry) => entry.topicId);

  const recentAccuracy = recentQuestions === 0 ? 0 : Math.round((recentCorrect / recentQuestions) * 100);

  return {
    topicMastery,
    topicAccuracy,
    topicAttempts,
    recentAccuracy,
    recentResponseTime: recentQuestions === 0 ? 0 : recentSeconds / recentQuestions,
    incorrectTopics,
    consecutiveWeakRounds,
    currentDifficulty: options.currentDifficulty ?? 'medium',
    currentStreak: options.currentStreak,
    ...(options.lastActiveDate ? { lastActiveDate: options.lastActiveDate } : {}),
    today: options.today ?? toLocalDateKey(),
    syllabusOrder: options.syllabusOrder,
    topicTitles: options.topicTitles,
  };
}

/** Loads everything the engine needs and returns its recommendation. */
export async function recommendNext(): Promise<Recommendation | null> {
  const store = activeStore();
  if (!store) return null;

  const [profile, progress, attempts, topics] = await Promise.all([
    store.loadProfile(),
    store.loadAllProgress(),
    store.loadAttempts(RECENT_ROUNDS),
    getTopics(),
  ]);

  if (!profile) return null;

  const ordered = [...topics].sort((a, b) => a.order - b.order);
  const state = buildStudentState(progress, attempts, {
    currentStreak: profile.currentStreak,
    ...(profile.lastActiveDate ? { lastActiveDate: profile.lastActiveDate } : {}),
    syllabusOrder: ordered.map((topic) => topic.id),
    topicTitles: Object.fromEntries(ordered.map((topic) => [topic.id, topic.title])),
  });

  return activeEngine().recommendNextActivity(state);
}

/**
 * Suggests the difficulty for a topic about to be played, when the student has not chosen one.
 * Falls back to medium if nothing is known.
 */
export async function suggestDifficulty(topicId: string): Promise<Difficulty | null> {
  const store = activeStore();
  if (!store) return null;

  try {
    const progress = await store.loadTopicProgress(topicId);
    if (!progress || progress.attempted === 0) return null;
    return difficultyForAccuracy(progress.accuracy);
  } catch (error) {
    console.error('[adaptive] could not suggest a difficulty', error);
    return null;
  }
}

/** Feeds a finished round back to the engine. A no-op for the rule-based engine. */
export function observeOutcome(outcome: LearningOutcome): void {
  activeEngine().observeOutcome?.(outcome);
}
