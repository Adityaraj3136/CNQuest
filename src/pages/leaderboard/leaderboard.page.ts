/**
 * Leaderboard — all-time ranking by XP.
 *
 * Reads the `leaderboard` mirror collection, never other students' profiles. Guests are not
 * ranked: their progress never leaves the device, so there is nothing to rank them against.
 */

import type { Page } from '@/types/page';
import { getSession } from '@/state/session';
import { activeStore } from '@/services/progress.store';
import { LEADERBOARD_SIZE, getTopEntries } from '@/services/leaderboard.service';
import { publicEntryOf, rankEntries } from '@/services/leaderboard.logic';
import type { RankedEntry } from '@/services/leaderboard.logic';
import { levelTitle } from '@/config/level.config';
import { escapeHtml, qs } from '@/utils/dom';
import { loaderHtml, stateHtml } from '@/components/loader';
import '@/styles/leaderboard.css';

const ROOT_ID = 'cn-leaderboard-root';

function rowHtml(row: RankedEntry, place = String(row.rank)): string {
  return `
    <li class="cn-rank" data-self="${row.isCurrentUser}">
      <span class="cn-rank__place">${escapeHtml(place)}</span>
      <span class="cn-rank__name">
        ${escapeHtml(row.name)}
        ${row.isCurrentUser ? '<span class="cn-rank__you">you</span>' : ''}
      </span>
      <span class="cn-rank__title">${escapeHtml(levelTitle(row.level))}</span>
      <span class="cn-rank__level">Lv ${row.level}</span>
      <span class="cn-rank__xp">${row.totalXP.toLocaleString()} XP</span>
    </li>
  `;
}

/**
 * The student's own row when they placed outside the fetched page. Counting how many students
 * are ahead of them would be a second aggregate query for a number nobody asked for, so the
 * row is shown without a rank instead.
 */
async function ownRowHtml(ranked: readonly RankedEntry[]): Promise<string> {
  if (ranked.some((row) => row.isCurrentUser)) return '';

  const profile = await activeStore()?.loadProfile();
  if (!profile) return '';

  const me = publicEntryOf(profile);
  return `
    <div class="cn-rank__outside">
      <p class="cn-label">Outside the top ${LEADERBOARD_SIZE}</p>
      <ul class="cn-ranks">${rowHtml({ ...me, rank: 0, isCurrentUser: true }, '—')}</ul>
    </div>
  `;
}

async function bodyHtml(): Promise<string> {
  const { user, isGuest } = getSession();

  if (isGuest || !user) {
    return stateHtml({
      icon: 'bi-bar-chart-steps',
      title: 'Create an account to be ranked',
      message:
        'Guest progress is stored on this device only, so there is nothing to compare. Sign up and your XP joins the ranking from your next round.',
      actionLabel: 'Create account',
      actionHref: '#/register',
    });
  }

  const ranked = rankEntries(await getTopEntries(), user.uid);

  if (ranked.length === 0) {
    return stateHtml({
      icon: 'bi-bar-chart-steps',
      title: 'Nobody has played yet',
      message: 'Finish a round and you will be the first name on the board.',
      actionLabel: 'Play a game',
      actionHref: '#/games',
    });
  }

  return `
    <header class="cn-lead__head cn-rise cn-rise-1">
      <div>
        <span class="cn-label cn-label--marked">Leaderboard</span>
        <h1 class="cn-section__title mt-2">Top ${ranked.length} by XP</h1>
        <p class="cn-label mt-2">All-time ranking &middot; updated after every round</p>
      </div>
    </header>

    <ol class="cn-ranks cn-rise cn-rise-2">${ranked.map((row) => rowHtml(row)).join('')}</ol>
    ${await ownRowHtml(ranked)}
  `;
}

const leaderboardPage: Page = {
  title: 'Leaderboard',

  render() {
    return `
      <section class="cn-lead">
        <div class="cn-container" id="${ROOT_ID}">${loaderHtml('Loading the ranking')}</div>
      </section>
    `;
  },

  async mount() {
    const root = qs(`#${ROOT_ID}`);
    if (!root) return;

    try {
      root.innerHTML = await bodyHtml();
    } catch (error) {
      console.error('[leaderboard] failed to load', error);
      root.innerHTML = stateHtml({
        icon: 'bi-exclamation-triangle',
        title: "We couldn't load the leaderboard",
        message: 'Check your connection or try again in a moment.',
        actionLabel: 'Back to dashboard',
        actionHref: '#/dashboard',
      });
    }
  },
};

export default leaderboardPage;
