/**
 * Standard result every game mode produces.
 *
 * Games only produce this object — they never touch XP, levels, streaks, progress or
 * achievements. Phase 5's GameResultService takes it from here.
 *
 * No imports, so the Node test runner and the seed script can load it directly.
 */

import type { Difficulty, GameType } from './content.ts';

export interface GameResult {
  gameType: GameType;
  unitId?: string;
  topicId: string;

  attempted: number;
  correct: number;
  wrong: number;

  /** Raw score — for question games this is the number of correct answers. */
  score: number;
  /** 0-100, rounded. */
  accuracy: number;

  xpEarned: number;
  durationSeconds: number;

  difficulty?: Difficulty | 'mixed';
  /** Longest run of consecutive correct answers in this round. */
  bestStreak?: number;
}

/** One answered question, kept in memory for the review screen. */
export interface AnsweredQuestion {
  questionId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  /** null when the timer ran out before an answer was chosen. */
  selectedAnswer: number | null;
  isCorrect: boolean;
  explanation: string;
  difficulty: Difficulty;
  timeTakenMs: number;
  xpEarned: number;
}

/** A finished round: the persisted result plus the per-question detail. */
export interface GameSummary {
  result: GameResult;
  answers: AnsweredQuestion[];
}
