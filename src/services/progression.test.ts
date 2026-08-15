/**
 * Next-goal and journey-state self-checks. Run with: npm run test:units
 *
 * A recommendation the app cannot back up is worse than none, so every branch here is pinned.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { networkStage, nextGoal, unitStates } from './progression.logic.ts';
import type { GoalInput } from './progression.logic.ts';

function input(overrides: Partial<GoalInput> = {}): GoalInput {
  return {
    questionsAnswered: 50,
    xpToNextLevel: 200,
    nextLevelTitle: 'Packet Explorer',
    currentStreak: 3,
    streakAtRisk: false,
    topics: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------- next goal

test('a student who has never played is sent to their first quest', () => {
  const goal = nextGoal(input({ questionsAnswered: 0 }));

  assert.equal(goal.kind, 'first-quest');
  assert.equal(goal.actionHref, '#/learn');
});

test('a lapsing streak outranks everything else', () => {
  // It is the only goal with a deadline, so it cannot wait behind a topic suggestion.
  const goal = nextGoal(
    input({ streakAtRisk: true, topics: [{ id: 't1', title: 'OSI Model', mastery: 70 }] }),
  );

  assert.equal(goal.kind, 'keep-streak');
});

test('a streak at risk is ignored when there is no streak to lose', () => {
  const goal = nextGoal(input({ streakAtRisk: true, currentStreak: 0 }));

  assert.notEqual(goal.kind, 'keep-streak');
});

test('the almost-mastered topic is preferred over a distant level', () => {
  const goal = nextGoal(
    input({
      topics: [
        { id: 't1', title: 'Subnetting', mastery: 30 },
        { id: 't2', title: 'OSI Model', mastery: 72 },
      ],
    }),
  );

  assert.equal(goal.kind, 'finish-topic');
  assert.match(goal.title, /OSI Model/);
  assert.match(goal.actionHref, /topic=t2/);
});

test('an untouched topic is not offered as almost-mastered', () => {
  const goal = nextGoal(input({ topics: [{ id: 't1', title: 'Fresh', mastery: 0 }] }));

  assert.notEqual(goal.kind, 'finish-topic');
});

test('an already mastered topic is not offered again', () => {
  const goal = nextGoal(input({ topics: [{ id: 't1', title: 'Done', mastery: 95 }] }));

  assert.equal(goal.kind, 'next-level');
});

test('a level within one round says so', () => {
  const goal = nextGoal(input({ xpToNextLevel: 60 }));

  assert.equal(goal.kind, 'next-level');
  assert.match(goal.detail, /One good round/);
});

test('a distant level states the gap without overpromising', () => {
  const goal = nextGoal(input({ xpToNextLevel: 800 }));

  assert.match(goal.detail, /800 XP to go\./);
  assert.doesNotMatch(goal.detail, /One good round/);
});

test('a finished syllabus is acknowledged rather than left blank', () => {
  const goal = nextGoal(input({ xpToNextLevel: 0, topics: [{ id: 't', title: 'X', mastery: 90 }] }));

  assert.equal(goal.kind, 'all-clear');
});

// ---------------------------------------------------------------- journey

test('exactly one unit is marked current', () => {
  const states = unitStates([90, 40, 0, 0]);

  assert.equal(states.filter((state) => state === 'current').length, 1);
  assert.deepEqual(states, ['mastered', 'current', 'locked', 'locked']);
});

test('a started unit after the current one is not shown as locked', () => {
  const states = unitStates([90, 40, 20, 0]);

  assert.deepEqual(states, ['mastered', 'current', 'started', 'locked']);
});

test('a fully mastered syllabus has no current unit', () => {
  const states = unitStates([85, 90, 100]);

  assert.deepEqual(states, ['mastered', 'mastered', 'mastered']);
});

test('the network metaphor advances in four earned stages', () => {
  assert.equal(networkStage(0), 0);
  assert.equal(networkStage(5), 1);
  assert.equal(networkStage(30), 2);
  assert.equal(networkStage(60), 3);
  assert.equal(networkStage(80), 4);
});
