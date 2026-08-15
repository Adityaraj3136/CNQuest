/**
 * Self-check for the level maths. No framework — run with:
 *   npm run test:units
 * (Node's built-in test runner, using native TypeScript type stripping.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { levelForXp, levelProgress, levelTitle, xpRequiredForLevel } from './level.config.ts';

test('level 1 starts at zero XP', () => {
  assert.equal(xpRequiredForLevel(1), 0);
  assert.equal(levelForXp(0), 1);
});

test('thresholds and levels are inverses of each other', () => {
  for (let level = 1; level <= 10; level += 1) {
    assert.equal(levelForXp(xpRequiredForLevel(level)), level);
  }
});

test('one XP short of a threshold stays on the lower level', () => {
  assert.equal(xpRequiredForLevel(3), 400);
  assert.equal(levelForXp(399), 2);
  assert.equal(levelForXp(400), 3);
});

test('progress within a level is reported as a percentage', () => {
  const progress = levelProgress(500); // level 3 spans 400 -> 900 XP
  assert.equal(progress.level, 3);
  assert.equal(progress.xpIntoLevel, 100);
  assert.equal(progress.xpForLevel, 500);
  assert.equal(progress.percent, 20);
});

test('negative and out-of-range inputs are clamped', () => {
  assert.equal(levelForXp(-50), 1);
  assert.equal(levelTitle(0), levelTitle(1));
  assert.equal(levelTitle(999), levelTitle(8));
});
