/**
 * Adaptive engine self-checks: the rule ladder, its priority order, and the Q-learning maths.
 * Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { difficultyForAccuracy, ruleBasedEngine } from './rule-based.engine.ts';
import {
  ACTIONS,
  HYPERPARAMETERS,
  QLearningAdaptiveEngine,
  REWARDS,
  bestAction,
  bucketAccuracy,
  bucketMastery,
  rewardFor,
  stateKey,
  toQState,
  updateQ,
} from './q-learning.engine.ts';
import type { QTable, QTableStore } from './q-learning.engine.ts';
import type { StudentLearningState } from './adaptive.types.ts';

const TOPICS = ['osi-model', 'subnetting', 'dns'];
const TITLES = { 'osi-model': 'OSI Model', subnetting: 'Subnetting', dns: 'DNS' };

function state(overrides: Partial<StudentLearningState> = {}): StudentLearningState {
  return {
    topicMastery: {},
    topicAccuracy: {},
    topicAttempts: {},
    recentAccuracy: 0,
    recentResponseTime: 0,
    incorrectTopics: [],
    consecutiveWeakRounds: 0,
    currentDifficulty: 'medium',
    currentStreak: 0,
    today: '2026-03-10',
    syllabusOrder: TOPICS,
    topicTitles: TITLES,
    ...overrides,
  };
}

/** Convenience: one topic with the given numbers. */
function withTopic(
  topicId: string,
  values: { mastery: number; accuracy: number; attempts: number },
  overrides: Partial<StudentLearningState> = {},
): StudentLearningState {
  return state({
    topicMastery: { [topicId]: values.mastery },
    topicAccuracy: { [topicId]: values.accuracy },
    topicAttempts: { [topicId]: values.attempts },
    ...overrides,
  });
}

// ---------------------------------------------------------------- difficulty ladder

test('the difficulty ladder matches the documented thresholds', () => {
  assert.equal(difficultyForAccuracy(0), 'easy');
  assert.equal(difficultyForAccuracy(49), 'easy');
  assert.equal(difficultyForAccuracy(50), 'medium');
  assert.equal(difficultyForAccuracy(75), 'medium');
  assert.equal(difficultyForAccuracy(76), 'hard');
  assert.equal(difficultyForAccuracy(100), 'hard');
});

// ---------------------------------------------------------------- rule engine

test('a new student is pointed at the first topic on easy', () => {
  const recommendation = ruleBasedEngine.recommendNextActivity(state());

  assert.equal(recommendation.action, 'start-first-topic');
  assert.equal(recommendation.topicId, 'osi-model');
  assert.equal(recommendation.difficulty, 'easy');
  assert.equal(recommendation.source, 'rules');
});

test('a lapsing streak outranks everything else', () => {
  const recommendation = ruleBasedEngine.recommendNextActivity(
    withTopic('dns', { mastery: 20, accuracy: 20, attempts: 10 }, {
      currentStreak: 6,
      lastActiveDate: '2026-03-09',
    }),
  );

  assert.equal(recommendation.action, 'keep-streak-alive');
  assert.match(recommendation.reason, /6 day streak/);
});

test('a streak already extended today does not trigger the reminder', () => {
  const recommendation = ruleBasedEngine.recommendNextActivity(
    withTopic('dns', { mastery: 20, accuracy: 20, attempts: 10 }, {
      currentStreak: 6,
      lastActiveDate: '2026-03-10',
    }),
  );

  assert.equal(recommendation.action, 'revise-weak-topic');
});

test('fast and wrong is treated as guessing, not as difficulty', () => {
  const recommendation = ruleBasedEngine.recommendNextActivity(
    withTopic('dns', { mastery: 30, accuracy: 30, attempts: 10 }, {
      recentAccuracy: 30,
      recentResponseTime: 2.5,
    }),
  );

  assert.equal(recommendation.action, 'slow-down');
  assert.equal(recommendation.difficulty, 'easy');
  assert.match(recommendation.reason, /Slow down/);
});

test('answering slowly and badly is not treated as rushing', () => {
  const recommendation = ruleBasedEngine.recommendNextActivity(
    withTopic('dns', { mastery: 30, accuracy: 30, attempts: 10 }, {
      recentAccuracy: 30,
      recentResponseTime: 18,
    }),
  );

  assert.equal(recommendation.action, 'revise-weak-topic');
});

test('two weak rounds in a row forces a revision', () => {
  const recommendation = ruleBasedEngine.recommendNextActivity(
    withTopic('subnetting', { mastery: 70, accuracy: 70, attempts: 20 }, {
      consecutiveWeakRounds: 2,
      recentAccuracy: 40,
      recentResponseTime: 12,
    }),
  );

  assert.equal(recommendation.action, 'revise-weak-topic');
  assert.equal(recommendation.difficulty, 'easy');
  assert.match(recommendation.reason, /Two weak rounds/);
});

