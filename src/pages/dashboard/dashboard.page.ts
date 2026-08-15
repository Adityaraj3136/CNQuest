/**
 * Dashboard — the central screen.
 *
 * Everything here is derived by `loadDashboard()`; this file only composes markup.
 * Layout: status header → level field panel → stat ledger → continue/recommendation pair →
 * game modes → weak topics + achievements.
 */

import type { Page } from '@/types/page';
import { getSession, onSessionChange } from '@/state/session';
import { loadDashboard } from '@/services/dashboard.service';
import { levelProgress } from '@/config/level.config';
import { masteryBand } from '@/services/mastery.logic';
import { escapeHtml, qs } from '@/utils/dom';
import { loaderHtml, stateHtml } from '@/components/loader';
import type { DashboardData } from '@/services/dashboard.service';
import '@/styles/dashboard.css';

const ROOT_ID = 'cn-dashboard-root';

/** Game modes shown as launch tiles. Locked ones stay visible and say when they arrive. */
const MODES = [
  { icon: 'bi-lightning-charge', name: 'Quiz Blitz', href: '#/games/quiz', note: '10 questions' },
  { icon: 'bi-stopwatch', name: 'Rapid Fire', href: '#/games/rapid-fire', note: '60 seconds' },
  { icon: 'bi-shield-shaded', name: 'Boss Battle', href: '#/games/boss', note: 'HP duel' },
  { icon: 'bi-puzzle', name: 'Match & Pair', href: '#/games/matching', note: 'Tap to pair' },
  { icon: 'bi-question-diamond', name: 'Riddles', href: '#/games/riddles', note: '5 riddles' },
  { icon: 'bi-grid-3x3', name: 'Word Search', href: '#/games/word-search', note: 'Find words' },
] as const;

function statHtml(label: string, value: string, meta = '', modifier = ''): string {
  return `
    <div class="cn-stat ${modifier}">
      <span class="cn-stat__label">${escapeHtml(label)}</span>
      <span class="cn-stat__value">${escapeHtml(value)}</span>
      ${meta ? `<span class="cn-stat__meta">${escapeHtml(meta)}</span>` : ''}
    </div>
  `;
}

function levelPanelHtml(data: DashboardData): string {
  const progress = levelProgress(data.profile.totalXP);

  return `
    <section class="cn-level cn-on-field cn-rise cn-rise-2" aria-label="Level and XP progress">
      <div class="cn-level__top">
        <div>
          <span class="cn-label">Current level</span>
          <div class="cn-level__number">${String(progress.level).padStart(2, '0')}</div>
          <div class="cn-level__title">${escapeHtml(progress.title)}</div>
        </div>
        <div class="cn-level__xp">${progress.xpIntoLevel} / ${progress.xpForLevel} XP</div>
      </div>

      <div class="cn-progress cn-progress--reward">
        <div class="cn-progress__bar" style="width:${progress.percent}%"></div>
      </div>

      <div class="cn-level__foot">
        <span>Total ${data.profile.totalXP} XP</span>
        <span>${progress.percent}% to level ${progress.level + 1}</span>
      </div>
    </section>
  `;
}

function courseProgressHtml(data: DashboardData): string {
  return `
    <section class="cn-course cn-rise cn-rise-3" aria-label="Overall course progress">
      <div class="cn-course__head">
        <span class="cn-label cn-label--marked">Computer Networks</span>
        <span class="cn-course__value">${data.overallCompletion}<small>%</small></span>
      </div>
      <div class="cn-progress cn-progress--accent">
        <div class="cn-progress__bar" style="width:${data.overallCompletion}%"></div>
      </div>
      <p class="cn-course__meta">
        ${data.topicsStarted} of ${data.topicsTotal} topics started · mastery averaged across the syllabus
      </p>
    </section>
  `;
}

