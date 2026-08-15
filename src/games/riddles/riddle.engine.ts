/**
 * Network Riddles — type the protocol or device the clue describes.
 *
 * Hints are the interesting mechanic: each one reduces the XP that riddle can still pay,
 * so a hint is a real trade rather than a free win.
 */

import type { Riddle } from '../../models/content.ts';
import type { GameResult, GameSummary } from '../../models/game.ts';
import { BASE_XP, RIDDLE_HINT_PENALTY, calculateRoundXp } from '../../config/xp.config.ts';
import { isRiddleAnswerCorrect } from '../../services/content.filters.ts';

export type RiddleStatus = 'asking' | 'feedback' | 'finished';

export interface RiddleAttempt {
  riddleId: string;
  question: string;
  answer: string;
  given: string;
  isCorrect: boolean;
  hintsUsed: number;
  xpEarned: number;
}

export interface RiddleView {
  status: RiddleStatus;
  riddle: Riddle;
  index: number;
  total: number;
  revealedHints: string[];
  hintsRemaining: number;
  /** XP this riddle can still pay, after the hints already taken. */
  xpAtStake: number;
  score: number;
  lastAttempt: RiddleAttempt | null;
}

export interface RiddleOptions {
  now?: () => number;
}

/** XP still available after `hintsUsed` hints, floored so a solve is always worth something. */
export function xpForRiddle(hintsUsed: number): number {
  return Math.max(RIDDLE_HINT_PENALTY, BASE_XP.riddleSolved - hintsUsed * RIDDLE_HINT_PENALTY);
}

export class RiddleEngine {
  private readonly riddles: Riddle[];
  private readonly now: () => number;
  private readonly startedAt: number;

  private index = 0;
  private status: RiddleStatus = 'asking';
  private hintsUsed = 0;
  private readonly attempts: RiddleAttempt[] = [];
  private currentStreak = 0;
  private bestStreak = 0;
  private finishedAt: number | null = null;

  constructor(riddles: readonly Riddle[], options: RiddleOptions = {}) {
    if (riddles.length === 0) throw new Error('RiddleEngine needs at least one riddle.');
    this.riddles = [...riddles];
    this.now = options.now ?? (() => Date.now());
    this.startedAt = this.now();
  }

  view(): RiddleView {
    const riddle = this.riddles[Math.min(this.index, this.riddles.length - 1)];
    return {
      status: this.status,
      riddle,
      index: Math.min(this.index + 1, this.riddles.length),
      total: this.riddles.length,
      revealedHints: riddle.hints.slice(0, this.hintsUsed),
      hintsRemaining: Math.max(0, riddle.hints.length - this.hintsUsed),
      xpAtStake: xpForRiddle(this.hintsUsed),
      score: this.attempts.filter((attempt) => attempt.isCorrect).length,
      lastAttempt: this.status === 'feedback' ? (this.attempts.at(-1) ?? null) : null,
    };
  }

  /** Reveals the next hint and lowers the XP still on offer. Returns null when none are left. */
  useHint(): string | null {
    if (this.status !== 'asking') return null;
    const riddle = this.riddles[this.index];
    if (this.hintsUsed >= riddle.hints.length) return null;

    const hint = riddle.hints[this.hintsUsed];
    this.hintsUsed += 1;
    return hint;
  }

  /** Judges a typed answer. Matching is lenient about case, spacing and punctuation. */
  submit(given: string): RiddleAttempt | null {
    if (this.status !== 'asking') return null;

    const riddle = this.riddles[this.index];
    const isCorrect = isRiddleAnswerCorrect(riddle, given);

    if (isCorrect) {
      this.currentStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    } else {
      this.currentStreak = 0;
    }

    const attempt: RiddleAttempt = {
      riddleId: riddle.id,
      question: riddle.question,
      answer: riddle.answer,
      given: given.trim(),
      isCorrect,
      hintsUsed: this.hintsUsed,
      xpEarned: isCorrect ? xpForRiddle(this.hintsUsed) : 0,
    };

    this.attempts.push(attempt);
    this.status = 'feedback';
    return attempt;
  }

  /** Gives up on the current riddle — counted as wrong, then moves on. */
  skip(): RiddleAttempt | null {
    return this.submit('');
  }

  next(): RiddleStatus {
    if (this.status !== 'feedback') return this.status;

    if (this.index >= this.riddles.length - 1) {
      this.status = 'finished';
      this.finishedAt = this.now();
      return this.status;
    }

    this.index += 1;
    this.hintsUsed = 0;
    this.status = 'asking';
    return this.status;
  }

  isFinished(): boolean {
    return this.status === 'finished';
  }

  abandon(): void {
    if (this.status === 'finished') return;
    this.status = 'finished';
    this.finishedAt = this.now();
  }

  /** Riddles solved with no hint at all — the Riddle Solver achievement counter. */
  solvedWithoutHint(): number {
    return this.attempts.filter((attempt) => attempt.isCorrect && attempt.hintsUsed === 0).length;
  }

  xpBreakdown(): ReturnType<typeof calculateRoundXp> {
    const correct = this.attempts.filter((attempt) => attempt.isCorrect).length;
    return calculateRoundXp({
      answerXp: this.attempts.reduce((sum, attempt) => sum + attempt.xpEarned, 0),
      attempted: this.attempts.length,
      correct,
      bestStreak: this.bestStreak,
    });
  }

  summary(): GameSummary {
    const attempted = this.attempts.length;
    const correct = this.attempts.filter((attempt) => attempt.isCorrect).length;
    const xp = this.xpBreakdown();
    const endedAt = this.finishedAt ?? this.now();

    const topicIds = new Set(this.riddles.slice(0, Math.max(1, attempted)).map((r) => r.topicId));
    const unitIds = new Set(this.riddles.slice(0, Math.max(1, attempted)).map((r) => r.unitId));

    const result: GameResult = {
      gameType: 'riddle',
      topicId: topicIds.size === 1 ? [...topicIds][0] : 'mixed',
      ...(unitIds.size === 1 ? { unitId: [...unitIds][0] } : {}),
      attempted,
      correct,
      wrong: attempted - correct,
      score: correct,
      accuracy: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
      xpEarned: xp.total,
      durationSeconds: Math.max(0, Math.round((endedAt - this.startedAt) / 1000)),
      bestStreak: this.bestStreak,
    };

    return { result, answers: [] };
  }
}
