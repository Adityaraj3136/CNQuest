/**
 * Progress — player progression.
 *
 * Not an analytics report. The order answers, in sequence: what level am I, what have I
 * mastered, what should I do next, how far along the syllabus am I, and what have I been
 * doing lately. Numbers appear in service of those questions, not instead of them.
 */

import type { Page } from '@/types/page';
import { loadProgressReport } from '@/services/progress-report.service';
import { masteryBand } from '@/services/mastery.logic';
import { levelProgress, levelTitle } from '@/config/level.config';
import { isStreakExpired } from '@/services/streak.logic';
import { networkStage, nextGoal, unitStates } from '@/services/progression.logic';
import { loaderHtml, stateHtml } from '@/components/loader';
import { escapeHtml, qs } from '@/utils/dom';
import type { ProgressReport } from '@/services/progress-report.service';
import type { GameType } from '@/models/content';
import '@/styles/progress.css';

const ROOT_ID = 'cn-progress-root';

const MODE_LABELS: Record<GameType, string> = {
  quiz: 'Quiz Blitz',
  'rapid-fire': 'Rapid Fire',
  boss: 'Boss Battle',
  matching: 'Match & Pair',
  riddle: 'Network Riddles',
  'word-search': 'Word Search',
};

function modesHtml(report: ProgressReport): string {
  if (report.modes.length === 0) {
    return `
      <section class="cn-prog__section">
        <span class="cn-label cn-label--marked">Game performance</span>
        <p class="cn-ink-soft mt-3">Play a round and each mode's record appears here.</p>
      </section>
    `;
  }

  return `
    <section class="cn-prog__section">
      <span class="cn-label cn-label--marked">Game performance</span>
      <table class="cn-prog__table cn-prog__table--modes">
        <thead>
          <tr>
            <th scope="col">Mode</th>
            <th scope="col">Sessions</th>
            <th scope="col">Questions</th>
            <th scope="col">Accuracy</th>
            <th scope="col">Best</th>
            <th scope="col">XP</th>
          </tr>
        </thead>
        <tbody>
          ${report.modes
            .map(
              (mode) => `
                <tr>
                  <th scope="row">${escapeHtml(MODE_LABELS[mode.gameType] ?? mode.gameType)}</th>
                  <td>${mode.sessions}</td>
                  <td>${mode.questions}</td>
                  <td>${mode.accuracy}%</td>
                  <td>${mode.bestAccuracy}%</td>
                  <td>${mode.xpEarned}</td>
                </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

// ---------------------------------------------------------------- progression

/** Level, title, and what the next level is actually called. Compact by design. */
function levelCardHtml(report: ProgressReport): string {
  const level = levelProgress(report.profile.totalXP);
  const xpToNext = Math.max(0, level.xpForLevel - level.xpIntoLevel);
  const nextTitle = levelTitle(level.level + 1);

  return `
    <section class="cn-lvl cn-rise cn-rise-2" aria-label="Level progress">
      <div class="cn-lvl__main">
        <p class="cn-lvl__num">Level ${level.level}</p>
        <h2 class="cn-lvl__title">${escapeHtml(level.title)}</h2>

        <div class="cn-lvl__bar"><span style="width:${level.percent}%"></span></div>

        <p class="cn-lvl__xp">
          <b>${level.xpIntoLevel.toLocaleString()}</b> / ${level.xpForLevel.toLocaleString()} XP
        </p>
      </div>

      <aside class="cn-lvl__next">
        <p class="cn-lvl__nextlabel">Next unlock</p>
        <p class="cn-lvl__nexttitle">${escapeHtml(nextTitle)}</p>
        <p class="cn-lvl__nextmeta">
          ${xpToNext === 0 ? 'Ready now' : `${xpToNext.toLocaleString()} XP remaining`}
        </p>
      </aside>
    </section>
  `;
}

/** Four numbers, scannable. Each carries its own copy while it is still zero. */
function metricsHtml(report: ProgressReport): string {
  const allTopics = report.units.flatMap((row) => row.topics);
  const mastered = allTopics.filter((row) => (row.progress?.mastery ?? 0) >= 80).length;
  const { profile } = report;

  const cells = [
    {
      label: 'Mastery',
      value: `${report.overallCompletion}%`,
      meta: report.overallCompletion === 0 ? 'Finish a topic to start' : 'Across the syllabus',
      tone: 'accent',
    },
    {
      label: 'Topics mastered',
      value: `${mastered}/${allTopics.length}`,
      meta: mastered === 0 ? 'Your first is waiting' : 'At 80% or above',
      tone: 'mastered',
    },
    {
      label: 'Streak',
      value: profile.currentStreak === 0 ? '—' : `${profile.currentStreak}d`,
      meta: profile.currentStreak === 0 ? 'Play today to start one' : `Best ${profile.longestStreak}d`,
      tone: 'xp',
    },
    {
      label: 'Questions',
      value: report.questionsAnswered.toLocaleString(),
      meta: report.questionsAnswered === 0 ? 'None yet' : `${report.overallAccuracy}% correct`,
      tone: 'neutral',
    },
  ];

  return `
    <div class="cn-metrics cn-rise cn-rise-3">
      ${cells
        .map(
          (cell) => `
            <div class="cn-metric" data-tone="${cell.tone}">
              <p class="cn-metric__label">${escapeHtml(cell.label)}</p>
              <p class="cn-metric__value">${escapeHtml(cell.value)}</p>
              <p class="cn-metric__meta">${escapeHtml(cell.meta)}</p>
            </div>`,
        )
        .join('')}
    </div>
  `;
}

/** The most useful thing on the page: what to do next, derived from real state only. */
function goalHtml(report: ProgressReport): string {
  const level = levelProgress(report.profile.totalXP);

  const goal = nextGoal({
    questionsAnswered: report.questionsAnswered,
    xpToNextLevel: Math.max(0, level.xpForLevel - level.xpIntoLevel),
    nextLevelTitle: levelTitle(level.level + 1),
    currentStreak: report.profile.currentStreak,
    streakAtRisk: isStreakExpired({
      currentStreak: report.profile.currentStreak,
      longestStreak: report.profile.longestStreak,
      ...(report.profile.lastActiveDate ? { lastActiveDate: report.profile.lastActiveDate } : {}),
    }),
    topics: report.units
      .flatMap((row) => row.topics)
      .map((row) => ({
        id: row.topic.id,
        title: row.topic.title,
        mastery: row.progress?.mastery ?? 0,
      })),
  });

  return `
    <section class="cn-goal cn-rise cn-rise-4" data-kind="${goal.kind}">
      <p class="cn-goal__label">Next goal</p>
      <h2 class="cn-goal__title">${escapeHtml(goal.title)}</h2>
      <p class="cn-goal__detail">${escapeHtml(goal.detail)}</p>
      <a class="btn btn-cn-primary" href="${escapeHtml(goal.actionHref)}">${escapeHtml(goal.actionLabel)}</a>
    </section>
  `;
}

/**
 * The syllabus as a route rather than a table.
 *
 * Six units on a connected path, each a node with its own state. The host to server metaphor
 * sits above it and lights up in four stages, so overall progress has a shape and not only a
 * percentage. Topics stay folded away until a unit is opened.
 */
function journeyHtml(report: ProgressReport): string {
  const masteries = report.units.map((row) => row.mastery);
  const states = unitStates(masteries);
  const stage = networkStage(report.overallCompletion);
  const hops = ['Host', 'Switch', 'Router', 'Server'];

  return `
    <section class="cn-journey cn-rise cn-rise-5">
      <header class="cn-journey__head">
        <h2 class="cn-journey__title">Your network</h2>
        <p class="cn-journey__sub">
          ${
            stage === 0
              ? 'Complete your first quest and your network starts building.'
              : `${report.overallCompletion}% of the syllabus mastered.`
          }
        </p>
      </header>

      <ol class="cn-hops" aria-label="Overall progress">
        ${hops
          .map(
            (hop, index) => `
              <li class="cn-hop" data-on="${index < stage}">
                <span class="cn-hop__dot" aria-hidden="true"></span>
                <span class="cn-hop__label">${escapeHtml(hop)}</span>
              </li>`,
          )
          .join('')}
      </ol>

      <ol class="cn-path">
        ${report.units
          .map((row, index) => {
            const state = states[index];
            const done = row.topics.filter((topic) => (topic.progress?.mastery ?? 0) >= 80).length;

            return `
              <li class="cn-path__unit" data-state="${state}">
                <span class="cn-path__node" aria-hidden="true"></span>

                <details ${state === 'current' ? 'open' : ''}>
                  <summary>
                    <span class="cn-path__num">${String(row.unit.number).padStart(2, '0')}</span>
                    <span class="cn-path__name">${escapeHtml(row.unit.title)}</span>
                    <span class="cn-path__band">${escapeHtml(masteryBand(row.mastery))}</span>
                    <span class="cn-path__pct">${row.mastery}%</span>
                  </summary>

                  <div class="cn-path__body">
                    <div class="cn-path__bar"><span style="width:${row.mastery}%"></span></div>
                    <p class="cn-path__meta">${done} of ${row.topics.length} topics mastered</p>

                    <ul class="cn-path__topics">
                      ${row.topics
                        .map((topic) => {
                          const mastery = Math.round(topic.progress?.mastery ?? 0);
                          const icon =
                            mastery >= 80
                              ? 'bi-check-circle-fill'
                              : mastery > 0
                                ? 'bi-play-circle'
                                : 'bi-circle';
                          return `
                            <li>
                              <i class="bi ${icon}" aria-hidden="true"></i>
                              <a href="#/learn/${escapeHtml(topic.topic.id)}">${escapeHtml(topic.topic.title)}</a>
                              <span>${mastery === 0 ? 'Not started' : `${mastery}%`}</span>
                            </li>`;
                        })
                        .join('')}
                    </ul>
                  </div>
                </details>
              </li>`;
          })
          .join('')}
      </ol>
    </section>
  `;
}

/** Fourteen days as dots, or an honest empty state. Never a chart of almost nothing. */
function activityHtml(report: ProgressReport): string {
  const active = report.series.filter((day) => day.questions > 0).length;

  if (active < 2) {
    return `
      <section class="cn-activity cn-rise cn-rise-6">
        <h2 class="cn-activity__title">Your activity will appear here</h2>
        <p class="cn-activity__sub">Play a few rounds and your learning pattern shows up.</p>
        <a class="btn btn-cn-ghost btn-sm" href="#/games">Play a game</a>
      </section>
    `;
  }

  const week = report.series.slice(-7);
  const weekXp = week.reduce((sum, day) => sum + day.xp, 0);
  const weekQuestions = week.reduce((sum, day) => sum + day.questions, 0);

  return `
    <section class="cn-activity cn-rise cn-rise-6">
      <h2 class="cn-activity__title">Recent activity</h2>

      <ol class="cn-strip" aria-label="Last 14 days">
        ${report.series
          .map(
            (day) => `
              <li class="cn-strip__day" data-on="${day.questions > 0}"
                  title="${escapeHtml(day.date)} · ${day.questions} questions">
                <span></span>
              </li>`,
          )
          .join('')}
      </ol>

      <p class="cn-activity__summary">
        This week: <b>+${weekXp} XP</b> · ${weekQuestions} questions
      </p>
    </section>
  `;
}

function bodyHtml(report: ProgressReport): string {
  return `
    <header class="cn-prog__head cn-rise cn-rise-1">
      <h1 class="cn-prog__title">Your journey</h1>
      <p class="cn-prog__sub">What you have mastered, and what comes next.</p>
    </header>

    ${levelCardHtml(report)}
    ${metricsHtml(report)}
    ${goalHtml(report)}
    ${journeyHtml(report)}

    <div class="cn-prog__pair">
      ${activityHtml(report)}
      ${modesHtml(report)}
    </div>
  `;
}

const progressPage: Page = {
  title: 'Progress',

  render() {
    return `
      <section class="cn-prog">
        <div class="cn-container" id="${ROOT_ID}">${loaderHtml('Crunching your numbers')}</div>
      </section>
    `;
  },

  async mount() {
    const root = qs(`#${ROOT_ID}`);
    if (!root) return;

    try {
      const report = await loadProgressReport();
      if (!report) {
        root.innerHTML = stateHtml({
          icon: 'bi-graph-up',
          title: 'Sign in to see your progress',
          message: 'Analytics are tied to your account or guest session.',
          actionLabel: 'Login',
          actionHref: '#/login',
        });
        return;
      }
      root.innerHTML = bodyHtml(report);
    } catch (error) {
      console.error('[progress] failed to load', error);
      root.innerHTML = stateHtml({
        icon: 'bi-exclamation-triangle',
        title: "We couldn't load your analytics",
        message: 'Check your connection and try again. Your progress is safe.',
        actionLabel: 'Back to dashboard',
        actionHref: '#/dashboard',
      });
    }
  },
};

export default progressPage;