/** Continue-learning and the recommendation, side by side — the two "what next" answers. */
function nextUpHtml(data: DashboardData): string {
  const { recommendation, recommendedTopic, continueTopic } = data;

  const recommendationHref = recommendation.topicId
    ? `#/games/quiz?topic=${encodeURIComponent(recommendation.topicId)}&difficulty=${recommendation.difficulty}`
    : '#/games/quiz';

  const continueCard = continueTopic
    ? `
      <article class="cn-next">
        <span class="cn-label cn-label--marked">Continue learning</span>
        <h2 class="cn-next__title">${escapeHtml(continueTopic.title)}</h2>
        <p class="cn-next__reason">Pick up where you left off.</p>
        <div class="cn-next__actions">
          <a class="btn btn-cn-ghost btn-sm" href="#/learn/${escapeHtml(continueTopic.id)}">Read topic</a>
          <a class="btn btn-cn-primary btn-sm" href="#/games/quiz?topic=${encodeURIComponent(continueTopic.id)}">Practise</a>
        </div>
      </article>`
    : `
      <article class="cn-next">
        <span class="cn-label cn-label--marked">Continue learning</span>
        <h2 class="cn-next__title">Nothing yet</h2>
        <p class="cn-next__reason">Finish a round and your last topic appears here.</p>
        <div class="cn-next__actions">
          <a class="btn btn-cn-ghost btn-sm" href="#/learn">Browse the syllabus</a>
        </div>
      </article>`;

  return `
    <div class="cn-next-grid cn-rise cn-rise-4">
      ${continueCard}
      <article class="cn-next cn-next--accent">
        <span class="cn-label cn-label--marked cn-label--accent">Recommended challenge</span>
        <h2 class="cn-next__title">${escapeHtml(recommendedTopic?.title ?? 'Mixed practice')}</h2>
        <p class="cn-next__reason">${escapeHtml(recommendation.reason)}</p>
        <div class="cn-next__actions">
          <span class="cn-chip cn-chip--${escapeHtml(recommendation.difficulty)}">${escapeHtml(recommendation.difficulty)}</span>
          <a class="btn btn-cn-primary btn-sm" href="${escapeHtml(recommendationHref)}">Start</a>
        </div>
      </article>
    </div>
  `;
}

function modesHtml(): string {
  return `
    <section class="cn-rise cn-rise-5" style="margin-top: var(--cn-space-7)">
      <span class="cn-label cn-label--marked">Game modes</span>
      <div class="cn-modes">
        ${MODES.map(
          (mode) => `
            <a class="cn-mode-tile" href="${mode.href}">
              <i class="bi ${mode.icon}" aria-hidden="true"></i>
              <span class="cn-mode-tile__name">${escapeHtml(mode.name)}</span>
              <span class="cn-mode-tile__note">${escapeHtml(mode.note)}</span>
            </a>`,
        ).join('')}
      </div>
    </section>
  `;
}

function weakTopicsHtml(data: DashboardData): string {
  if (data.weakTopics.length === 0) {
    return `
      <section>
        <span class="cn-label cn-label--marked">Topics to practise</span>
        <p class="cn-ink-soft mt-3" style="font-size: var(--cn-text-sm)">
          Play a few rounds and your weakest topics will be listed here.
        </p>
      </section>
    `;
  }

  return `
    <section>
      <span class="cn-label cn-label--marked">Topics to practise</span>
      <div class="cn-weak">
        ${data.weakTopics
          .map(
            ({ topic, progress }) => `
              <a class="cn-weak__row" href="#/learn/${escapeHtml(progress.topicId)}">
                <span class="cn-weak__name">${escapeHtml(topic?.title ?? progress.topicId)}</span>
                <span class="cn-weak__band">${escapeHtml(masteryBand(progress.mastery))}</span>
                <span class="cn-weak__value">${progress.mastery}%</span>
                <span class="cn-progress cn-progress--accent cn-weak__bar">
                  <span class="cn-progress__bar" style="width:${progress.mastery}%"></span>
                </span>
              </a>`,
          )
          .join('')}
      </div>
    </section>
  `;
}

function achievementsHtml(data: DashboardData): string {
  return `
    <section>
      <div class="cn-panel__head">
        <span class="cn-label cn-label--marked">Achievements</span>
        <a class="cn-label cn-label--accent" href="#/achievements">
          ${data.achievementsUnlocked} / ${data.achievementsTotal} · view all
        </a>
      </div>
      ${
        data.recentAchievements.length === 0
          ? `<p class="cn-ink-soft mt-3" style="font-size: var(--cn-text-sm)">
               No badges yet — finishing your first round unlocks one.
             </p>`
          : `<div class="cn-badge-strip">
               ${data.recentAchievements
                 .map(
                   (achievement) => `
                     <span class="cn-badge-chip" title="${escapeHtml(achievement.description)}">
                       <i class="bi ${escapeHtml(achievement.icon)}" aria-hidden="true"></i>
                       ${escapeHtml(achievement.name)}
                     </span>`,
                 )
                 .join('')}
             </div>`
      }
    </section>
  `;
}

