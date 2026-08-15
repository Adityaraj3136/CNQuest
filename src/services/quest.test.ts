/**
 * Quest-state self-checks. Run with: npm run test:units
 *
 * The state a topic shows is the whole navigational signal on the Learn screen, so getting it
 * wrong sends every student to the wrong place at once.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { isTopicComplete, questReward, rankUnitQuests, summariseUnit } from './quest.logic.ts';
import type { QuestTopic } from './quest.logic.ts';

function topic(id: string, questionCount = 6): QuestTopic {
  return { id, title: id, description: '', estimatedMinutes: 8, questionCount };
}

const THREE = [topic('a'), topic('b'), topic('c')];

test('the first unfinished topic is the current quest', () => {
  const ranked = rankUnitQuests(THREE, { a: 95 });

  assert.deepEqual(
    ranked.map((quest) => quest.state),
    ['completed', 'current', 'available'],
  );
});

test('exactly one quest is ever current', () => {
  const ranked = rankUnitQuests(THREE, {});

  assert.equal(ranked.filter((quest) => quest.state === 'current').length, 1);
});

test('an untouched unit shows later quests as locked rather than available', () => {
  const ranked = rankUnitQuests(THREE, {}, { unitStarted: false });

  assert.deepEqual(
    ranked.map((quest) => quest.state),
    ['current', 'locked', 'locked'],
  );
});

test('a fully mastered unit has no current quest left', () => {
  const ranked = rankUnitQuests(THREE, { a: 90, b: 85, c: 100 });

  assert.deepEqual(
    ranked.map((quest) => quest.state),
    ['completed', 'completed', 'completed'],
  );
});

test('quests are numbered from one within their unit', () => {
  const ranked = rankUnitQuests(THREE, {});

  assert.deepEqual(
    ranked.map((quest) => quest.number),
    [1, 2, 3],
  );
});

test('completion uses the same bar a unit is judged by', () => {
  // Otherwise a topic could read "done" on Learn and still drag the unit average down.
  assert.equal(isTopicComplete(79), false);
  assert.equal(isTopicComplete(80), true);
});

test('reward scales with question count but never reads as trivial', () => {
  assert.equal(questReward(6), 60);
  assert.equal(questReward(1), 20);
});

test('reward is capped so a huge topic does not promise absurd XP', () => {
  assert.equal(questReward(40), 100);
});

test('a unit summary counts completed quests and averages mastery', () => {
  const summary = summariseUnit(THREE, { a: 90, b: 60, c: 0 });

  assert.equal(summary.completedCount, 1);
  assert.equal(summary.mastery, 50);
  assert.equal(summary.mastered, false);
  assert.equal(summary.started, true);
});

test('a unit is mastered only when every quest in it is', () => {
  const summary = summariseUnit(THREE, { a: 90, b: 90, c: 90 });

  assert.equal(summary.mastered, true);
});

test('an untouched unit reports as not started', () => {
  const summary = summariseUnit(THREE, {});

  assert.equal(summary.started, false);
  assert.equal(summary.mastery, 0);
});

test('an empty unit summarises without dividing by zero', () => {
  const summary = summariseUnit([], {});

  assert.equal(summary.mastery, 0);
  assert.equal(summary.mastered, false);
});
