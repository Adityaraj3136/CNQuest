/**
 * The adaptive learning contract.
 *
 * Games and screens depend on this interface, never on a particular implementation. That is
 * what lets the rule-based Version 1 be swapped for a learned policy later without touching a
 * single game module — the requirement the specification is explicit about.
 *
 * No imports beyond types, so the Node test runner can load it directly.
 */

import type { Difficulty, GameType } from '../../models/content.ts';

/** Everything the engine is allowed to see about a student. */
export interface StudentLearningState {
  /** topicId → mastery 0-100. Only topics with recorded activity appear. */
  topicMastery: Record<string, number>;
  /** topicId → accuracy 0-100 over that topic's whole history. */
  topicAccuracy: Record<string, number>;
  /** topicId → questions attempted. Distinguishes "weak" from "barely tried". */
  topicAttempts: Record<string, number>;

  /** Accuracy 0-100 across the recent window, across all topics. */
  recentAccuracy: number;
  /** Mean seconds per question in the recent window; 0 when unknown. */
  recentResponseTime: number;
  /** Topics the student has recently answered badly, worst first. */
  incorrectTopics: string[];
  /** Consecutive recent rounds scoring below the struggle threshold. */
  consecutiveWeakRounds: number;

  currentDifficulty: Difficulty;
  currentStreak: number;
  /** Local date key of the last qualifying activity, if any. */
  lastActiveDate?: string;
  today: string;

  /** Topic ids in syllabus order — needed to suggest what comes next. */
  syllabusOrder: string[];
  /** topicId → title, for human-readable reasons. */
  topicTitles: Record<string, string>;
}

export type RecommendedAction =
  | 'start-first-topic'
  | 'keep-streak-alive'
  | 'revise-weak-topic'
  | 'practise-weak-topic'
  | 'slow-down'
  | 'push-difficulty'
  | 'advance-to-new-topic'
  | 'change-game-mode';

export interface Recommendation {
  action: RecommendedAction;
  topicId: string | null;
  gameType: GameType;
  difficulty: Difficulty;
  /** One sentence shown to the student. Never empty — an unexplained nudge is not usable. */
  reason: string;
  /** Which engine produced this, surfaced in the UI for transparency. */
  source: 'rules' | 'q-learning';
}

export interface AdaptiveLearningEngine {
  readonly id: 'rules' | 'q-learning';
  readonly label: string;
  recommendNextActivity(state: StudentLearningState): Recommendation;
  /**
   * Optional feedback channel. A learning policy uses it to update itself; the rule-based
   * engine ignores it entirely.
   */
  observeOutcome?(outcome: LearningOutcome): void;
}

/** What actually happened after a recommendation was followed. */
export interface LearningOutcome {
  topicId: string;
  difficulty: Difficulty;
  gameType: GameType;
  accuracy: number;
  /** Mastery before and after the round, so improvement can be rewarded. */
  masteryBefore: number;
  masteryAfter: number;
  attempted: number;
}

/** Accuracy at or below this counts as struggling. */
export const STRUGGLE_ACCURACY = 50;
/** Accuracy above this counts as comfortable. */
export const CONFIDENT_ACCURACY = 75;
/** Mastery at or above this means a topic no longer needs drilling. */
export const SECURE_MASTERY = 80;
/** Below this many attempts, a topic's accuracy is too noisy to act on strongly. */
export const MIN_MEANINGFUL_ATTEMPTS = 5;
/** Answering faster than this while getting things wrong suggests guessing. */
export const RUSHED_SECONDS_PER_QUESTION = 4;