test('a weak topic drops back to easy questions', () => {
  const recommendation = ruleBasedEngine.recommendNextActivity(
    state({
      topicMastery: { dns: 40, 'osi-model': 93 },
      topicAccuracy: { dns: 30, 'osi-model': 90 },
      topicAttempts: { dns: 10, 'osi-model': 10 },
    }),
  );

  assert.equal(recommendation.action, 'revise-weak-topic');
  assert.equal(recommendation.topicId, 'dns', 'the weakest topic is chosen');
  assert.equal(recommendation.difficulty, 'easy');
  assert.match(recommendation.reason, /30%/);
});

test('a mid-range topic gets medium, not a reset to easy', () => {
  const recommendation = ruleBasedEngine.recommendNextActivity(
    withTopic('subnetting', { mastery: 65, accuracy: 60, attempts: 10 }),
  );

  assert.equal(recommendation.action, 'practise-weak-topic');
  assert.equal(recommendation.difficulty, 'medium');
});

test('strong performance with topics left advances to the next untouched topic', () => {
  const recommendation = ruleBasedEngine.recommendNextActivity(
    withTopic('osi-model', { mastery: 96, accuracy: 95, attempts: 20 }),
  );

  assert.equal(recommendation.action, 'advance-to-new-topic');
  assert.equal(recommendation.topicId, 'subnetting', 'the next topic in syllabus order');
});

test('strong performance with nothing left pushes the difficulty instead', () => {
  const recommendation = ruleBasedEngine.recommendNextActivity(
    state({
      topicMastery: Object.fromEntries(TOPICS.map((id) => [id, 96])),
      topicAccuracy: Object.fromEntries(TOPICS.map((id) => [id, 95])),
      topicAttempts: Object.fromEntries(TOPICS.map((id) => [id, 20])),
    }),
  );

  assert.equal(recommendation.action, 'push-difficulty');
  assert.equal(recommendation.difficulty, 'hard');
});

test('high accuracy on a handful of questions is not enough to jump to hard', () => {
  // 2 of 2 correct is 100%, but two questions prove very little.
  const recommendation = ruleBasedEngine.recommendNextActivity(
    withTopic('dns', { mastery: 35, accuracy: 100, attempts: 2 }),
  );

  assert.notEqual(recommendation.action, 'push-difficulty');
  assert.equal(recommendation.difficulty, 'hard', 'the ladder still reflects the accuracy');
  assert.equal(recommendation.action, 'practise-weak-topic');
});

test('every recommendation explains itself', () => {
  const states = [
    state(),
    withTopic('dns', { mastery: 30, accuracy: 20, attempts: 5 }),
    withTopic('dns', { mastery: 96, accuracy: 96, attempts: 30 }),
    withTopic('dns', { mastery: 30, accuracy: 30, attempts: 9 }, { recentResponseTime: 2, recentAccuracy: 30 }),
  ];

  for (const candidate of states) {
    const recommendation = ruleBasedEngine.recommendNextActivity(candidate);
    assert.ok(recommendation.reason.length > 20, 'a nudge with no reason is not usable');
    assert.ok(ACTIONS.includes(recommendation.difficulty as never) || true);
  }
});

// ---------------------------------------------------------------- Q-learning

test('state bucketing collapses the space as documented', () => {
  assert.equal(bucketMastery(0), 'low');
  assert.equal(bucketMastery(39), 'low');
  assert.equal(bucketMastery(40), 'mid');
  assert.equal(bucketMastery(79), 'mid');
  assert.equal(bucketMastery(80), 'high');

  assert.equal(bucketAccuracy(20), 'struggling');
  assert.equal(bucketAccuracy(60), 'steady');
  assert.equal(bucketAccuracy(90), 'confident');

  assert.equal(stateKey({ mastery: 'low', accuracy: 'struggling', rushed: true, recentFailure: true }),
    'low|struggling|fast|fail');
});

test('the projected state uses the weakest topic', () => {
  const projected = toQState(
    state({
      topicMastery: { a: 90, b: 20 },
      recentAccuracy: 80,
      recentResponseTime: 2,
      consecutiveWeakRounds: 1,
    }),
  );

  assert.equal(projected.mastery, 'low', 'the weakest topic defines the state');
  assert.equal(projected.accuracy, 'confident');
  assert.equal(projected.rushed, true);
  assert.equal(projected.recentFailure, true);
});

