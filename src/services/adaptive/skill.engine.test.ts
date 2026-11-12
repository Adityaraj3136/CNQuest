/**
 * Skill model self-checks: the estimate moves the right way, settles, and steers item choice.
 * Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HESITANT_TIME_RATIO,
  K_MIN,
  NEW_SKILL,
  THETA_LIMIT,
  bestDifficulty,
  chooseQuestion,
  intensity,
  priorFromAccuracy,
  promoteChoice,
  recordAnswer,
  stepSize,
  successChance,
  type SkillState,
} from './skill.engine.ts';
import type { Difficulty } from '../../models/content.ts';

function play(start: SkillState, answers: Array<[Difficulty, boolean]>): SkillState {
  return answers.reduce((state, [level, ok]) => recordAnswer(state, level, ok), start);
}

test('a correct answer raises ability, a wrong one lowers it, and the input is not mutated', () => {
  const start = { ...NEW_SKILL };
  const up = recordAnswer(start, 'medium', true);
  const down = recordAnswer(start, 'medium', false);
  assert.ok(up.theta > 0 && down.theta < 0);
  assert.deepEqual(start, NEW_SKILL);
  assert.equal(up.answered, 1);
});

test('beating a hard item moves the estimate more than beating an easy one', () => {
  const hard = recordAnswer(NEW_SKILL, 'hard', true);
  const easy = recordAnswer(NEW_SKILL, 'easy', true);
  assert.ok(hard.theta > easy.theta);
});

test('a correct answer that used most of the clock counts for less', () => {
  const quick = recordAnswer(NEW_SKILL, 'medium', true, 0.2);
  const slow = recordAnswer(NEW_SKILL, 'medium', true, HESITANT_TIME_RATIO);
  assert.ok(slow.theta < quick.theta && slow.theta > 0);
});

test('step size shrinks with evidence but never below the floor', () => {
  assert.ok(stepSize(0) > stepSize(20));
  assert.equal(stepSize(10_000), K_MIN);
});

test('ability stays inside its limits on an endless streak', () => {
  const streak = Array.from({ length: 300 }, (): [Difficulty, boolean] => ['hard', true]);
  assert.ok(play(NEW_SKILL, streak).theta <= THETA_LIMIT);
});

test('a new student starts easy and climbs to hard on a run of correct answers', () => {
  assert.equal(bestDifficulty(NEW_SKILL.theta), 'easy');
  let state = NEW_SKILL;
  const seen: Difficulty[] = [];
  for (let i = 0; i < 12; i += 1) {
    const level = bestDifficulty(state.theta);
    seen.push(level);
    state = recordAnswer(state, level, true);
  }
  assert.ok(seen.includes('medium'), `levels seen: ${seen.join(',')}`);
  assert.equal(seen.at(-1), 'hard');
});

test('a struggling student is brought back down to easy', () => {
  const strong = { theta: 1.2, answered: 5 };
  assert.equal(bestDifficulty(strong.theta), 'medium');
  const after = play(strong, [['medium', false], ['medium', false], ['medium', false], ['easy', false]]);
  assert.equal(bestDifficulty(after.theta), 'easy');
});

test('the chosen level keeps predicted success near the 70% target', () => {
  for (const theta of [-1, 0, 0.8, 1.9]) {
    const chance = successChance(theta, bestDifficulty(theta));
    assert.ok(chance > 0.45 && chance < 0.95, `theta ${theta}: ${chance}`);
  }
});

test('bestDifficulty only offers levels that are actually available', () => {
  assert.equal(bestDifficulty(3, ['easy', 'medium']), 'medium');
  assert.equal(bestDifficulty(-3, ['hard']), 'hard');
});

test('intensity is 0.5 for a new student and clamps to 0..1', () => {
  assert.equal(intensity(0), 0.5);
  assert.equal(intensity(-9), 0);
  assert.equal(intensity(9), 1);
});

test('prior from history: none means new, good accuracy means above average', () => {
  assert.deepEqual(priorFromAccuracy(90, 0), NEW_SKILL);
  assert.ok(priorFromAccuracy(85, 40).theta > 0);
  assert.ok(priorFromAccuracy(30, 40).theta < 0);
});

test('chooseQuestion picks the first item at the best available level', () => {
  const rest = [{ difficulty: 'hard' as const }, { difficulty: 'easy' as const }, { difficulty: 'easy' as const }];
  assert.equal(chooseQuestion(rest, 0), 1);
  assert.equal(chooseQuestion(rest, 3), 0);
  assert.equal(chooseQuestion([], 0), -1);
});

test('promoteChoice swaps the pick into place, and does nothing without a picker', () => {
  const items = ['a', 'b', 'c', 'd'];
  promoteChoice(items, 1, (rest) => rest.indexOf('d'));
  assert.deepEqual(items, ['a', 'd', 'c', 'b']);
  promoteChoice(items, 1);
  promoteChoice(items, 1, () => -1);
  promoteChoice(items, 9, () => 1);
  assert.deepEqual(items, ['a', 'd', 'c', 'b']);
});
