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
  { icon: 'bi-lightning-charge', name: 'Quiz Blitz', href: '#/games/quiz', note: '10 questions', tone: 'quiz' },
  { icon: 'bi-stopwatch', name: 'Rapid Fire', href: '#/games/rapid-fire', note: '60 seconds', tone: 'rapid' },
  { icon: 'bi-shield-shaded', name: 'Boss Battle', href: '#/games/boss', note: 'HP duel', tone: 'boss' },
  { icon: 'bi-puzzle', name: 'Match & Pair', href: '#/games/matching', note: 'Tap to pair', tone: 'match' },
  { icon: 'bi-question-diamond', name: 'Riddles', href: '#/games/riddles', note: '5 riddles', tone: 'riddle' },
  { icon: 'bi-grid-3x3', name: 'Word Search', href: '#/games/word-search', note: 'Find words', tone: 'words' },
] as const;

/**
 * The one thing a returning student should see first.
 *
 * The dashboard previously opened with four large statistics, which answered "how am I doing"
 * before anyone had asked, and never answered "what do I do now". This does the reverse: one
 * obvious action, with status compressed into a single row beneath it.
 */
function continueQuestHtml(data: DashboardData): string {
  const { continueTopic, recommendedTopic, recommendation } = data;
  const topic = continueTopic ?? recommendedTopic;

  if (!topic) {
    return `
      <section class="cn-quest-hero cn-quest-hero--empty cn-rise cn-rise-1">
        <p class="cn-quest-hero__eyebrow">Your next mission</p>
        <h1 class="cn-quest-hero__title">Enter the Network</h1>
        <p class="cn-quest-hero__meta">
          Start with Introduction to Computer Networks and begin building your map of the subject.
        </p>
        <a class="btn btn-cn-primary" href="#/learn">Start first quest</a>
      </section>
    `;
  }

  const mastery = data.weakTopics.find((entry) => entry.progress.topicId === topic.id);
  const percent = mastery ? Math.round(mastery.progress.mastery) : 0;
  const resuming = continueTopic !== null;

  return `
    <section class="cn-quest-hero cn-rise cn-rise-1" aria-labelledby="cn-quest-hero-title">
      <div class="cn-quest-hero__body">
        <p class="cn-quest-hero__eyebrow">Your next mission · ${resuming ? 'In progress' : 'Recommended'}</p>
        <h1 class="cn-quest-hero__title" id="cn-quest-hero-title">${escapeHtml(topic.title)}</h1>
        <p class="cn-quest-hero__meta">
          ${escapeHtml(topic.estimatedMinutes ? `${topic.estimatedMinutes} min read` : 'Short read')}
          · ${percent}% mastered
          ${resuming ? '' : `· ${escapeHtml(recommendation.reason)}`}
        </p>

        <div class="cn-quest-hero__bar" role="img" aria-label="${percent}% mastered">
          <span style="width:${percent}%"></span>
        </div>

        <div class="cn-quest-hero__actions">
          <a class="btn btn-cn-primary" href="#/learn/${escapeHtml(topic.id)}">Continue quest</a>
          <a class="btn btn-cn-ghost" href="#/games/quiz?topic=${encodeURIComponent(topic.id)}">Practise now</a>
        </div>
      </div>

      ${dailyQuestHtml(data)}
    </section>
  `;
}

/** Today's goal. Small, and deliberately the only thing competing with the hero action. */
function dailyQuestHtml(data: DashboardData): string {
  const { daily } = data;

  return `
    <aside class="cn-daily${daily.complete ? ' cn-daily--done' : ''}" aria-label="Daily quest">
      <p class="cn-daily__label">Daily quest</p>
      <p class="cn-daily__goal">Answer ${daily.target} questions correctly</p>

      <div class="cn-daily__meter">
        <div class="cn-daily__bar"><span style="width:${daily.percent}%"></span></div>
        <span class="cn-daily__count">${daily.progress} / ${daily.target}</span>
      </div>

      <p class="cn-daily__reward">
        ${daily.complete ? 'Complete' : `Reward +${daily.rewardXp} XP`}
      </p>
    </aside>
  `;
}

/** Level, streak, XP and mastery on one line, rather than four competing panels. */
function statusRowHtml(data: DashboardData): string {
  const progress = levelProgress(data.profile.totalXP);

  const cells = [
    { icon: 'bi-shield', value: `Level ${progress.level}`, meta: progress.title, tone: 'accent' },
    {
      icon: 'bi-fire',
      value: `${data.profile.currentStreak} day${data.profile.currentStreak === 1 ? '' : 's'}`,
      meta: data.streakAtRisk ? 'At risk today' : 'Streak',
      tone: 'xp',
    },
    { icon: 'bi-star', value: `${data.profile.totalXP.toLocaleString()} XP`, meta: 'Earned', tone: 'xp' },
    { icon: 'bi-graph-up', value: `${data.overallCompletion}%`, meta: 'Mastery', tone: 'mastered' },
  ];

  return `
    <div class="cn-status cn-rise cn-rise-2">
      ${cells
        .map(
          (cell) => `
            <div class="cn-status__cell" data-tone="${cell.tone}">
              <i class="bi ${cell.icon}" aria-hidden="true"></i>
              <span class="cn-status__value">${escapeHtml(cell.value)}</span>
              <span class="cn-status__meta">${escapeHtml(cell.meta)}</span>
            </div>`,
        )
        .join('')}
    </div>
  `;
}

function journeyHtml(data: DashboardData): string {
  return `
    <section class="cn-journey cn-rise cn-rise-3" aria-labelledby="cn-journey-title">
      <div class="cn-panel__head">
        <div>
          <h2 class="cn-journey__title" id="cn-journey-title">Network world map</h2>
          <p class="cn-journey__lead">${data.topicsStarted} of ${data.topicsTotal} topics started. Master every world to secure the network.</p>
        </div>
        <a class="btn btn-cn-ghost btn-sm" href="#/learn">Open quest map</a>
      </div>
      <ol class="cn-journey__route">
        ${data.journey
          .map(
            ({ unit, mastery, completed, total, state }) => `
              <li class="cn-journey__node" data-state="${state}">
                <a href="#/learn" aria-label="${escapeHtml(unit.title)}, ${mastery}% mastery">
                  <span class="cn-journey__icon" aria-hidden="true">
                    <i class="bi ${state === 'mastered' ? 'bi-check-lg' : escapeHtml(unit.icon)}"></i>
                  </span>
                  <span class="cn-journey__world">World ${unit.number}</span>
                  <strong>${escapeHtml(unit.title)}</strong>
                  <span>${completed}/${total} quests · ${mastery}% mastery</span>
                </a>
              </li>`,
          )
          .join('')}
      </ol>
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
            <a class="cn-mode-tile" href="${mode.href}" data-tone="${mode.tone}">
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
        <div class="cn-empty">
          <i class="bi bi-crosshair" aria-hidden="true"></i>
          <p>Play a few rounds and your weakest topics will be listed here.</p>
        </div>
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
          ? `<div class="cn-empty">
               <i class="bi bi-trophy" aria-hidden="true"></i>
               <p>No badges yet. Finishing your first round unlocks one.</p>
             </div>`
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
        Guest mode: XP, levels and progress are stored on this device only.
        <a href="#/register">Create an account</a> to keep them anywhere.
      </span>
    </div>
  `;
}

function bodyHtml(data: DashboardData, isGuest: boolean): string {
  return `
    ${continueQuestHtml(data)}
    ${statusRowHtml(data)}

    ${journeyHtml(data)}
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