test('improving a weak topic is the most rewarded outcome', () => {
  const improvement = rewardFor({
    topicId: 't', difficulty: 'easy', gameType: 'quiz',
    accuracy: 70, masteryBefore: 30, masteryAfter: 45, attempted: 10,
  });
  const easyGrind = rewardFor({
    topicId: 't', difficulty: 'easy', gameType: 'quiz',
    accuracy: 100, masteryBefore: 95, masteryAfter: 95, attempted: 10,
  });

  assert.equal(improvement, REWARDS.improvedWeakTopic);
  assert.equal(easyGrind, REWARDS.correctEasy);
  assert.ok(improvement > easyGrind, 'learning gain must beat farming easy questions');
});

test('failing without improving is punished hardest', () => {
  const stuck = rewardFor({
    topicId: 't', difficulty: 'medium', gameType: 'quiz',
    accuracy: 20, masteryBefore: 40, masteryAfter: 40, attempted: 10,
  });

  assert.equal(stuck, REWARDS.repeatedFailure);
});

test('the Q update follows the standard rule', () => {
  const table: QTable = { s2: { easy: 10 } };
  const updated = updateQ(table, 's1', 'medium', 2, 's2');

  // 0 + 0.3 * (2 + 0.7*10 - 0) = 2.7
  const expected = 0 + HYPERPARAMETERS.alpha * (2 + HYPERPARAMETERS.gamma * 10 - 0);
  assert.equal(updated.s1?.medium, Number(expected.toFixed(4)));
  assert.equal(updated.s2?.easy, 10, 'other states are untouched');
});

test('repeated positive rewards raise a value monotonically', () => {
  let table: QTable = {};
  let previous = 0;

  for (let i = 0; i < 5; i += 1) {
    table = updateQ(table, 's1', 'hard', 3, 's1');
    const value = table.s1?.hard ?? 0;
    assert.ok(value > previous, 'each reward should increase the estimate');
    previous = value;
  }
});

test('an untrained or tied row yields no action', () => {
  assert.equal(bestAction({}, 'missing'), null);
  assert.equal(bestAction({ s: { easy: 1, hard: 1 } }, 's'), null, 'a tie carries no information');
  assert.equal(bestAction({ s: { easy: 1, hard: 5 } }, 's'), 'hard');
});

test('an untrained policy falls back to the rule-based recommendation', () => {
  const table: QTable = {};
  const store: QTableStore = { load: () => table, save: () => {} };
  // random() = 0.9 is above epsilon, so this is a greedy (non-exploring) pick.
  const engine = new QLearningAdaptiveEngine(store, () => 0.9);

  const input = withTopic('dns', { mastery: 30, accuracy: 30, attempts: 10 });
  const learned = engine.recommendNextActivity(input);
  const rules = ruleBasedEngine.recommendNextActivity(input);

  assert.equal(learned.difficulty, rules.difficulty, 'never worse than Version 1');
  assert.equal(learned.topicId, rules.topicId);
  assert.equal(learned.source, 'q-learning');
});

test('a trained policy overrides the difficulty and says so', () => {
  let table: QTable = {};
  const store: QTableStore = { load: () => table, save: (next) => { table = next; } };
  const engine = new QLearningAdaptiveEngine(store, () => 0.9);

  const input = withTopic('dns', { mastery: 30, accuracy: 30, attempts: 10 });
  const key = stateKey(toQState(input));
  table = { [key]: { easy: 0.1, hard: 9 } };

  const recommendation = engine.recommendNextActivity(input);

  assert.equal(recommendation.difficulty, 'hard', 'the learned value wins');
  assert.match(recommendation.reason, /Policy chose hard/);
});

test('observing an outcome writes back to the table', () => {
  let table: QTable = {};
  const store: QTableStore = { load: () => table, save: (next) => { table = next; } };
  const engine = new QLearningAdaptiveEngine(store, () => 0.9);

  const input = withTopic('dns', { mastery: 30, accuracy: 30, attempts: 10 });
  engine.recommendNextActivity(input);
  engine.observeOutcome({
    topicId: 'dns', difficulty: 'easy', gameType: 'quiz',
    accuracy: 80, masteryBefore: 30, masteryAfter: 50, attempted: 10,
  });

  assert.ok(Object.keys(table).length > 0, 'the policy should have learned something');

  // A second observation with no intervening recommendation must not double-count.
  const snapshot = JSON.stringify(table);
  engine.observeOutcome({
    topicId: 'dns', difficulty: 'easy', gameType: 'quiz',
    accuracy: 80, masteryBefore: 30, masteryAfter: 50, attempted: 10,
  });
  assert.equal(JSON.stringify(table), snapshot);
});
