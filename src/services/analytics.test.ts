/**
 * Analytics self-checks. Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dailySeries,
  modePerformance,
  overallAccuracy,
  strongestTopics,
  totalMinutesPlayed,
} from './analytics.logic.ts';
import type { GameAttempt, UserProgress } from '../models/progress.ts';
import type { GameType } from '../models/content.ts';

function attempt(
  createdAt: string,
  overrides: Partial<GameAttempt> & { gameType?: GameType } = {},
): GameAttempt {
  return {
    id: `${createdAt}-${Math.random()}`,
    userId: 'u1',
    gameType: 'quiz',
    topicId: 'osi-model',
    attempted: 10,
    correct: 8,
    wrong: 2,
    score: 8,
    accuracy: 80,
    xpEarned: 100,
    durationSeconds: 120,
    createdAt,
    ...overrides,
  };
}

function progressOf(topicId: string, mastery: number, attempted = 10, correct = 8): UserProgress {
  return {
    userId: 'u1',
    topicId,
    unitId: 'unit-1',
    attempted,
    correct,
    accuracy: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
    completion: 100,
    mastery,
    lastAttemptAt: null,
  };
}

// ---------------------------------------------------------------- mode performance

test('mode performance groups by game type', () => {
  const rows = modePerformance([
    attempt('2026-03-10T10:00:00.000Z', { gameType: 'quiz' }),
    attempt('2026-03-10T11:00:00.000Z', { gameType: 'quiz' }),
    attempt('2026-03-10T12:00:00.000Z', { gameType: 'boss' }),
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].gameType, 'quiz', 'most-played mode first');
  assert.equal(rows[0].sessions, 2);
  assert.equal(rows[1].sessions, 1);
});

test('mode accuracy is weighted by questions, not by session', () => {
  // One 1-question perfect round should not drag a 20-question 50% record up to 75%.
  const rows = modePerformance([
    attempt('2026-03-10T10:00:00.000Z', { attempted: 20, correct: 10, accuracy: 50 }),
    attempt('2026-03-10T11:00:00.000Z', { attempted: 1, correct: 1, accuracy: 100 }),
  ]);

  assert.equal(rows[0].questions, 21);
  assert.equal(rows[0].correct, 11);
  assert.equal(rows[0].accuracy, 52);
  assert.equal(rows[0].bestAccuracy, 100, 'the best single round is still reported');
});

test('mode performance on no attempts is empty, not zeroed rows', () => {
  assert.deepEqual(modePerformance([]), []);
});

// ---------------------------------------------------------------- daily series

test('the daily series is continuous and ends today', () => {
  const series = dailySeries([attempt('2026-03-10T10:00:00.000Z')], 7, '2026-03-10');

  assert.equal(series.length, 7);
  assert.equal(series[6].date, '2026-03-10', 'the last point is today');
  assert.equal(series[0].date, '2026-03-04');
  assert.equal(series[6].xp, 100);
});

test('days with no activity are gaps, not zero-accuracy days', () => {
  const series = dailySeries([attempt('2026-03-10T10:00:00.000Z')], 3, '2026-03-10');

  assert.equal(series[0].accuracy, null, 'an empty day has no accuracy reading');
  assert.equal(series[0].xp, 0);
  assert.equal(series[2].accuracy, 80);
});

test('multiple attempts on one day are summed', () => {
  const series = dailySeries(
    [
      attempt('2026-03-10T09:00:00.000Z', { xpEarned: 50, attempted: 10, correct: 5 }),
      attempt('2026-03-10T18:00:00.000Z', { xpEarned: 70, attempted: 10, correct: 9 }),
    ],
    3,
    '2026-03-10',
  );

  const today = series[2];
  assert.equal(today.xp, 120);
  assert.equal(today.questions, 20);
  assert.equal(today.accuracy, 70);
});

test('attempts outside the window are excluded', () => {
  const series = dailySeries(
    [attempt('2026-02-01T10:00:00.000Z'), attempt('2026-03-20T10:00:00.000Z')],
    7,
    '2026-03-10',
  );

  assert.equal(series.reduce((sum, point) => sum + point.xp, 0), 0);
});

test('the series crosses a month boundary correctly', () => {
  const series = dailySeries([attempt('2026-02-28T10:00:00.000Z')], 5, '2026-03-02');

  assert.equal(series.length, 5);
  assert.equal(series[0].date, '2026-02-26');
  assert.equal(series[4].date, '2026-03-02');
  assert.equal(series[2].xp, 100, '28 Feb is the third point');
});

// ---------------------------------------------------------------- rankings

test('strongest topics ranks by mastery and skips untouched topics', () => {
  const ranked = strongestTopics(
    [progressOf('a', 40), progressOf('b', 95), progressOf('c', 0, 0, 0)],
    2,
  );

  assert.deepEqual(ranked.map((entry) => entry.topicId), ['b', 'a']);
});

test('overall accuracy totals every topic', () => {
  const summary = overallAccuracy([progressOf('a', 50, 10, 5), progressOf('b', 90, 10, 9)]);

  assert.equal(summary.questions, 20);
  assert.equal(summary.correct, 14);
  assert.equal(summary.accuracy, 70);
});

test('overall accuracy on an empty record does not divide by zero', () => {
  assert.deepEqual(overallAccuracy([]), { questions: 0, correct: 0, accuracy: 0 });
});

test('total minutes played rounds from seconds', () => {
  assert.equal(totalMinutesPlayed([attempt('2026-03-10T10:00:00.000Z', { durationSeconds: 90 })]), 2);
  assert.equal(totalMinutesPlayed([]), 0);
});
