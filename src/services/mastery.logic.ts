/**
 * Topic mastery — pure calculation, no storage.
 * Transparent by design: every number here can be explained in a viva.
 */

import {
  COMPLETION_TARGET_RATIO,
  MASTERY_BANDS,
  MASTERY_WEIGHTS,
  UNIT_MASTERED_THRESHOLD,
} from '../config/progress.config.ts';
import type { MasteryBand } from '../config/progress.config.ts';
import type { UserProgress } from '../models/progress.ts';

export interface MasteryInput {
  attempted: number;
  correct: number;
  /** Total questions available for the topic. */
  questionPool: number;
}

export interface MasteryResult {
  accuracy: number;
  completion: number;
  mastery: number;
  band: MasteryBand;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateMastery({ attempted, correct, questionPool }: MasteryInput): MasteryResult {
  const safeAttempted = Math.max(0, attempted);
  const safeCorrect = Math.max(0, Math.min(correct, safeAttempted));

  const accuracy = safeAttempted === 0 ? 0 : (safeCorrect / safeAttempted) * 100;

  // Completion is capped at 100 — re-answering the same bank cannot push a topic past done.
  const target = Math.max(1, questionPool * COMPLETION_TARGET_RATIO);
  const completion = Math.min(100, (safeAttempted / target) * 100);

  const mastery = MASTERY_WEIGHTS.accuracy * accuracy + MASTERY_WEIGHTS.completion * completion;

  return {
    accuracy: clampPercent(accuracy),
    completion: clampPercent(completion),
    mastery: clampPercent(mastery),
    band: masteryBand(mastery),
  };
}

export function masteryBand(mastery: number): MasteryBand {
  return MASTERY_BANDS.find((entry) => mastery >= entry.min)?.band ?? 'Beginner';
}

/** Folds a finished round into an existing topic progress record. */
export function mergeProgress(
  previous: UserProgress | null,
  round: { userId: string; topicId: string; unitId: string; attempted: number; correct: number },
  questionPool: number,
  at: string = new Date().toISOString(),
): UserProgress {
  const attempted = (previous?.attempted ?? 0) + round.attempted;
  const correct = (previous?.correct ?? 0) + round.correct;
  const { accuracy, completion, mastery } = calculateMastery({ attempted, correct, questionPool });

  return {
    userId: round.userId,
    topicId: round.topicId,
    unitId: round.unitId,
    attempted,
    correct,
    accuracy,
    completion,
    mastery,
    lastAttemptAt: at,
  };
}

/** Unit mastery is the mean of its topics' mastery; topics never attempted count as 0. */
export function unitMastery(topicMasteries: readonly number[], topicCount: number): number {
  if (topicCount <= 0) return 0;
  const total = topicMasteries.reduce((sum, value) => sum + value, 0);
  return clampPercent(total / topicCount);
}

export function isUnitMastered(mastery: number): boolean {
  return mastery >= UNIT_MASTERED_THRESHOLD;
}

/** Weakest topics first — what the dashboard and the adaptive engine both need. */
export function weakestTopics(progress: readonly UserProgress[], limit = 3): UserProgress[] {
  return [...progress]
    .filter((entry) => entry.attempted > 0)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, limit);
}
