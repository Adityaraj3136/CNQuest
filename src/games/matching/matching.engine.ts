/**
 * Match & Pair — tap a term, tap its partner.
 *
 * The engine holds two shuffled columns and judges each pairing. Both columns are shuffled
 * independently so position never leaks the answer.
 */

import type { MatchingSet } from '../../models/content.ts';
import type { GameResult, GameSummary } from '../../models/game.ts';
import { BASE_XP, calculateRoundXp } from '../../config/xp.config.ts';
import { shuffle } from '../../services/content.filters.ts';

export type MatchSide = 'left' | 'right';

export interface MatchCard {
  /** Index into the original pair list — the pairing key. */
  pairIndex: number;
  text: string;
  matched: boolean;
}

export type SelectOutcome = 'selected' | 'deselected' | 'matched' | 'wrong' | 'ignored';

export interface MatchingView {
  title: string;
  leftLabel: string;
  rightLabel: string;
  left: MatchCard[];
  right: MatchCard[];
  selectedLeft: number | null;
  selectedRight: number | null;
  matchedCount: number;
  totalPairs: number;
  mistakes: number;
  finished: boolean;
}

export interface MatchingOptions {
  now?: () => number;
  random?: () => number;
}

export class MatchingEngine {
  private readonly set: MatchingSet;
  private readonly now: () => number;
  private readonly startedAt: number;

  private readonly left: MatchCard[];
  private readonly right: MatchCard[];
  private selectedLeft: number | null = null;
  private selectedRight: number | null = null;

  private matchedCount = 0;
  private mistakes = 0;
  private currentStreak = 0;
  private bestStreak = 0;
  private finishedAt: number | null = null;

  constructor(set: MatchingSet, options: MatchingOptions = {}) {
    if (set.pairs.length === 0) throw new Error('MatchingEngine needs at least one pair.');

    this.set = set;
    this.now = options.now ?? (() => Date.now());
    this.startedAt = this.now();

    const random = options.random ?? Math.random;
    const cards = set.pairs.map((pair, pairIndex) => ({ pairIndex, pair }));
    this.left = shuffle(cards, random).map(({ pairIndex, pair }) => ({
      pairIndex,
      text: pair.left,
      matched: false,
    }));
    this.right = shuffle(cards, random).map(({ pairIndex, pair }) => ({
      pairIndex,
      text: pair.right,
      matched: false,
    }));
  }

  view(): MatchingView {
    return {
      title: this.set.title,
      leftLabel: this.set.leftLabel,
      rightLabel: this.set.rightLabel,
      left: this.left.map((card) => ({ ...card })),
      right: this.right.map((card) => ({ ...card })),
      selectedLeft: this.selectedLeft,
      selectedRight: this.selectedRight,
      matchedCount: this.matchedCount,
      totalPairs: this.set.pairs.length,
      mistakes: this.mistakes,
      finished: this.isFinished(),
    };
  }

  isFinished(): boolean {
    return this.matchedCount >= this.set.pairs.length;
  }

  /**
   * Selects a card. Tapping the same card again deselects it; once both sides hold a
   * selection the pairing is judged immediately.
   */
  select(side: MatchSide, pairIndex: number): SelectOutcome {
    if (this.isFinished()) return 'ignored';

    const column = side === 'left' ? this.left : this.right;
    const card = column.find((entry) => entry.pairIndex === pairIndex);
    if (!card || card.matched) return 'ignored';

    if (side === 'left') {
      if (this.selectedLeft === pairIndex) {
        this.selectedLeft = null;
        return 'deselected';
      }
      this.selectedLeft = pairIndex;
    } else {
      if (this.selectedRight === pairIndex) {
        this.selectedRight = null;
        return 'deselected';
      }
      this.selectedRight = pairIndex;
    }

    if (this.selectedLeft === null || this.selectedRight === null) return 'selected';
    return this.judge();
  }

  private judge(): SelectOutcome {
    const matched = this.selectedLeft === this.selectedRight;

    if (matched) {
      const pairIndex = this.selectedLeft as number;
      this.markMatched(this.left, pairIndex);
      this.markMatched(this.right, pairIndex);
      this.matchedCount += 1;
      this.currentStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
      if (this.isFinished()) this.finishedAt = this.now();
    } else {
      this.mistakes += 1;
      this.currentStreak = 0;
    }

    this.selectedLeft = null;
    this.selectedRight = null;
    return matched ? 'matched' : 'wrong';
  }

  private markMatched(column: MatchCard[], pairIndex: number): void {
    const card = column.find((entry) => entry.pairIndex === pairIndex);
    if (card) card.matched = true;
  }

  /** Ends the round early; unmatched pairs simply go unscored. */
  abandon(): void {
    this.finishedAt ??= this.now();
  }

  xpBreakdown(): ReturnType<typeof calculateRoundXp> {
    // The base reward is only paid for a completed board; a partial board scores pro rata.
    const share = this.matchedCount / this.set.pairs.length;
    return calculateRoundXp({
      answerXp: Math.round(BASE_XP.matchingCompleted * share),
      attempted: this.matchedCount + this.mistakes,
      correct: this.matchedCount,
      bestStreak: this.bestStreak,
    });
  }

  summary(): GameSummary {
    // Every judged pairing counts as an attempt — that is what makes mistakes cost accuracy.
    const attempted = this.matchedCount + this.mistakes;
    const xp = this.xpBreakdown();
    const endedAt = this.finishedAt ?? this.now();

    const result: GameResult = {
      gameType: 'matching',
      topicId: this.set.topicId,
      unitId: this.set.unitId,
      attempted,
      correct: this.matchedCount,
      wrong: this.mistakes,
      score: this.matchedCount,
      accuracy: attempted === 0 ? 0 : Math.round((this.matchedCount / attempted) * 100),
      xpEarned: xp.total,
      durationSeconds: Math.max(0, Math.round((endedAt - this.startedAt) / 1000)),
      difficulty: this.set.difficulty,
      bestStreak: this.bestStreak,
    };

    return { result, answers: [] };
  }
}
