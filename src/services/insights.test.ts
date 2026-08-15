/**
 * Dashboard insight self-checks: overall progress, recent activity and the recommender.
 * Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  lastActiveTopicId,
  overallProgress,
  recentPerformance,
  unitBreakdown,
} from './insights.logic.ts';
import type { Topic } from '../models/content.ts';
import type { GameAttempt, UserProgress } from '../models/progress.ts';

function topic(id: string, unitId: string, order: number): Topic {
  return {
    id,
    unitId,
    title: id,
    description: '',
    order,
    estimatedMinutes: 5,
    overview: '',
    keyPoints: [],
    definitions: [],
  };
}

function progressOf(
  topicId: string,
  unitId: string,
  values: { attempted: number; correct: number; accuracy: number; mastery: number },
): UserProgress {
  return {
    userId: 'u1',
    topicId,
    unitId,
    attempted: values.attempted,
    correct: values.correct,
    accuracy: values.accuracy,
    completion: 100,
    mastery: values.mastery,
    lastAttemptAt: null,
  };
}

function attempt(createdAt: string, overrides: Partial<GameAttempt> = {}): GameAttempt {
  return {
    id: createdAt,
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

// ---------------------------------------------------------------- overall progress

test('overall progress averages across the whole syllabus, not just started topics', () => {
  const progress = [
    progressOf('a', 'unit-1', { attempted: 10, correct: 10, accuracy: 100, mastery: 100 }),
  ];

  assert.equal(overallProgress(progress, 1), 100, 'one of one topic mastered');
  assert.equal(overallProgress(progress, 10), 10, 'one of ten topics mastered');
  assert.equal(overallProgress([], 10), 0);
  assert.equal(overallProgress([], 0), 0, 'no syllabus must not divide by zero');
});

test('unit breakdown reports mastery and how many topics were started', () => {
  const topics = [topic('a', 'unit-1', 1), topic('b', 'unit-1', 2), topic('c', 'unit-2', 1)];
  const progress = [
    progressOf('a', 'unit-1', { attempted: 5, correct: 5, accuracy: 100, mastery: 90 }),
  ];

  const rows = unitBreakdown(progress, topics);
  const unit1 = rows.find((row) => row.unitId === 'unit-1');
  const unit2 = rows.find((row) => row.unitId === 'unit-2');

  assert.equal(unit1?.mastery, 45, 'one of two topics at 90 averages to 45');
  assert.equal(unit1?.topicsStarted, 1);
  assert.equal(unit1?.topicsTotal, 2);
  assert.equal(unit2?.mastery, 0);
});

// ---------------------------------------------------------------- recent activity

test('recent performance covers a rolling window including today', () => {
  const attempts = [
    attempt('2026-03-10T09:00:00.000Z'),
    attempt('2026-03-08T09:00:00.000Z'),
    attempt('2026-03-01T09:00:00.000Z', { xpEarned: 999 }),
  ];

  const week = recentPerformance(attempts, 7, '2026-03-10');

  assert.equal(week.games, 2, 'the 9-day-old attempt is outside the window');
  assert.equal(week.questions, 20);
  assert.equal(week.correct, 16);
  assert.equal(week.accuracy, 80);
  assert.equal(week.xpEarned, 200);
});

test('recent performance handles no activity without dividing by zero', () => {
  const empty = recentPerformance([], 7, '2026-03-10');
  assert.deepEqual(empty, { games: 0, questions: 0, correct: 0, accuracy: 0, xpEarned: 0 });
});

test('future-dated attempts are excluded rather than counted', () => {
  const week = recentPerformance([attempt('2026-03-20T09:00:00.000Z')], 7, '2026-03-10');
  assert.equal(week.games, 0);
});

test('the last active topic ignores mixed rounds', () => {
  const attempts = [
    attempt('2026-03-10T10:00:00.000Z', { topicId: 'mixed' }),
    attempt('2026-03-09T10:00:00.000Z', { topicId: 'subnetting' }),
    attempt('2026-03-08T10:00:00.000Z', { topicId: 'dns' }),
  ];

  assert.equal(lastActiveTopicId(attempts), 'subnetting');
  assert.equal(lastActiveTopicId([]), null);
});

// Recommender tests moved to services/adaptive/adaptive.test.ts in Phase 11.
