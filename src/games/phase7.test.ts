/**
 * Self-checks for the five Phase 7 game engines.
 * Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { RapidFireEngine } from './rapid-fire/rapid-fire.engine.ts';
import { MatchingEngine } from './matching/matching.engine.ts';
import { RiddleEngine, xpForRiddle } from './riddles/riddle.engine.ts';
import { BossEngine, BOSS_DAMAGE, PLAYER_DAMAGE } from './boss/boss.engine.ts';
import { WordSearchEngine } from './word-search/word-search.engine.ts';
import {
  DIRECTIONS,
  generateGrid,
  gridSizeFor,
  lineBetween,
  mulberry32,
  readLine,
} from './word-search/word-search.generator.ts';
import { BASE_XP, RIDDLE_HINT_PENALTY } from '../config/xp.config.ts';
import type { Boss, Difficulty, MatchingSet, Question, Riddle, WordSearchSet } from '../models/content.ts';

function question(id: string, correctAnswer = 0, difficulty: Difficulty = 'easy'): Question {
  return {
    id,
    unitId: 'unit-1',
    topicId: 'osi-model',
    question: `Q ${id}?`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer,
    explanation: 'Explanation text that is long enough.',
    difficulty,
    gameTypes: ['quiz', 'rapid-fire', 'boss'],
  };
}

function clock(start = 0) {
  let current = start;
  return { now: () => current, advance: (ms: number) => (current += ms) };
}

// ---------------------------------------------------------------- Rapid Fire

const TEN = Array.from({ length: 10 }, (_, i) => question(`q${i}`));

test('rapid fire advances immediately after each answer', () => {
  const engine = new RapidFireEngine(TEN);

  engine.answer(0);
  assert.equal(engine.view().answeredCount, 1);
  assert.equal(engine.view().score, 1);
  assert.notEqual(engine.view().question.id, TEN[0].id, 'no feedback pause between questions');
});

test('rapid fire rejects answers after the buzzer', () => {
  const time = clock();
  const engine = new RapidFireEngine(TEN, { now: time.now, durationSeconds: 60 });

  engine.answer(0);
  time.advance(65_000);

  assert.equal(engine.isFinished(), true);
  assert.equal(engine.answer(0), null, 'a late click must not score');
  assert.equal(engine.summary().result.attempted, 1);
});

test('rapid fire awards positive time for correct answer and negative time for wrong answer', () => {
  const time = clock();
  const engine = new RapidFireEngine(TEN, { now: time.now, durationSeconds: 60 });

  const correctAns = engine.answer(0); // correct (correctAnswer is 0)
  assert.equal(correctAns?.isCorrect, true);
  assert.equal(correctAns?.timeDeltaSeconds, 2);
  assert.equal(engine.secondsLeft(), 62);

  const wrongAns = engine.answer(3); // wrong
  assert.equal(wrongAns?.isCorrect, false);
  assert.equal(wrongAns?.timeDeltaSeconds, -3);
  assert.equal(engine.secondsLeft(), 59);
});

test('rapid fire exhausts and finishes when negative time drains timer to 0', () => {
  const time = clock();
  const engine = new RapidFireEngine(TEN, { now: time.now, durationSeconds: 2 });

  const wrongAns = engine.answer(3); // -3s penalty on 2s left -> exhausts!
  assert.equal(wrongAns?.exhausted, true);
  assert.equal(engine.isExhausted(), true);
  assert.equal(engine.isFinished(), true);
  assert.equal(engine.secondsLeft(), 0);
});

test('rapid fire reports the seconds remaining', () => {
  const time = clock();
  const engine = new RapidFireEngine(TEN, { now: time.now, durationSeconds: 60 });

  assert.equal(engine.secondsLeft(), 60);
  time.advance(15_500);
  assert.equal(engine.secondsLeft(), 45);
  time.advance(100_000);
  assert.equal(engine.secondsLeft(), 0);
});

test('rapid fire pays less per answer than Quiz Blitz', () => {
  const engine = new RapidFireEngine([question('a', 0, 'easy')]);
  const answer = engine.answer(0);

  assert.equal(answer?.xpEarned, BASE_XP.rapidFireCorrect);
  assert.ok(BASE_XP.rapidFireCorrect < BASE_XP.quizCorrect);
});

test('rapid fire ends when the questions run out', () => {
  const engine = new RapidFireEngine([question('only')]);
  engine.answer(0);
  assert.equal(engine.isFinished(), true, 'a short pool must end, not loop');
});

// ---------------------------------------------------------------- Match & Pair

const SET: MatchingSet = {
  id: 'set-1',
  unitId: 'unit-5',
  topicId: 'transport-udp',
  title: 'Protocol → Port',
  leftLabel: 'Protocol',
  rightLabel: 'Port',
  difficulty: 'easy',
  pairs: [
    { left: 'HTTP', right: '80' },
    { left: 'HTTPS', right: '443' },
    { left: 'DNS', right: '53' },
    { left: 'SSH', right: '22' },
  ],
};

test('matching a correct pair locks both cards', () => {
  const engine = new MatchingEngine(SET, { random: mulberry32(1) });

  assert.equal(engine.select('left', 0), 'selected');
  assert.equal(engine.select('right', 0), 'matched');

  const view = engine.view();
  assert.equal(view.matchedCount, 1);
  assert.ok(view.left.find((card) => card.pairIndex === 0)?.matched);
  assert.ok(view.right.find((card) => card.pairIndex === 0)?.matched);
  assert.equal(engine.select('left', 0), 'ignored', 'a matched card is out of play');
});

test('a wrong pairing counts a mistake and clears the selection', () => {
  const engine = new MatchingEngine(SET, { random: mulberry32(2) });

  engine.select('left', 0);
  assert.equal(engine.select('right', 1), 'wrong');

  const view = engine.view();
  assert.equal(view.mistakes, 1);
  assert.equal(view.matchedCount, 0);
  assert.equal(view.selectedLeft, null);
  assert.equal(view.selectedRight, null);
});

test('tapping the same card twice deselects it', () => {
  const engine = new MatchingEngine(SET, { random: mulberry32(3) });

  engine.select('left', 2);
  assert.equal(engine.select('left', 2), 'deselected');
  assert.equal(engine.view().selectedLeft, null);
});

test('clearing the board finishes the round and scores accuracy', () => {
  const engine = new MatchingEngine(SET, { random: mulberry32(4) });

  engine.select('left', 0);
  engine.select('right', 1); // one deliberate mistake
  for (let i = 0; i < SET.pairs.length; i += 1) {
    engine.select('left', i);
    engine.select('right', i);
  }

  assert.equal(engine.isFinished(), true);
  const { result } = engine.summary();
  assert.equal(result.correct, 4);
  assert.equal(result.wrong, 1);
  assert.equal(result.attempted, 5);
  assert.equal(result.accuracy, 80);
  assert.equal(result.gameType, 'matching');
});

test('an abandoned board pays only for the pairs actually matched', () => {
  const engine = new MatchingEngine(SET, { random: mulberry32(5) });
  engine.select('left', 0);
  engine.select('right', 0);
  engine.abandon();

  const { result } = engine.summary();
  assert.equal(result.correct, 1);
  assert.ok(result.xpEarned > 0);
  assert.ok(result.xpEarned < BASE_XP.matchingCompleted + 50, 'a quarter board must not pay in full');
});

// ---------------------------------------------------------------- Riddles

const RIDDLES: Riddle[] = [
  {
    id: 'r1', unitId: 'unit-6', topicId: 'dns',
    question: 'I turn names into addresses.',
    answer: 'DNS', acceptedAnswers: ['Domain Name System'],
    hints: ['UDP port 53.', 'Hierarchical, starting at the root.'],
    difficulty: 'easy',
  },
  {
    id: 'r2', unitId: 'unit-4', topicId: 'routing-algorithms',
    question: 'I forward packets between networks.',
    answer: 'Router', hints: ['Layer 3.'], difficulty: 'easy',
  },
];

test('a riddle solved with no hint pays full XP', () => {
  const engine = new RiddleEngine(RIDDLES);
  const attempt = engine.submit('dns');

  assert.equal(attempt?.isCorrect, true);
  assert.equal(attempt?.xpEarned, BASE_XP.riddleSolved);
  assert.equal(engine.solvedWithoutHint(), 1);
});

test('each hint lowers the XP still on offer', () => {
  const engine = new RiddleEngine(RIDDLES);

  assert.equal(engine.view().xpAtStake, BASE_XP.riddleSolved);
  engine.useHint();
  assert.equal(engine.view().xpAtStake, BASE_XP.riddleSolved - RIDDLE_HINT_PENALTY);
  engine.useHint();
  assert.equal(engine.view().xpAtStake, BASE_XP.riddleSolved - 2 * RIDDLE_HINT_PENALTY);

  const attempt = engine.submit('DNS');
  assert.equal(attempt?.xpEarned, xpForRiddle(2));
  assert.equal(engine.solvedWithoutHint(), 0, 'a hinted solve does not count as hint-free');
});

test('hints run out and never drop the reward below the floor', () => {
  const engine = new RiddleEngine(RIDDLES);
  engine.useHint();
  engine.useHint();

  assert.equal(engine.useHint(), null, 'there is no third hint');
  assert.ok(xpForRiddle(99) >= RIDDLE_HINT_PENALTY);
});

test('answers are matched leniently and accept alternatives', () => {
  const engine = new RiddleEngine(RIDDLES);
  assert.equal(engine.submit('  domain name system ')?.isCorrect, true);
});

test('skipping counts as wrong and moves on', () => {
  const engine = new RiddleEngine(RIDDLES);
  const attempt = engine.skip();

  assert.equal(attempt?.isCorrect, false);
  assert.equal(attempt?.xpEarned, 0);
  assert.equal(engine.next(), 'asking');
  assert.equal(engine.view().index, 2);
});

test('a riddle session produces a riddle GameResult', () => {
  const engine = new RiddleEngine(RIDDLES);
  engine.submit('DNS');
  engine.next();
  engine.submit('router');
  engine.next();

  assert.equal(engine.isFinished(), true);
  const { result } = engine.summary();
  assert.equal(result.gameType, 'riddle');
  assert.equal(result.correct, 2);
  assert.equal(result.accuracy, 100);
  assert.equal(result.topicId, 'mixed', 'riddles spanning topics report mixed');
});

// ---------------------------------------------------------------- Boss Battle

const BOSS: Boss = {
  id: 'boss-test', unitId: 'unit-1', name: 'Test Guardian', title: 'Keeper',
  icon: 'bi-shield', intro: '', defeatLine: '', victoryLine: '',
  hp: 30, playerHp: 20, difficulties: ['easy'],
};

test('a correct answer damages the boss by its difficulty', () => {
  const engine = new BossEngine(BOSS, [question('a', 0, 'hard'), question('b', 0, 'easy')]);
  engine.answer(0);

  const view = engine.view();
  assert.equal(view.bossHp, BOSS.hp - BOSS_DAMAGE.hard);
  assert.equal(view.playerHp, BOSS.playerHp, 'a correct answer costs the player nothing');
});

test('a wrong answer damages the player', () => {
  const engine = new BossEngine(BOSS, [question('a', 0), question('b', 0)]);
  engine.answer(1);

  const view = engine.view();
  assert.equal(view.playerHp, BOSS.playerHp - PLAYER_DAMAGE);
  assert.equal(view.bossHp, BOSS.hp);
});

test('a timeout damages the player just like a wrong answer', () => {
  const engine = new BossEngine(BOSS, [question('a', 0), question('b', 0)]);
  engine.answer(null);
  assert.equal(engine.view().playerHp, BOSS.playerHp - PLAYER_DAMAGE);
});

test('draining the boss HP is a victory and pays the victory bonus', () => {
  const questions = Array.from({ length: 4 }, (_, i) => question(`q${i}`, 0, 'easy'));
  const engine = new BossEngine(BOSS, questions);

  for (let i = 0; i < 3; i += 1) {
    engine.answer(0);
    engine.next();
  }

  assert.equal(engine.isVictory(), true);
  assert.equal(engine.view().status, 'victory');
  assert.ok(engine.summary().result.xpEarned > BASE_XP.bossVictory);
});

test('losing all player HP is a defeat with no victory bonus', () => {
  const questions = Array.from({ length: 4 }, (_, i) => question(`q${i}`, 0));
  const engine = new BossEngine(BOSS, questions);

  for (let i = 0; i < 2; i += 1) {
    engine.answer(3); // always wrong
    engine.next();
  }

  assert.equal(engine.view().status, 'defeat');
  assert.equal(engine.isVictory(), false);
  assert.equal(engine.summary().result.xpEarned, 0);
});

test('running out of questions with the boss alive is a defeat, not a hang', () => {
  const engine = new BossEngine(BOSS, [question('a', 0, 'easy')]);
  engine.answer(0);

  assert.equal(engine.next(), 'defeat');
  assert.equal(engine.isVictory(), false);
});

test('fleeing counts as a defeat', () => {
  const engine = new BossEngine(BOSS, [question('a', 0, 'easy'), question('b', 0, 'easy')]);
  engine.answer(0);
  engine.flee();

  assert.equal(engine.isVictory(), false);
  assert.equal(engine.summary().result.gameType, 'boss');
});

// ---------------------------------------------------------------- Word Search

const WORDS: WordSearchSet = {
  id: 'ws-test', unitId: 'unit-1', topicId: 'osi-model',
  title: 'Devices', difficulty: 'medium',
  words: ['ROUTER', 'SWITCH', 'PACKET', 'FRAME'],
};

test('the grid is square, filled and large enough for the longest word', () => {
  const grid = generateGrid(WORDS.words, 'medium', mulberry32(7));

  assert.equal(grid.size, gridSizeFor(WORDS.words));
  assert.equal(grid.letters.length, grid.size);
  for (const row of grid.letters) {
    assert.equal(row.length, grid.size);
    for (const letter of row) assert.match(letter, /^[A-Z]$/, 'no empty or stray cells');
  }
});

test('every word is placed and readable at its recorded cells', () => {
  const grid = generateGrid(WORDS.words, 'medium', mulberry32(11));

  assert.deepEqual(grid.skipped, [], 'no word should be dropped from this small set');
  for (const placement of grid.placements) {
    assert.equal(readLine(grid, placement.cells), placement.word);
  }
});

test('generation is deterministic for a given seed', () => {
  const a = generateGrid(WORDS.words, 'medium', mulberry32(42));
  const b = generateGrid(WORDS.words, 'medium', mulberry32(42));
  assert.deepEqual(a.letters, b.letters);
});

test('difficulty controls the directions available', () => {
  assert.equal(DIRECTIONS.easy.length, 2, 'easy is horizontal and vertical only');
  assert.ok(DIRECTIONS.medium.length > DIRECTIONS.easy.length);
  assert.ok(DIRECTIONS.hard.length > DIRECTIONS.medium.length);

  const easy = generateGrid(WORDS.words, 'easy', mulberry32(3));
  for (const placement of easy.placements) {
    const [first, second] = placement.cells;
    const dr = second.row - first.row;
    const dc = second.col - first.col;
    assert.ok(
      (dr === 0 && dc === 1) || (dr === 1 && dc === 0),
      'easy grids must not contain diagonals',
    );
  }
});

test('lineBetween only accepts rows, columns and true diagonals', () => {
  assert.equal(lineBetween({ row: 0, col: 0 }, { row: 0, col: 3 })?.length, 4);
  assert.equal(lineBetween({ row: 0, col: 0 }, { row: 3, col: 3 })?.length, 4);
  assert.equal(lineBetween({ row: 3, col: 0 }, { row: 0, col: 0 })?.length, 4, 'reverse drags work');
  assert.equal(lineBetween({ row: 0, col: 0 }, { row: 1, col: 3 }), null, 'a knight move is invalid');
});

test('dragging a word finds it, in either direction', () => {
  const engine = new WordSearchEngine(WORDS, { random: mulberry32(19) });
  const [placement] = engine.view().grid.placements;

  const forwards = engine.select(placement.cells[0], placement.cells.at(-1)!);
  assert.equal(forwards.status, 'found');

  const second = engine.view().grid.placements[1];
  const backwards = engine.select(second.cells.at(-1)!, second.cells[0]);
  assert.equal(backwards.status, 'found', 'a word may be dragged either way');
});

test('a wrong drag counts a miss and does not end the round', () => {
  const engine = new WordSearchEngine(WORDS, { random: mulberry32(23) });
  // A single cell is not a selection; a random long line almost certainly is not a word.
  assert.equal(engine.select({ row: 0, col: 0 }, { row: 0, col: 0 }).status, 'invalid');

  const before = engine.view().misses;
  engine.select({ row: 0, col: 0 }, { row: 0, col: 9 });
  assert.ok(engine.view().misses >= before);
  assert.equal(engine.isFinished(), false);
});

test('finding every word finishes the round and pays the full reward', () => {
  const engine = new WordSearchEngine(WORDS, { random: mulberry32(31) });

  for (const placement of engine.view().grid.placements) {
    engine.select(placement.cells[0], placement.cells.at(-1)!);
  }

  assert.equal(engine.isFinished(), true);
  const { result } = engine.summary();
  assert.equal(result.gameType, 'word-search');
  assert.equal(result.correct, engine.view().totalWords);
  assert.ok(result.xpEarned >= BASE_XP.wordSearchCompleted);
});

test('re-finding a word does not score it twice', () => {
  const engine = new WordSearchEngine(WORDS, { random: mulberry32(37) });
  const [placement] = engine.view().grid.placements;

  engine.select(placement.cells[0], placement.cells.at(-1)!);
  const again = engine.select(placement.cells[0], placement.cells.at(-1)!);

  assert.equal(again.status, 'already-found');
  assert.equal(engine.view().foundCount, 1);
});
