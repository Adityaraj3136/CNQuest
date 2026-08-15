/**
 * Guest mode.
 *
 * Lets a student use CN Quest before Firebase is connected — and, later, when they simply
 * do not want an account. The profile lives in localStorage with the same shape as a
 * Firestore profile, so every screen and service reads one `UserProfile` type either way.
 *
 * Progress made as a guest stays on this device. Phase 10's offline-sync work can reuse this
 * store as the local queue when an account is added later.
 */

// Relative (not `@/`) so this module can be loaded directly by the Node test runner,
// which does not understand Vite's path alias. See guest.test.ts.
import { DEFAULT_USER_STATS } from '../models/user.ts';
import type { UserProfile } from '../models/user.ts';

const STORAGE_KEY = 'cn-quest.guest-profile';
/**
 * Session flag kept separate from the profile so signing out ends the session
 * without destroying local progress — returning as a guest resumes it.
 */
const ACTIVE_KEY = 'cn-quest.guest-active';
export const GUEST_UID = 'guest-local';

/**
 * Every localStorage key holding guest data. Declared here (rather than in
 * progress.store.ts) so `deleteGuestProgress` can clear all of it in one place and
 * nothing is left orphaned.
 */
export const GUEST_STORAGE_KEYS = {
  progress: 'cn-quest.guest-progress',
  attempts: 'cn-quest.guest-attempts',
  achievements: 'cn-quest.guest-achievements',
} as const;

/** Guest profiles have no Firestore timestamps — the UI treats these as optional. */
function emptyGuestProfile(name: string): UserProfile {
  return {
    uid: GUEST_UID,
    name,
    email: '',
    ...DEFAULT_USER_STATS,
    createdAt: null,
    updatedAt: null,
  };
}

export function getGuestProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    // Merge over defaults so a profile saved by an older build never breaks a screen.
    return { ...emptyGuestProfile('Guest'), ...parsed, uid: GUEST_UID };
  } catch (error) {
    console.error('[guest] stored profile is unreadable, starting fresh', error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/** True only while a guest session is open — stored progress alone is not enough. */
export function isGuestActive(): boolean {
  return localStorage.getItem(ACTIVE_KEY) === '1' && getGuestProfile() !== null;
}

/** True when guest progress exists on this device, signed in or not. */
export function hasGuestProgress(): boolean {
  return getGuestProfile() !== null;
}

/** Starts a guest session, resuming any progress already stored on this device. */
export function startGuestSession(name = 'Guest'): UserProfile {
  const profile = getGuestProfile() ?? emptyGuestProfile(name.trim() || 'Guest');
  saveGuestProfile(profile);
  localStorage.setItem(ACTIVE_KEY, '1');
  return profile;
}

/** Persists guest progress. Later phases call this after each game result. */
export function saveGuestProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    // Private browsing or a full quota — the session still works, it just will not persist.
    console.error('[guest] could not save progress locally', error);
  }
}

/** Ends the session but keeps local progress, so returning as a guest resumes it. */
export function endGuestSession(): void {
  localStorage.removeItem(ACTIVE_KEY);
}

/**
 * Permanently deletes local guest progress — profile, topic mastery, attempts and
 * achievements. Wired to Settings in Phase 10.
 */
export function deleteGuestProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ACTIVE_KEY);
  Object.values(GUEST_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}
