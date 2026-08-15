/**
 * Gamification engine self-checks: streaks, mastery and achievements.
 * Run with: npm run test:units
 *
 * These three are where a gamified app quietly goes wrong — streaks that count sessions
 * instead of days, mastery that exceeds 100%, achievements that award twice.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { applyActivity, daysBetween, isStreakExpired, toLocalDateKey } from './streak.logic.ts';
import {
  calculateMastery,
  isUnitMastered,
  masteryBand,
  mergeProgress,
  unitMastery,
  weakestTopics,
} from './mastery.logic.ts';
import { MEASURES, achievementProgress, evaluateAchievements } from './achievement.logic.ts';
import { ACHIEVEMENTS } from '../data/achievements.ts';
import type { GameResult } from '../models/game.ts';
import type { UserProgress } from '../models/progress.ts';
import type { AchievementContext } from './achievement.logic.ts';

// ---------------------------------------------------------------- streaks

test('a first-ever activity starts the streak at 1', () => {
  const result = applyActivity({ currentStreak: 0, longestStreak: 0 }, '2026-03-10');

  assert.equal(result.currentStreak, 1);
  assert.equal(result.longestStreak, 1);
  assert.equal(result.lastActiveDate, '2026-03-10');
  assert.equal(result.incremented, true);
});

test('a second game on the same day does not extend the streak', () => {
  const state = { currentStreak: 4, longestStreak: 9, lastActiveDate: '2026-03-10' };
  const result = applyActivity(state, '2026-03-10');

  assert.equal(result.currentStreak, 4, 'streaks count days, not sessions');
  assert.equal(result.incremented, false);
  assert.equal(result.longestStreak, 9);
});

test('playing the next day extends the streak', () => {
  const result = applyActivity(
    { currentStreak: 6, longestStreak: 6, lastActiveDate: '2026-03-10' },
    '2026-03-11',
  );

  assert.equal(result.currentStreak, 7);
  assert.equal(result.longestStreak, 7);
  assert.equal(result.incremented, true);
  assert.equal(result.broken, false);
});

test('missing a day resets to 1 but preserves the longest run', () => {
  const result = applyActivity(
    { currentStreak: 12, longestStreak: 12, lastActiveDate: '2026-03-10' },
    '2026-03-13',
  );

  assert.equal(result.currentStreak, 1);
  assert.equal(result.longestStreak, 12, 'the record must survive a broken streak');
  assert.equal(result.broken, true);
});

test('a streak survives month and year boundaries', () => {
  assert.equal(applyActivity({ currentStreak: 3, longestStreak: 3, lastActiveDate: '2026-01-31' }, '2026-02-01').currentStreak, 4);
  assert.equal(applyActivity({ currentStreak: 5, longestStreak: 5, lastActiveDate: '2025-12-31' }, '2026-01-01').currentStreak, 6);
  assert.equal(daysBetween('2024-02-28', '2024-02-29'), 1, 'leap day is a real day');
});

test('a clock moving backwards cannot inflate a streak', () => {
  const result = applyActivity(
    { currentStreak: 8, longestStreak: 8, lastActiveDate: '2026-03-10' },
    '2026-03-08',
  );

  assert.equal(result.currentStreak, 1);
  assert.equal(result.longestStreak, 8);
});

test('a streak is expired only after more than one day of silence', () => {
  const state = { currentStreak: 5, longestStreak: 5, lastActiveDate: '2026-03-10' };

  assert.equal(isStreakExpired(state, '2026-03-10'), false, 'same day');
  assert.equal(isStreakExpired(state, '2026-03-11'), false, 'still saveable today');
  assert.equal(isStreakExpired(state, '2026-03-12'), true, 'a day was missed');
});

test('local date keys use local time, not UTC', () => {
  // 23:30 local on the 10th must be the 10th, whatever the timezone offset is.
  const key = toLocalDateKey(new Date(2026, 2, 10, 23, 30, 0));
  assert.equal(key, '2026-03-10');
});

// ---------------------------------------------------------------- mastery

test('mastery weights accuracy above completion', () => {
  // 100% accuracy, half the bank seen: 0.7*100 + 0.3*50 = 85
  const result = calculateMastery({ attempted: 5, correct: 5, questionPool: 10 });

  assert.equal(result.accuracy, 100);
  assert.equal(result.completion, 50);
  assert.equal(result.mastery, 85);
  assert.equal(result.band, 'Mastered');
});

test('an untouched topic is zero across the board', () => {
  const result = calculateMastery({ attempted: 0, correct: 0, questionPool: 10 });

  assert.equal(result.mastery, 0);
  assert.equal(result.band, 'Beginner');
});

test('re-answering the same bank cannot push completion past 100', () => {
  const result = calculateMastery({ attempted: 40, correct: 40, questionPool: 10 });

  assert.equal(result.completion, 100);
  assert.equal(result.mastery, 100);
});

test('correct answers can never exceed attempts', () => {
  const result = calculateMastery({ attempted: 5, correct: 99, questionPool: 10 });
  assert.equal(result.accuracy, 100);
});

test('an empty question pool does not divide by zero', () => {
  const result = calculateMastery({ attempted: 3, correct: 2, questionPool: 0 });
  assert.ok(Number.isFinite(result.mastery));
  assert.equal(result.completion, 100);
});

test('mastery bands match the documented thresholds', () => {
  assert.equal(masteryBand(0), 'Beginner');
  assert.equal(masteryBand(39), 'Beginner');
  assert.equal(masteryBand(40), 'Learning');
  assert.equal(masteryBand(59), 'Learning');
  assert.equal(masteryBand(60), 'Proficient');
  assert.equal(masteryBand(79), 'Proficient');
  assert.equal(masteryBand(80), 'Mastered');
  assert.equal(masteryBand(100), 'Mastered');
});

test('rounds accumulate into topic progress', () => {
  const first = mergeProgress(null, {
    userId: 'u1', topicId: 'subnetting', unitId: 'unit-4', attempted: 6, correct: 4,
  }, 12, '2026-03-10T10:00:00.000Z');

  assert.equal(first.attempted, 6);
  assert.equal(first.correct, 4);
  assert.equal(first.accuracy, 67);
  assert.equal(first.completion, 50);

  const second = mergeProgress(first, {
    userId: 'u1', topicId: 'subnetting', unitId: 'unit-4', attempted: 6, correct: 6,
  }, 12, '2026-03-11T10:00:00.000Z');

  assert.equal(second.attempted, 12, 'totals accumulate, they do not replace');
  assert.equal(second.correct, 10);
  assert.equal(second.accuracy, 83);
  assert.equal(second.completion, 100);
  assert.equal(second.lastAttemptAt, '2026-03-11T10:00:00.000Z');
});

test('unit mastery counts untouched topics as zero', () => {
  // Two of four topics attempted, both at 80.
  assert.equal(unitMastery([80, 80], 4), 40);
  assert.equal(unitMastery([80, 80, 80, 80], 4), 80);
  assert.equal(unitMastery([], 0), 0);
  assert.equal(isUnitMastered(80), true);
  assert.equal(isUnitMastered(79), false);
});

test('weakest topics ignores topics never attempted', () => {
  const progress: UserProgress[] = [
    { userId: 'u', topicId: 'a', unitId: 'unit-1', attempted: 10, correct: 9, accuracy: 90, completion: 100, mastery: 93, lastAttemptAt: null },
    { userId: 'u', topicId: 'b', unitId: 'unit-1', attempted: 10, correct: 3, accuracy: 30, completion: 100, mastery: 51, lastAttemptAt: null },
    { userId: 'u', topicId: 'c', unitId: 'unit-1', attempted: 0, correct: 0, accuracy: 0, completion: 0, mastery: 0, lastAttemptAt: null },
  ];

  const weakest = weakestTopics(progress, 2);
  assert.deepEqual(weakest.map((p) => p.topicId), ['b', 'a']);
});

// ---------------------------------------------------------------- achievements

function context(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    totalCorrectAnswers: 0,
    totalGamesPlayed: 0,
    currentStreak: 0,
    bossWins: 0,
    riddlesSolvedWithoutHint: 0,
    dictionaryTermsViewed: 0,
    modesPlayed: [],
    unitsMastered: 0,
    ...overrides,
  };
}

function quizRound(accuracy: number): GameResult {
  return {
    gameType: 'quiz', topicId: 'osi-model', attempted: 10,
    correct: Math.round(accuracy / 10), wrong: 10 - Math.round(accuracy / 10),
    score: 0, accuracy, xpEarned: 0, durationSeconds: 60,
  };
}

test('every seeded achievement has a measure', () => {
  for (const achievement of ACHIEVEMENTS) {
    assert.ok(
      MEASURES[achievement.id],
      `achievement "${achievement.id}" has no measure and could never unlock`,
    );
  }
});

test('finishing a first game unlocks First Steps', () => {
  const unlocked = evaluateAchievements(ACHIEVEMENTS, context({ totalGamesPlayed: 1 }), []);
  assert.deepEqual(unlocked.map((a) => a.id), ['first-steps']);
});

test('an achievement is never awarded twice', () => {
  const ctx = context({ totalGamesPlayed: 5 });

  assert.equal(evaluateAchievements(ACHIEVEMENTS, ctx, []).length, 1);
  assert.equal(evaluateAchievements(ACHIEVEMENTS, ctx, ['first-steps']).length, 0);
});

test('a perfect quiz unlocks Perfectionist, a 90% quiz does not', () => {
  const perfect = evaluateAchievements(ACHIEVEMENTS, context({ round: quizRound(100) }), []);
  assert.ok(perfect.some((a) => a.id === 'perfectionist'));

  const near = evaluateAchievements(ACHIEVEMENTS, context({ round: quizRound(90) }), []);
  assert.ok(!near.some((a) => a.id === 'perfectionist'));
});

test('a perfect quiz does not unlock the Rapid Fire achievement', () => {
  const unlocked = evaluateAchievements(ACHIEVEMENTS, context({ round: quizRound(100) }), []);
  assert.ok(
    !unlocked.some((a) => a.id === 'speed-demon'),
    'round-scoped achievements must check the game mode',
  );
});

test('several achievements can unlock from one round', () => {
  const unlocked = evaluateAchievements(
    ACHIEVEMENTS,
    context({ totalGamesPlayed: 1, totalCorrectAnswers: 100, currentStreak: 7, round: quizRound(100) }),
    [],
  );

  const ids = unlocked.map((a) => a.id).sort();
  assert.deepEqual(ids, ['first-steps', 'on-fire', 'perfectionist', 'quiz-master']);
});

test('All-Rounder counts distinct modes, not plays', () => {
  const repeated = context({ modesPlayed: ['quiz', 'quiz', 'quiz', 'quiz', 'quiz', 'quiz'] });
  assert.ok(!evaluateAchievements(ACHIEVEMENTS, repeated, []).some((a) => a.id === 'all-rounder'));

  const all = context({
    modesPlayed: ['quiz', 'rapid-fire', 'boss', 'matching', 'riddle', 'word-search'],
  });
  assert.ok(evaluateAchievements(ACHIEVEMENTS, all, []).some((a) => a.id === 'all-rounder'));
});

test('progress towards a locked achievement is reported and capped', () => {
  const rows = achievementProgress(ACHIEVEMENTS, context({ totalCorrectAnswers: 50 }), []);
  const quizMaster = rows.find((row) => row.achievement.id === 'quiz-master');

  assert.equal(quizMaster?.value, 50);
  assert.equal(quizMaster?.percent, 50);
  assert.equal(quizMaster?.unlocked, false);

  const over = achievementProgress(ACHIEVEMENTS, context({ totalCorrectAnswers: 500 }), []);
  assert.equal(over.find((row) => row.achievement.id === 'quiz-master')?.percent, 100);
});

test('a held achievement always shows as complete', () => {
  // Perfectionist is round-scoped, so its measure reads 0 outside a round.
  const rows = achievementProgress(ACHIEVEMENTS, context(), ['perfectionist']);
  const row = rows.find((entry) => entry.achievement.id === 'perfectionist');

  assert.equal(row?.unlocked, true);
  assert.equal(row?.percent, 100);
});
