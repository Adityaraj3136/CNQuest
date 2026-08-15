/**
 * Achievements — the catalogue with live progress towards each badge.
 * Reads the same pure evaluator the result pipeline uses, so the two can never disagree.
 */

import type { Page } from '@/types/page';
import { getAchievements } from '@/services/content.service';
import { achievementProgress } from '@/services/achievement.logic';
import { activeStore, countersOf } from '@/services/progress.store';
import { isUnitMastered, unitMastery } from '@/services/mastery.logic';
import { getTopics } from '@/services/content.service';
import { escapeHtml, qs } from '@/utils/dom';
import { loaderHtml, stateHtml } from '@/components/loader';
import type { AchievementProgress } from '@/services/achievement.logic';
import '@/styles/achievements.css';

const ROOT_ID = 'cn-achievements-root';

/**
 * One badge.
 *
 * A locked badge still shows exactly what it takes and how close you are, because a
 * collection you cannot see the shape of is not worth collecting. Only unlocked badges get
 * colour; the rest stay grey so the earned ones are findable at a glance.
 */
function rowHtml(row: AchievementProgress): string {
  const { achievement, unlocked, value, target, percent } = row;

  return `
    <article class="cn-badge" data-unlocked="${unlocked}">
      <span class="cn-badge__medal" aria-hidden="true">
        <i class="bi ${escapeHtml(achievement.icon)}"></i>
      </span>

      <h2 class="cn-badge__name">${escapeHtml(achievement.name)}</h2>
      <p class="cn-badge__desc">${escapeHtml(achievement.description)}</p>

      ${
        unlocked
          ? `<p class="cn-badge__status">Unlocked · +${achievement.rewardXP} XP</p>`
          : `
            <div class="cn-badge__meter">
              <div class="cn-badge__bar"><span style="width:${percent}%"></span></div>
              <span class="cn-badge__count">${value}/${target}</span>
            </div>
            <p class="cn-badge__status">+${achievement.rewardXP} XP when earned</p>
          `
      }
    </article>
  `;
}

/** Units currently at or above the mastery threshold — the Network Expert counter. */
async function masteredUnitCount(): Promise<number> {
  const store = activeStore();
  if (!store) return 0;

  const [topics, progress] = await Promise.all([getTopics(), store.loadAllProgress()]);
  const byUnit = new Map<string, { masteries: number[]; total: number }>();

  for (const topic of topics) {
    const entry = byUnit.get(topic.unitId) ?? { masteries: [], total: 0 };
    entry.total += 1;
    byUnit.set(topic.unitId, entry);
  }
  for (const entry of progress) {
    byUnit.get(entry.unitId)?.masteries.push(entry.mastery);
  }

  let mastered = 0;
  for (const { masteries, total } of byUnit.values()) {
    if (isUnitMastered(unitMastery(masteries, total))) mastered += 1;
  }
  return mastered;
}

async function bodyHtml(): Promise<string> {
  const store = activeStore();
  if (!store) {
    return stateHtml({
      icon: 'bi-trophy',
      title: 'Sign in to track achievements',
      message: 'Achievements are tied to your progress. Log in or continue as a guest to start earning them.',
      actionLabel: 'Login',
      actionHref: '#/login',
    });
  }

  const [catalogue, profile, held, unitsMastered] = await Promise.all([
    getAchievements(),
    store.loadProfile(),
    store.loadUnlockedAchievements(),
    masteredUnitCount(),
  ]);

  const counters = countersOf(profile);
  const rows = achievementProgress(
    catalogue,
    {
      totalCorrectAnswers: profile?.correctAnswers ?? 0,
      totalGamesPlayed: profile?.gamesPlayed ?? 0,
      currentStreak: profile?.currentStreak ?? 0,
      bossWins: counters.bossWins,
      riddlesSolvedWithoutHint: counters.riddlesSolvedWithoutHint,
      dictionaryTermsViewed: counters.dictionaryTermsViewed,
      modesPlayed: counters.modesPlayed,
      unitsMastered,
    },
    held,
  );

  const unlockedCount = rows.filter((row) => row.unlocked).length;
  const earnedXp = rows
    .filter((row) => row.unlocked)
    .reduce((sum, row) => sum + row.achievement.rewardXP, 0);

  // Unlocked first, then closest to completion — the next badge is always near the top.
  const ordered = [...rows].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return b.percent - a.percent;
  });

  if (unlockedCount === 0) {
    return `
      <header class="cn-ach__head cn-rise cn-rise-1">
        <h1 class="cn-ach__title">Your badge collection starts here</h1>
        <p class="cn-ach__sub">
          Finish one quest and the first of ${rows.length} badges is yours.
        </p>
        <a class="btn btn-cn-primary mt-3" href="#/games/quiz">Play a round</a>
      </header>

      <div class="cn-badges cn-rise cn-rise-2">${ordered.map(rowHtml).join('')}</div>
    `;
  }

  return `
    <header class="cn-ach__head cn-rise cn-rise-1">
      <h1 class="cn-ach__title">${unlockedCount} of ${rows.length} badges</h1>
      <p class="cn-ach__sub">${earnedXp} XP earned from your collection so far.</p>
      <div class="cn-ach__meter">
        <div class="cn-badge__bar">
          <span style="width:${Math.round((unlockedCount / rows.length) * 100)}%"></span>
        </div>
      </div>
    </header>

    <div class="cn-badges cn-rise cn-rise-2">${ordered.map(rowHtml).join('')}</div>
  `;
}

const achievementsPage: Page = {
  title: 'Achievements',

  render() {
    return `
      <section class="cn-ach">
        <div class="cn-container" id="${ROOT_ID}">${loaderHtml('Loading achievements')}</div>
      </section>
    `;
  },

  async mount() {
    const root = qs(`#${ROOT_ID}`);
    if (!root) return;

    try {
      root.innerHTML = await bodyHtml();
    } catch (error) {
      console.error('[achievements] failed to load', error);
      root.innerHTML = stateHtml({
        icon: 'bi-exclamation-triangle',
        title: "We couldn't load your achievements",
        message: 'Check your connection or try again in a moment.',
        actionLabel: 'Back to dashboard',
        actionHref: '#/dashboard',
      });
    }
  },
};

export default achievementsPage;
