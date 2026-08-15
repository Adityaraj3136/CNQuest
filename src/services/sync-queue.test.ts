/**
 * Offline queue self-checks. Run with: npm run test:units
 *
 * This queue is the only thing standing between a student playing on the bus and losing the
 * round, so its edges are worth pinning: per-user isolation, retry exhaustion, and a cap that
 * stops a broken sync from filling localStorage.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
};

const {
  MAX_REPLAY_ATTEMPTS,
  clearQueue,
  enqueueResult,
  isExhausted,
  markAttempted,
  pendingCount,
  pendingResults,
  removeQueued,
} = await import('./sync-queue.ts');

const RESULT = {
  gameType: 'quiz' as const,
  topicId: 'osi-model',
  attempted: 10,
  correct: 8,
  wrong: 2,
  score: 8,
  accuracy: 80,
  xpEarned: 100,
  durationSeconds: 120,
};

test('a queued result can be read back', () => {
  store.clear();
  const entry = enqueueResult('user-1', RESULT, { bossVictory: true });

  assert.equal(pendingCount(), 1);
  const [queued] = pendingResults();
  assert.equal(queued.id, entry.id);
  assert.equal(queued.userId, 'user-1');
  assert.equal(queued.result.correct, 8);
  assert.equal(queued.extras.bossVictory, true);
  assert.equal(queued.attempts, 0);
});

test('the queue is filtered per user', () => {
  store.clear();
  enqueueResult('user-1', RESULT);
  enqueueResult('user-2', RESULT);
  enqueueResult('user-1', RESULT);

  assert.equal(pendingCount('user-1'), 2);
  assert.equal(pendingCount('user-2'), 1);
  assert.equal(pendingCount(), 3, 'no filter returns everything');
});

test('queued ids are unique even within the same millisecond', () => {
  store.clear();
  const ids = Array.from({ length: 20 }, () => enqueueResult('user-1', RESULT).id);
  assert.equal(new Set(ids).size, 20);
});

test('removing an entry leaves the rest intact', () => {
  store.clear();
  const first = enqueueResult('user-1', RESULT);
  enqueueResult('user-1', RESULT);

  removeQueued(first.id);

  assert.equal(pendingCount(), 1);
  assert.ok(!pendingResults().some((entry) => entry.id === first.id));
});

test('attempts accumulate and eventually exhaust', () => {
  store.clear();
  const entry = enqueueResult('user-1', RESULT);

  for (let i = 0; i < MAX_REPLAY_ATTEMPTS; i += 1) {
    assert.equal(isExhausted(pendingResults()[0]), i >= MAX_REPLAY_ATTEMPTS);
    markAttempted(entry.id);
  }

  assert.equal(pendingResults()[0].attempts, MAX_REPLAY_ATTEMPTS);
  assert.equal(isExhausted(pendingResults()[0]), true, 'a permanently failing entry must stop retrying');
});

test('clearing by user leaves other users alone', () => {
  store.clear();
  enqueueResult('user-1', RESULT);
  enqueueResult('user-2', RESULT);

  clearQueue('user-1');

  assert.equal(pendingCount('user-1'), 0);
  assert.equal(pendingCount('user-2'), 1);
});

test('the queue is capped so a broken sync cannot fill storage', () => {
  store.clear();
  for (let i = 0; i < 80; i += 1) enqueueResult('user-1', RESULT);

  assert.equal(pendingCount(), 50, 'the oldest entries are dropped past the cap');
});

test('corrupt queue data is discarded instead of throwing', () => {
  store.clear();
  store.set('cn-quest.pending-results', 'not json at all');

  assert.deepEqual(pendingResults(), []);
  assert.equal(pendingCount(), 0);
});
