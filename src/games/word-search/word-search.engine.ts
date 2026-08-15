/**
 * Word Search round state: which words are found, how many wrong drags were made, and the
 * XP earned. Grid construction lives in word-search.generator.ts.
 */

import type { WordSearchSet } from '../../models/content.ts';
import type { GameResult, GameSummary } from '../../models/game.ts';
import { BASE_XP, calculateRoundXp } from '../../config/xp.config.ts';
import { generateGrid, lineBetween, readLine } from './word-search.generator.ts';
import type { Cell, Grid, Placement } from './word-search.generator.ts';

export type SelectionOutcome =
  | { status: 'found'; word: string; cells: Cell[] }
  | { status: 'already-found'; word: string }
  | { status: 'miss' }
  | { status: 'invalid' };

export interface WordSearchView {
  title: string;
  grid: Grid;
  words: Array<{ word: string; found: boolean }>;
  foundCount: number;
  totalWords: number;
  misses: number;
  foundCells: Cell[];
  finished: boolean;
}

export interface WordSearchOptions {
  now?: () => number;
  random?: () => number;
}

export class WordSearchEngine {
  private readonly set: WordSearchSet;
  private readonly grid: Grid;
  private readonly now: () => number;
  private readonly startedAt: number;

  private readonly found = new Set<string>();
  private misses = 0;
  private finishedAt: number | null = null;

  constructor(set: WordSearchSet, options: WordSearchOptions = {}) {
    this.set = set;
    this.now = options.now ?? (() => Date.now());
    this.startedAt = this.now();
    this.grid = generateGrid(set.words, set.difficulty, options.random ?? Math.random);
  }

  /** Only words actually placed on the grid are winnable. */
  private placements(): Placement[] {
    return this.grid.placements;
  }

  view(): WordSearchView {
    const foundCells = this.placements()
      .filter((placement) => this.found.has(placement.word))
      .flatMap((placement) => placement.cells);

    return {
      title: this.set.title,
      grid: this.grid,
      words: this.placements().map((placement) => ({
        word: placement.word,
        found: this.found.has(placement.word),
      })),
      foundCount: this.found.size,
      totalWords: this.placements().length,
      misses: this.misses,
      foundCells,
      finished: this.isFinished(),
    };
  }

  isFinished(): boolean {
    return this.found.size >= this.placements().length;
  }

  /**
   * Judges a drag from one cell to another. A word counts whichever way it is dragged,
   * so a backwards word does not have to be found backwards.
   */
  select(from: Cell, to: Cell): SelectionOutcome {
    if (this.isFinished()) return { status: 'invalid' };

    const cells = lineBetween(from, to);
    if (!cells || cells.length < 2) return { status: 'invalid' };

    const forwards = readLine(this.grid, cells);
    const backwards = [...forwards].reverse().join('');

    const match = this.placements().find(
      (placement) => placement.word === forwards || placement.word === backwards,
    );

    if (!match) {
      this.misses += 1;
      return { status: 'miss' };
    }

    if (this.found.has(match.word)) return { status: 'already-found', word: match.word };

    this.found.add(match.word);
    if (this.isFinished()) this.finishedAt = this.now();
    return { status: 'found', word: match.word, cells: match.cells };
  }

  /** Reveals a word without credit — used by the "give up" control. */
  reveal(word: string): Placement | null {
    return this.placements().find((placement) => placement.word === word) ?? null;
  }

  abandon(): void {
    this.finishedAt ??= this.now();
  }

  elapsedSeconds(): number {
    return Math.max(0, Math.round(((this.finishedAt ?? this.now()) - this.startedAt) / 1000));
  }

  xpBreakdown(): ReturnType<typeof calculateRoundXp> {
    const total = this.placements().length;
    const share = total === 0 ? 0 : this.found.size / total;
    const attempted = this.found.size + this.misses;

    return calculateRoundXp({
      answerXp: Math.round(BASE_XP.wordSearchCompleted * share),
      attempted,
      correct: this.found.size,
      bestStreak: 0,
    });
  }

  summary(): GameSummary {
    const attempted = this.found.size + this.misses;
    const xp = this.xpBreakdown();

    const result: GameResult = {
      gameType: 'word-search',
      topicId: this.set.topicId,
      unitId: this.set.unitId,
      attempted,
      correct: this.found.size,
      wrong: this.misses,
      score: this.found.size,
      accuracy: attempted === 0 ? 0 : Math.round((this.found.size / attempted) * 100),
      xpEarned: xp.total,
      durationSeconds: this.elapsedSeconds(),
      difficulty: this.set.difficulty,
    };

    return { result, answers: [] };
  }
}
