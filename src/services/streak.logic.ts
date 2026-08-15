/**
 * Daily streak rules — pure date arithmetic, no storage.
 *
 * Streaks are evaluated against the student's **local calendar date**, not UTC and not
 * elapsed hours: playing at 23:50 and again at 00:10 is two days, and playing twice in one
 * evening is one. Getting this wrong is the classic streak bug, so it is isolated and tested.
 */

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  /** Local calendar date of the last qualifying activity, `YYYY-MM-DD`. */
  lastActiveDate?: string;
}

export interface StreakUpdate extends StreakState {
  lastActiveDate: string;
  /** True when this activity extended the streak (not a repeat visit on the same day). */
  incremented: boolean;
  /** True when a missed day reset the count back to 1. */
  broken: boolean;
}

/** Local calendar date as `YYYY-MM-DD`. Never use toISOString here — that is UTC. */
export function toLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whole days between two `YYYY-MM-DD` keys, ignoring time and DST shifts. */
export function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  // UTC midnight for both, so a DST change cannot make a day 23 or 25 hours long.
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Applies one qualifying day of activity.
 *
 * Same day  → unchanged (a streak counts days, not sessions)
 * Yesterday → +1
 * Older/none→ reset to 1
 * Future    → treated as a fresh day (clock skew should never inflate a streak)
 */
export function applyActivity(state: StreakState, today: string = toLocalDateKey()): StreakUpdate {
  const current = Math.max(0, state.currentStreak);
  const longest = Math.max(0, state.longestStreak);

  if (!state.lastActiveDate) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(longest, 1),
      lastActiveDate: today,
      incremented: true,
      broken: false,
    };
  }

  const gap = daysBetween(state.lastActiveDate, today);

  if (gap === 0) {
    return {
      currentStreak: current,
      longestStreak: Math.max(longest, current),
      lastActiveDate: state.lastActiveDate,
      incremented: false,
      broken: false,
    };
  }

  if (gap === 1) {
    const next = current + 1;
    return {
      currentStreak: next,
      longestStreak: Math.max(longest, next),
      lastActiveDate: today,
      incremented: true,
      broken: false,
    };
  }

  // Missed at least one day, or the clock moved backwards.
  return {
    currentStreak: 1,
    longestStreak: Math.max(longest, current),
    lastActiveDate: today,
    incremented: true,
    broken: gap > 1,
  };
}

/** True when the streak shown to the student is stale and should read 0. */
export function isStreakExpired(state: StreakState, today: string = toLocalDateKey()): boolean {
  if (!state.lastActiveDate || state.currentStreak === 0) return false;
  return daysBetween(state.lastActiveDate, today) > 1;
}
