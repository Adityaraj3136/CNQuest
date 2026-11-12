/**
 * Live adaptive sessions: wraps the pure skill model with per-student persistence, so a game
 * picks up where the student's last round left off, on any device they sign in from.
 *
 * Scopes keep unrelated skills apart: answering quiz questions on DNS says little about
 * steering Packet Dash at speed. Question modes (Quiz, Rapid Fire, Boss) share one scope per
 * topic, so practice in any of them sharpens the others.
 */

import { activeStore } from '@/services/progress.store';
import { getUserState, resetSkills, saveSkill, userStateReady } from '@/services/user-state.store';
import type { Difficulty } from '@/models/content';
import {
  NEW_SKILL,
  bestDifficulty,
  chooseQuestion,
  intensity,
  priorFromAccuracy,
  recordAnswer,
  type SkillState,
} from '@/services/adaptive/skill.engine';

export interface AdaptiveSession {
  readonly scope: string;
  readonly skill: () => SkillState;
  /** Level the student should face next. */
  readonly difficulty: () => Difficulty;
  /** 0–1, 0.5 for a new student: for games to scale speed, pace or length. */
  readonly intensity: () => number;
  /** Feeds one answer back. `timeRatio` = time taken / time allowed, when there is a clock. */
  readonly record: (difficulty: Difficulty, isCorrect: boolean, timeRatio?: number) => void;
  /** Picker for promoteChoice(): index of the best-fitting remaining question. */
  readonly chooseNext: <T extends { difficulty: Difficulty }>(rest: readonly T[]) => number;
}

function storedSkill(scope: string): SkillState | null {
  const stamped = getUserState().skill[scope];
  return stamped ? { theta: stamped.theta, answered: stamped.answered } : null;
}

export function questionScope(topicId?: string): string {
  return `questions:${topicId ?? 'mixed'}`;
}

function sessionFor(scope: string, initial: SkillState): AdaptiveSession {
  let skill = initial;
  return {
    scope,
    skill: () => skill,
    difficulty: () => bestDifficulty(skill.theta),
    intensity: () => intensity(skill.theta),
    record(difficulty, isCorrect, timeRatio) {
      skill = recordAnswer(skill, difficulty, isCorrect, timeRatio);
      saveSkill(scope, skill); // synced to the student's other devices
    },
    chooseNext: (rest) => chooseQuestion(rest, skill.theta),
  };
}

/**
 * Opens an adaptive session. Without a stored estimate, a topic's recorded accuracy seeds it,
 * so a student with history does not restart from scratch.
 */
export async function startAdaptiveSession(scope: string, topicId?: string): Promise<AdaptiveSession> {
  await userStateReady(); // a new device picks up the estimate from the cloud first
  const stored = storedSkill(scope);
  if (stored) return sessionFor(scope, stored);

  let prior = NEW_SKILL;
  if (topicId) {
    try {
      const progress = await activeStore()?.loadTopicProgress(topicId);
      if (progress) prior = priorFromAccuracy(progress.accuracy, progress.attempted);
    } catch (error) {
      console.error('[adaptive] could not load topic history; starting from a fresh estimate', error);
    }
  }
  return sessionFor(scope, prior);
}

/** Forgets every adaptive estimate for the current student, on every device (Settings → reset). */
export function clearSkillEstimates(): void {
  resetSkills();
}
