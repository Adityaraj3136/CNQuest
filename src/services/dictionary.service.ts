/**
 * Dictionary reading history.
 *
 * Viewed terms are stored as a set of ids, not a counter, so re-reading DNS ten times counts
 * once. That set drives the Dictionary Explorer achievement.
 */

import { activeStore, countersOf } from '@/services/progress.store';
import { evaluateAndUnlock } from '@/services/achievement.service';
import { refreshProfile } from '@/state/session';
import type { Achievement } from '@/models/content';

export interface TermViewResult {
  /** True when this was the first time the term was opened. */
  isNew: boolean;
  totalViewed: number;
  unlockedAchievements: Achievement[];
}

const NOT_RECORDED: TermViewResult = { isNew: false, totalViewed: 0, unlockedAchievements: [] };

/** Ids already read by the current student. */
export async function loadViewedTerms(): Promise<string[]> {
  const store = activeStore();
  if (!store) return [];

  try {
    const profile = await store.loadProfile();
    return profile?.viewedTerms ?? [];
  } catch (error) {
    console.error('[dictionary] could not read view history', error);
    return [];
  }
}

/**
 * Records that a term was opened. A repeat view is a no-op, so this is safe to call on
 * every open. Never throws — failing to log a view must not break reading the dictionary.
 */
export async function recordTermView(termId: string): Promise<TermViewResult> {
  const store = activeStore();
  if (!store) return NOT_RECORDED;

  try {
    const profile = await store.loadProfile();
    if (!profile) return NOT_RECORDED;

    const viewed = new Set(profile.viewedTerms ?? []);
    if (viewed.has(termId)) {
      return { isNew: false, totalViewed: viewed.size, unlockedAchievements: [] };
    }

    viewed.add(termId);
    const viewedTerms = [...viewed];
    const counters = { ...countersOf(profile), dictionaryTermsViewed: viewedTerms.length };
    const updated = { ...profile, viewedTerms, counters };

    await store.saveProfile(updated);

    const unlockedAchievements = await evaluateAndUnlock(store, updated, {
      gamesPlayed: profile.gamesPlayed,
      correctAnswers: profile.correctAnswers,
      currentStreak: profile.currentStreak,
    });

    if (unlockedAchievements.length > 0) {
      // Badge XP still has to land on the profile.
      const rewardXp = unlockedAchievements.reduce((sum, entry) => sum + entry.rewardXP, 0);
      await store.saveProfile({ ...updated, totalXP: updated.totalXP + rewardXp });
    }

    await refreshProfile();
    return { isNew: true, totalViewed: viewedTerms.length, unlockedAchievements };
  } catch (error) {
    console.error('[dictionary] could not record term view', error);
    return NOT_RECORDED;
  }
}
