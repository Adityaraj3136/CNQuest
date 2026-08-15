/**
 * Word Search grid generator.
 *
 * Places every word on a square grid in a direction allowed by the difficulty, then fills
 * the gaps with random letters. Placement is randomised but deterministic given an RNG, so
 * the tests can pin exact grids.
 */

import type { Difficulty } from '../../models/content.ts';

export interface Cell {
  row: number;
  col: number;
}

export interface Placement {
  word: string;
  cells: Cell[];
  /** True when the word reads backwards along its direction. */
  reversed: boolean;
}

export interface Grid {
  size: number;
  /** `letters[row][col]` — always upper case A-Z. */
  letters: string[][];
  placements: Placement[];
  /** Words that could not be placed after every attempt. Normally empty. */
  skipped: string[];
}

type Direction = { dr: number; dc: number };

const EAST: Direction = { dr: 0, dc: 1 };
const SOUTH: Direction = { dr: 1, dc: 0 };
const SOUTH_EAST: Direction = { dr: 1, dc: 1 };
const NORTH_EAST: Direction = { dr: -1, dc: 1 };

/** Directions permitted per difficulty; hard also allows every word to be reversed. */
export const DIRECTIONS: Record<Difficulty, Direction[]> = {
  easy: [EAST, SOUTH],
  medium: [EAST, SOUTH, SOUTH_EAST],
  hard: [EAST, SOUTH, SOUTH_EAST, NORTH_EAST],
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PLACEMENT_ATTEMPTS = 200;

/** Small deterministic PRNG so a seed always yields the same grid. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grid big enough for the longest word, with room to hide the rest. */
export function gridSizeFor(words: readonly string[]): number {
  const longest = words.reduce((max, word) => Math.max(max, word.length), 0);
  const letters = words.reduce((sum, word) => sum + word.length, 0);
  // Roughly double the letter count in cells keeps the grid readable but not sparse.
  const byArea = Math.ceil(Math.sqrt(letters * 2));
  return Math.max(10, longest + 1, byArea);
}

function cellsFor(start: Cell, direction: Direction, length: number): Cell[] {
  return Array.from({ length }, (_, i) => ({
    row: start.row + direction.dr * i,
    col: start.col + direction.dc * i,
  }));
}

function fits(letters: string[][], size: number, word: string, cells: Cell[]): boolean {
  return cells.every((cell, i) => {
    if (cell.row < 0 || cell.row >= size || cell.col < 0 || cell.col >= size) return false;
    const existing = letters[cell.row][cell.col];
    // Overlaps are allowed only where the letters already agree.
    return existing === '' || existing === word[i];
  });
}

export function generateGrid(
  words: readonly string[],
  difficulty: Difficulty,
  random: () => number = Math.random,
): Grid {
  const cleaned = [...new Set(words.map((word) => word.toUpperCase().replace(/[^A-Z]/g, '')))]
    .filter((word) => word.length >= 2)
    // Longest first: the hardest words to place get the emptiest grid.
    .sort((a, b) => b.length - a.length);

  const size = gridSizeFor(cleaned);
  const letters: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
  const placements: Placement[] = [];
  const skipped: string[] = [];

  const directions = DIRECTIONS[difficulty];
  const allowReversed = difficulty === 'hard';

  for (const word of cleaned) {
    let placed = false;

    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS && !placed; attempt += 1) {
      const direction = directions[Math.floor(random() * directions.length)];
      const reversed = allowReversed && random() < 0.35;
      const sequence = reversed ? [...word].reverse().join('') : word;

      const start: Cell = {
        row: Math.floor(random() * size),
        col: Math.floor(random() * size),
      };
      const cells = cellsFor(start, direction, sequence.length);

      if (!fits(letters, size, sequence, cells)) continue;

      cells.forEach((cell, i) => {
        letters[cell.row][cell.col] = sequence[i];
      });
      // Cells are always stored reading the word forwards, so highlighting is straightforward.
      placements.push({ word, cells: reversed ? [...cells].reverse() : cells, reversed });
      placed = true;
    }

    if (!placed) skipped.push(word);
  }

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (letters[row][col] === '') {
        letters[row][col] = ALPHABET[Math.floor(random() * ALPHABET.length)];
      }
    }
  }

  return { size, letters, placements, skipped };
}

/**
 * The straight line between two cells, or null when they are not aligned on a row,
 * column or 45° diagonal.
 */
export function lineBetween(from: Cell, to: Cell): Cell[] | null {
  const dRow = to.row - from.row;
  const dCol = to.col - from.col;

  const aligned = dRow === 0 || dCol === 0 || Math.abs(dRow) === Math.abs(dCol);
  if (!aligned) return null;

  const length = Math.max(Math.abs(dRow), Math.abs(dCol)) + 1;
  const step: Direction = { dr: Math.sign(dRow), dc: Math.sign(dCol) };
  return cellsFor(from, step, length);
}

export function readLine(grid: Grid, cells: readonly Cell[]): string {
  return cells.map((cell) => grid.letters[cell.row]?.[cell.col] ?? '').join('');
}
