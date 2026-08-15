/**
 * Leaderboard ranking self-checks.
 * Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_NAME_LENGTH, publicEntryOf, rankEntries } from './leaderboard.logic.ts';
import type { LeaderboardEntry } from './leaderboard.logic.ts';
import type { UserProfile } from '../models/user.ts';

function entry(uid: string, name: string, totalXP: number, level = 1): LeaderboardEntry {
  return { uid, name, level, totalXP };
}

test('the highest XP ranks first', () => {
  const ranked = rankEntries([entry('a', 'Asha', 120), entry('b', 'Bilal', 900)], null);

  assert.deepEqual(
    ranked.map((row) => row.uid),
    ['b', 'a'],
  );
  assert.deepEqual(
    ranked.map((row) => row.rank),
    [1, 2],
  );
});

test('equal XP shares a rank and the next rank skips', () => {
  const ranked = rankEntries(
    [entry('a', 'Asha', 500), entry('b', 'Bilal', 500), entry('c', 'Chen', 100)],
    null,
  );

  assert.deepEqual(
    ranked.map((row) => row.rank),
    [1, 1, 3],
  );
});

test('a tie is broken by name so the order does not flicker between loads', () => {
  const first = rankEntries([entry('z', 'Asha', 500), entry('a', 'Bilal', 500)], null);
  const second = rankEntries([entry('a', 'Bilal', 500), entry('z', 'Asha', 500)], null);

  assert.deepEqual(
    first.map((row) => row.uid),
    second.map((row) => row.uid),
  );
  assert.equal(first[0].name, 'Asha');
});

test('the signed-in student is flagged so their row can be highlighted', () => {
  const ranked = rankEntries([entry('a', 'Asha', 120), entry('b', 'Bilal', 900)], 'a');

  assert.equal(ranked.find((row) => row.uid === 'a')?.isCurrentUser, true);
  assert.equal(ranked.find((row) => row.uid === 'b')?.isCurrentUser, false);
});

test('an empty leaderboard ranks to an empty list', () => {
  assert.deepEqual(rankEntries([], 'a'), []);
});

test('only public-safe fields are published', () => {
  const profile = {
    uid: 'a',
    name: 'Asha',
    email: 'asha@example.com',
    totalXP: 640,
    level: 3,
    currentStreak: 4,
    longestStreak: 9,
    gamesPlayed: 12,
    questionsAnswered: 80,
    correctAnswers: 61,
    createdAt: null,
    updatedAt: null,
  } satisfies UserProfile;

  assert.deepEqual(publicEntryOf(profile), {
    uid: 'a',
    name: 'Asha',
    level: 3,
    totalXP: 640,
  });
});

test('a long display name is truncated to what the rules accept', () => {
  const published = publicEntryOf({
    uid: 'a',
    name: 'N'.repeat(200),
    email: 'a@example.com',
    totalXP: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    gamesPlayed: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    createdAt: null,
    updatedAt: null,
  });

  assert.equal(published.name.length, MAX_NAME_LENGTH);
});

test('a blank display name falls back rather than publishing an empty row', () => {
  const published = publicEntryOf({
    uid: 'a',
    name: '',
    email: 'a@example.com',
    totalXP: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    gamesPlayed: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    createdAt: null,
    updatedAt: null,
  });

  assert.equal(published.name, 'Student');
});
