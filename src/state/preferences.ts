/**
 * Local device preferences: sound and reduced motion.
 *
 * These are per-device, not per-account — a student on a shared lab machine should not
 * inherit someone else's settings, and they must work before sign-in.
 */

const KEY = 'cn-quest.preferences';

export interface Preferences {
  soundEnabled: boolean;
  /** Forces the reduced-motion path even when the OS does not ask for it. */
  reduceMotion: boolean;
  /**
   * Opt in to the experimental Q-learning recommender. Off by default: the transparent
   * rule-based engine is the one students should get unless they choose otherwise.
   */
  experimentalAdaptive: boolean;
  /**
   * Admin editing mode. When on, the course owner sees an "Edit this" control on the content
   * they are looking at. Off by default so the admin can read the app exactly as a student
   * does, which is the only way to notice that something reads badly.
   */
  adminMode: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  soundEnabled: true,
  reduceMotion: false,
  experimentalAdaptive: false,
  adminMode: false,
};

let cached: Preferences | null = null;

export function getPreferences(): Preferences {
  if (cached) return cached;

  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) } : { ...DEFAULT_PREFERENCES };
  } catch (error) {
    console.error('[preferences] unreadable, using defaults', error);
    cached = { ...DEFAULT_PREFERENCES };
  }

  return cached;
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): Preferences {
  const next = { ...getPreferences(), [key]: value };
  cached = next;

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    console.error('[preferences] could not save', error);
  }

  applyPreferences();
  return next;
}

/**
 * Reflects preferences onto the document.
 * `data-reduce-motion` is honoured by global.css alongside the OS-level media query, so a
 * student can opt out of motion even when their system does not.
 */
export function applyPreferences(): void {
  const { reduceMotion } = getPreferences();
  document.documentElement.toggleAttribute('data-reduce-motion', reduceMotion);
}
