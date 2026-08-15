/**
 * Self-check for guest-mode storage. Run with: npm run test:units
 *
 * The important guarantee here: signing out of guest mode must END THE SESSION
 * without deleting local progress. Only an explicit delete removes it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage stub — must exist before the module under test is imported.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
};

const {
  startGuestSession,
  endGuestSession,
  deleteGuestProgress,
  getGuestProfile,
  hasGuestProgress,
  isGuestActive,
  saveGuestProfile,
} = await import('./guest.ts');

test('a new guest starts at level 1 with zero XP', () => {
  store.clear();
  const profile = startGuestSession();

  assert.equal(profile.level, 1);
  assert.equal(profile.totalXP, 0);
  assert.equal(profile.currentStreak, 0);
  assert.equal(isGuestActive(), true);
});

test('signing out keeps progress but ends the session', () => {
  store.clear();
  const profile = startGuestSession();
  saveGuestProfile({ ...profile, totalXP: 250, level: 2 });

  endGuestSession();

  assert.equal(isGuestActive(), false, 'session must be closed');
  assert.equal(hasGuestProgress(), true, 'progress must survive sign-out');
  assert.equal(getGuestProfile()?.totalXP, 250);
});

test('returning as a guest resumes the stored progress', () => {
  store.clear();
  saveGuestProfile({ ...startGuestSession(), totalXP: 900 });
  endGuestSession();

  const resumed = startGuestSession();

  assert.equal(resumed.totalXP, 900);
  assert.equal(isGuestActive(), true);
});

test('deleting progress removes everything', () => {
  store.clear();
  startGuestSession();

  deleteGuestProgress();

  assert.equal(isGuestActive(), false);
  assert.equal(hasGuestProgress(), false);
  assert.equal(getGuestProfile(), null);
});

test('stored progress alone does not open a session', () => {
  store.clear();
  saveGuestProfile({ ...startGuestSession(), totalXP: 10 });
  endGuestSession();

  assert.equal(isGuestActive(), false);
});

test('corrupt stored data is discarded instead of throwing', () => {
  store.clear();
  store.set('cn-quest.guest-profile', '{not json');

  assert.equal(getGuestProfile(), null);
  assert.equal(hasGuestProgress(), false);
});

test('a profile saved by an older build is merged over current defaults', () => {
  store.clear();
  store.set('cn-quest.guest-profile', JSON.stringify({ name: 'Ritesh', totalXP: 40 }));

  const profile = getGuestProfile();

  assert.equal(profile?.name, 'Ritesh');
  assert.equal(profile?.totalXP, 40);
  assert.equal(profile?.level, 1, 'missing fields fall back to defaults');
  assert.equal(profile?.uid, 'guest-local');
});
