/**
 * Adaptive engine, Version 1 — transparent rules.
 *
 * Every decision can be read off the code and explained in one sentence, which is the point:
 * a student sees *why* they were sent somewhere, and an examiner can follow the logic without
 * inspecting a model. Version 2 lives in q-learning.engine.ts and is opt-in.
 */

import type {
  AdaptiveLearningEngine,
  Recommendation,
  StudentLearningState,
} from './adaptive.types.ts';
import {
  CONFIDENT_ACCURACY,
  MIN_MEANINGFUL_ATTEMPTS,
  RUSHED_SECONDS_PER_QUESTION,
  SECURE_MASTERY,
  STRUGGLE_ACCURACY,
} from './adaptive.types.ts';
import type { Difficulty } from '../../models/content.ts';
import { daysBetween } from '../streak.logic.ts';

/** The spec's ladder: below 50% easy, 50-75% medium, above 75% hard. */
export function difficultyForAccuracy(accuracy: number): Difficulty {
  if (accuracy < STRUGGLE_ACCURACY) return 'easy';
  if (accuracy <= CONFIDENT_ACCURACY) return 'medium';
  return 'hard';
}

function weakestTopicId(state: StudentLearningState): string | null {
  const entries = Object.entries(state.topicMastery).filter(
    ([topicId]) => (state.topicAttempts[topicId] ?? 0) > 0,
  );
  if (entries.length === 0) return null;

  return entries.sort(([, a], [, b]) => a - b)[0][0];
}

function titleOf(state: StudentLearningState, topicId: string | null): string {
  if (!topicId) return 'this topic';
  return state.topicTitles[topicId] ?? topicId;
}

export class RuleBasedAdaptiveEngine implements AdaptiveLearningEngine {
  readonly id = 'rules' as const;
  readonly label = 'Rule-based (transparent)';

  /**
   * Priority order, highest first:
   *   1. Nothing attempted        → start at the first topic
   *   2. Streak lapsing today     → play anything, now
   *   3. Rushing and missing      → slow down, drop to easy
   *   4. Repeated weak rounds     → revise the weakest topic at easy
   *   5. A genuinely weak topic   → revise it at easy
   *   6. Everything secure        → advance to an untouched topic
   *   7. Comfortable              → push the difficulty up
   *   8. Otherwise                → keep practising at the matching level
   */
  recommendNextActivity(state: StudentLearningState): Recommendation {
    const attemptedTopics = Object.keys(state.topicAttempts).filter(
      (topicId) => state.topicAttempts[topicId] > 0,
    );

    if (attemptedTopics.length === 0) {
      const first = state.syllabusOrder[0] ?? null;
      return {
        action: 'start-first-topic',
        topicId: first,
        gameType: 'quiz',
        difficulty: 'easy',
        source: 'rules',
        reason: first
          ? `Start with ${titleOf(state, first)}. It opens the syllabus.`
          : 'Pick any topic to start tracking your mastery.',
      };
    }

    const weakest = weakestTopicId(state);
    const weakestAccuracy = weakest ? (state.topicAccuracy[weakest] ?? 0) : 0;
    const weakestMastery = weakest ? (state.topicMastery[weakest] ?? 0) : 0;

    // A streak about to lapse is the only time-critical thing on the screen.
    const lapsingToday =
      state.currentStreak > 0 &&
      state.lastActiveDate !== undefined &&
      daysBetween(state.lastActiveDate, state.today) === 1;

    if (lapsingToday) {
      return {
        action: 'keep-streak-alive',
        topicId: weakest,
        gameType: 'quiz',
        difficulty: difficultyForAccuracy(weakestAccuracy),
        source: 'rules',
        reason: `One round today keeps your ${state.currentStreak} day streak alive.`,
      };
    }

    // Fast *and* wrong is guessing, not difficulty — slowing down beats dropping content.
    const rushing =
      state.recentResponseTime > 0 &&
      state.recentResponseTime < RUSHED_SECONDS_PER_QUESTION &&
      state.recentAccuracy < STRUGGLE_ACCURACY;

    if (rushing) {
      return {
        action: 'slow-down',
        topicId: weakest,
        gameType: 'quiz',
        difficulty: 'easy',
        source: 'rules',
        reason: `You are answering in about ${Math.round(state.recentResponseTime)}s at ${state.recentAccuracy}% accuracy. Slow down and read each option.`,
      };
    }

    if (state.consecutiveWeakRounds >= 2) {
      return {
        action: 'revise-weak-topic',
        topicId: weakest,
        gameType: 'quiz',
        difficulty: 'easy',
        source: 'rules',
        reason: `Two weak rounds in a row. Go back over ${titleOf(state, weakest)} with easy questions before pushing on.`,
      };
    }

    if (weakest && weakestAccuracy < STRUGGLE_ACCURACY) {
      return {
        action: 'revise-weak-topic',
        topicId: weakest,
        gameType: 'quiz',
        difficulty: 'easy',
        source: 'rules',
        reason: `Revise ${titleOf(state, weakest)}: accuracy there is ${weakestAccuracy}%. Easy questions first.`,
      };
    }

    // Everything tried is secure: widen rather than grind.
    const untouched = state.syllabusOrder.find((topicId) => !(state.topicAttempts[topicId] > 0));

    if (weakestMastery >= SECURE_MASTERY && untouched) {
      return {
        action: 'advance-to-new-topic',
        topicId: untouched,
        gameType: 'quiz',
        difficulty: 'medium',
        source: 'rules',
        reason: `Everything you have tried sits at ${weakestMastery}% or above. Move on to ${titleOf(state, untouched)}.`,
      };
    }

    const enoughEvidence = weakest ? (state.topicAttempts[weakest] ?? 0) >= MIN_MEANINGFUL_ATTEMPTS : false;

    if (weakest && weakestAccuracy > CONFIDENT_ACCURACY && enoughEvidence) {
      return {
        action: 'push-difficulty',
        topicId: weakest,
        gameType: 'quiz',
        difficulty: 'hard',
        source: 'rules',
        reason: `${weakestAccuracy}% on ${titleOf(state, weakest)} over ${state.topicAttempts[weakest]} questions. Step up to hard.`,
      };
    }

    return {
      action: 'practise-weak-topic',
      topicId: weakest,
      gameType: 'quiz',
      difficulty: difficultyForAccuracy(weakestAccuracy),
      source: 'rules',
      reason: `Keep working on ${titleOf(state, weakest)}: ${weakestAccuracy}% accuracy, ${weakestMastery}% mastery.`,
    };
  }
}

export const ruleBasedEngine = new RuleBasedAdaptiveEngine();
