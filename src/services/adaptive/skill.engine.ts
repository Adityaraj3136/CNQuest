/**
 * Performance-based adaptive difficulty: a live estimate of how strong the student is, updated
 * after every answer, used to choose what comes next — in quizzes and in games.
 *
 * Model: a one-parameter IRT / Elo hybrid. Student ability θ and item difficulty b share one
 * logit scale, and P(correct) = 1 / (1 + e^-(θ − b)). After each answer θ moves by
 * k · (outcome − P): big steps while the estimate is new, smaller as evidence builds.
 * Answer time refines the outcome: a correct answer that used most of the clock is a shaky one.
 *
 * The next item is the one whose predicted success is closest to TARGET_SUCCESS (about 70%),
 * hard enough to stretch, easy enough to keep momentum. Games read the same θ as a 0–1
 * intensity and scale their own knobs (speed, unlock pace, run length) with it.
 *
 * Pure: no DOM, no storage. Relative imports only, so the Node test runner can load it.
 */

import type { Difficulty } from '../../models/content.ts';

export interface SkillState {
  /** Ability on the logit scale; 0 means a coin flip on a medium item. */
  theta: number;
  /** Answers the estimate is built on. Drives how fast it still moves. */
  answered: number;
}

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
export const ITEM_DIFFICULTY: Record<Difficulty, number> = { easy: -1, medium: 0, hard: 1 };

/** Predicted success the picker aims for. */
export const TARGET_SUCCESS = 0.7;
export const THETA_LIMIT = 3;
/** Step size for a brand-new estimate, the floor it decays to, and how fast it decays. */
export const K_START = 0.8;
export const K_MIN = 0.15;
export const K_DECAY_ANSWERS = 20;
/** Correct, but after this share of the time limit: counts as partly correct. */
export const HESITANT_TIME_RATIO = 0.8;
export const HESITANT_CREDIT = 0.75;
/** Range of θ mapped onto intensity 0–1; beyond it the game is already at its extreme. */
const INTENSITY_SPAN = 2;

export const NEW_SKILL: SkillState = { theta: 0, answered: 0 };

/**
 * What a game engine needs from an adaptive session: report each answer, then ask what to
 * play next. Engines call record() before choosing, so the pick reflects the latest answer.
 */
export interface AdaptivePicker {
  record(difficulty: Difficulty, isCorrect: boolean, timeRatio?: number): void;
  chooseNext<T extends { difficulty: Difficulty }>(rest: readonly T[]): number;
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
const logit = (p: number): number => Math.log(p / (1 - p));

export function successChance(theta: number, difficulty: Difficulty): number {
  return 1 / (1 + Math.exp(-(theta - ITEM_DIFFICULTY[difficulty])));
}

export function stepSize(answered: number): number {
  return Math.max(K_MIN, K_START / (1 + answered / K_DECAY_ANSWERS));
}

/**
 * A starting estimate from history recorded before this engine existed (topic accuracy).
 * It counts as some evidence, never as much as live answers, so it is quickly corrected.
 */
export function priorFromAccuracy(accuracy: number, attempted: number): SkillState {
  if (attempted <= 0) return NEW_SKILL;
  const rate = clamp(accuracy / 100, 0.1, 0.9);
  return { theta: logit(rate), answered: Math.min(attempted, K_DECAY_ANSWERS / 2) };
}

/**
 * Folds one answer into the estimate and returns the new state.
 * `timeRatio` is time taken over time allowed (0–1), when the mode has a clock.
 */
export function recordAnswer(
  state: SkillState,
  difficulty: Difficulty,
  isCorrect: boolean,
  timeRatio?: number,
): SkillState {
  const hesitant = isCorrect && timeRatio !== undefined && timeRatio >= HESITANT_TIME_RATIO;
  const outcome = isCorrect ? (hesitant ? HESITANT_CREDIT : 1) : 0;
  const expected = successChance(state.theta, difficulty);
  const theta = clamp(state.theta + stepSize(state.answered) * (outcome - expected), -THETA_LIMIT, THETA_LIMIT);
  return { theta, answered: state.answered + 1 };
}

/** The item difficulty at which this student is predicted to hit TARGET_SUCCESS. */
export function idealItemDifficulty(theta: number): number {
  return theta - logit(TARGET_SUCCESS);
}

/** The available level closest to the ideal. Ties go to the easier level. */
export function bestDifficulty(theta: number, available: readonly Difficulty[] = DIFFICULTIES): Difficulty {
  const ideal = idealItemDifficulty(theta);
  const pool = available.length ? available : DIFFICULTIES;
  return pool.reduce((best, level) =>
    Math.abs(ITEM_DIFFICULTY[level] - ideal) < Math.abs(ITEM_DIFFICULTY[best] - ideal) ? level : best,
  );
}

/** θ mapped to 0–1 for game knobs. A new student (θ 0) sits at 0.5, the game's default tuning. */
export function intensity(theta: number): number {
  return (clamp(theta, -INTENSITY_SPAN, INTENSITY_SPAN) + INTENSITY_SPAN) / (2 * INTENSITY_SPAN);
}

/** Index of the best-fitting item in `rest`; the first one wins among equals (pools come shuffled). */
export function chooseQuestion<T extends { difficulty: Difficulty }>(rest: readonly T[], theta: number): number {
  if (rest.length === 0) return -1;
  const available = DIFFICULTIES.filter((level) => rest.some((item) => item.difficulty === level));
  const target = bestDifficulty(theta, available);
  return rest.findIndex((item) => item.difficulty === target);
}

/**
 * Lets a picker decide which remaining item is played next: swaps its choice into slot `at`.
 * Engines call this whenever they advance, so they stay sequential and testable without one.
 */
export function promoteChoice<T>(items: T[], at: number, choose?: (rest: readonly T[]) => number): void {
  if (!choose || at >= items.length) return;
  const offset = choose(items.slice(at));
  if (offset <= 0 || at + offset >= items.length) return;
  [items[at], items[at + offset]] = [items[at + offset], items[at]];
}
