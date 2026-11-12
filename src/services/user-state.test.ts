/**
 * Cross-device merge checks for synced user state. Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_USER_STATE,
  applyPush,
  changesSince,
  hasChanges,
  mergeUserStates,
  parseUserState,
  type UserState,
} from './user-state.logic.ts';

const state = (overrides: Partial<UserState>): UserState => ({ ...EMPTY_USER_STATE, ...overrides });

test('merge keeps the newer estimate per scope and both devices’ other scopes', () => {
  const phone = state({ skill: { dns: { theta: 1, answered: 9, at: 200 }, osi: { theta: -1, answered: 3, at: 50 } } });
  const laptop = state({ skill: { dns: { theta: 0.2, answered: 4, at: 100 }, dash: { theta: 0.5, answered: 2, at: 80 } } });
  const merged = mergeUserStates(phone, laptop);
  assert.equal(merged.skill.dns.theta, 1);
  assert.deepEqual(Object.keys(merged.skill).sort(), ['dash', 'dns', 'osi']);
  assert.deepEqual(mergeUserStates(laptop, phone), merged, 'order does not matter');
});

test('a reset on one device clears older estimates everywhere but keeps newer ones', () => {
  const resetDevice = state({ skillResetAt: 150 });
  const other = state({ skill: { dns: { theta: 1, answered: 9, at: 100 }, osi: { theta: 0, answered: 1, at: 160 } } });
  const merged = mergeUserStates(resetDevice, other);
  assert.deepEqual(Object.keys(merged.skill), ['osi']);
  assert.equal(merged.skillResetAt, 150);
});

test('best score keeps the higher value; Q-table keeps the newer table', () => {
  const a = state({ dashBest: 900, qTable: { s: { easy: 1 } }, qTableAt: 10 });
  const b = state({ dashBest: 1200, qTable: { s: { hard: 2 } }, qTableAt: 20 });
  const merged = mergeUserStates(a, b);
  assert.equal(merged.dashBest, 1200);
  assert.deepEqual(merged.qTable, { s: { hard: 2 } });
});

test('changesSince lists only what the cloud lacks, and applyPush clears it', () => {
  const cloud = state({ skill: { dns: { theta: 0, answered: 1, at: 10 } }, dashBest: 500 });
  const local = state({
    skill: { dns: { theta: 0, answered: 1, at: 10 }, osi: { theta: 1, answered: 2, at: 30 } },
    dashBest: 700,
  });
  const changes = changesSince(cloud, local);
  assert.deepEqual(changes, { skillScopes: ['osi'], skillReset: false, dashBest: true, qTable: false });
  assert.equal(hasChanges(changesSince(applyPush(cloud, local, changes), local)), false);
  assert.equal(hasChanges(changesSince(local, local)), false);
});

test('a pushed reset replaces the cloud skill map', () => {
  const cloud = state({ skill: { dns: { theta: 2, answered: 9, at: 10 } } });
  const local = state({ skillResetAt: 20 });
  const changes = changesSince(cloud, local);
  assert.equal(changes.skillReset, true);
  assert.deepEqual(applyPush(cloud, local, changes).skill, {});
});

test('parseUserState drops malformed data instead of trusting it', () => {
  assert.deepEqual(parseUserState(null), EMPTY_USER_STATE);
  const parsed = parseUserState({
    skill: { good: { theta: 0.4, answered: 3, at: 5 }, bad: { theta: 'x' }, worse: 7 },
    dashBest: -50,
    qTable: { s: { easy: 1, hard: 'nope' }, junk: 4 },
    qTableAt: 'soon',
  });
  assert.deepEqual(Object.keys(parsed.skill), ['good']);
  assert.equal(parsed.dashBest, 0);
  assert.deepEqual(parsed.qTable, { s: { easy: 1 } });
  assert.equal(parsed.qTableAt, 0);
});