function guestNoticeHtml(): string {
  return `
    <div class="cn-notice cn-notice--reward mt-5">
      <i class="bi bi-person-badge" aria-hidden="true"></i>
      <span>
        Guest mode — XP, levels and progress are stored on this device only.
        <a href="#/register">Create an account</a> to keep them anywhere.
      </span>
    </div>
  `;
}

function bodyHtml(data: DashboardData, isGuest: boolean): string {
  const { profile, week } = data;
  const accuracy =
    profile.questionsAnswered === 0
      ? '—'
      : `${Math.round((profile.correctAnswers / profile.questionsAnswered) * 100)}%`;

  return `
    <header class="cn-dash__head cn-rise cn-rise-1">
      <div>
        <span class="cn-label cn-label--marked">Dashboard</span>
        <h1 class="cn-dash__greeting mt-2">Welcome back, ${escapeHtml(profile.name)}</h1>
      </div>
      <span class="cn-label ${data.streakAtRisk ? 'cn-label--reward' : ''}">
        ${
          data.streakAtRisk
            ? 'Your streak lapsed — play today to start a new one'
            : 'Ready to continue your networking quest?'
        }
      </span>
    </header>

    ${levelPanelHtml(data)}

    <div class="cn-dash__stats cn-rise cn-rise-3">
      ${statHtml(
        'Daily streak',
        `${profile.currentStreak}d`,
        `Longest ${profile.longestStreak}d`,
        'cn-stat--streak',
      )}
      ${statHtml('Games played', String(profile.gamesPlayed), 'All modes combined')}
      ${statHtml('Accuracy', accuracy, `${profile.correctAnswers} of ${profile.questionsAnswered} correct`)}
      ${statHtml('This week', `${week.xpEarned} XP`, `${week.games} games · ${week.questions} questions`)}
    </div>

    ${courseProgressHtml(data)}
    ${nextUpHtml(data)}
    ${modesHtml()}

    <div class="cn-dash__panels cn-rise cn-rise-5">
      ${weakTopicsHtml(data)}
      ${achievementsHtml(data)}
    </div>

    ${isGuest ? guestNoticeHtml() : ''}
  `;
}

async function paint(): Promise<void> {
  const root = qs(`#${ROOT_ID}`);
  if (!root) return;

  const { isGuest, ready } = getSession();
  if (!ready) {
    root.innerHTML = loaderHtml('Loading your progress');
    return;
  }

  try {
    const data = await loadDashboard();
    if (!data) {
      root.innerHTML = stateHtml({
        icon: 'bi-person-circle',
        title: 'Sign in to see your dashboard',
        message: 'Your level, XP and progress are tied to your account or guest session.',
        actionLabel: 'Login',
        actionHref: '#/login',
      });
      return;
    }
    root.innerHTML = bodyHtml(data, isGuest);
  } catch (error) {
    console.error('[dashboard] failed to load', error);
    root.innerHTML = stateHtml({
      icon: 'bi-exclamation-triangle',
      title: "We couldn't load your dashboard",
      message: 'Check your connection and try again. Your progress is safe.',
      actionLabel: 'Browse topics',
      actionHref: '#/learn',
    });
  }
}

let unsubscribe: (() => void) | null = null;

const dashboardPage: Page = {
  title: 'Dashboard',

  render() {
    return `
      <section class="cn-dash">
        <div class="cn-container" id="${ROOT_ID}">${loaderHtml('Loading your progress')}</div>
      </section>
    `;
  },

  async mount() {
    await paint();
    // The profile document often resolves just after first paint — repaint when it lands.
    unsubscribe = onSessionChange(() => void paint());
  },

  unmount() {
    unsubscribe?.();
    unsubscribe = null;
  },
};

export default dashboardPage;
