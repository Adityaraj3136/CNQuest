/**
 * Progress — the analytics screen.
 *
 * Four levels of progress, as the spec requires: overall course, per unit, per topic and
 * per game mode, plus a 14-day XP and accuracy trend and a recent-activity log.
 */

import type { Page } from '@/types/page';
import { loadProgressReport } from '@/services/progress-report.service';
import { masteryBand } from '@/services/mastery.logic';
import { levelProgress } from '@/config/level.config';
import { axisLabelsHtml, barChartSvg, lineChartSvg } from '@/components/chart';
import { loaderHtml, stateHtml } from '@/components/loader';
import { escapeHtml, qs } from '@/utils/dom';
import type { ProgressReport, UnitRow } from '@/services/progress-report.service';
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

function statHtml(label: string, value: string, meta = ''): string {
  return `
    <div class="cn-stat">
      <span class="cn-stat__label">${escapeHtml(label)}</span>
      <span class="cn-stat__value">${escapeHtml(value)}</span>
      ${meta ? `<span class="cn-stat__meta">${escapeHtml(meta)}</span>` : ''}
    </div>
  `;
}

function headlineHtml(report: ProgressReport): string {
  const level = levelProgress(report.profile.totalXP);

  return `
    <div class="cn-dash__stats cn-rise cn-rise-2">
      ${statHtml('Total XP', String(report.profile.totalXP), `Level ${level.level} · ${level.title}`)}
      ${statHtml('Course complete', `${report.overallCompletion}%`, 'Mastery across all topics')}
      ${statHtml('Accuracy', `${report.overallAccuracy}%`, `${report.correctAnswers} of ${report.questionsAnswered} correct`)}
      ${statHtml('Streak', `${report.profile.currentStreak}d`, `Longest ${report.profile.longestStreak}d`)}
    </div>

    <div class="cn-dash__stats cn-rise cn-rise-3">
      ${statHtml('Games played', String(report.profile.gamesPlayed), `${report.minutesPlayed} minutes total`)}
      ${statHtml('Boss victories', String(report.bossWins), 'Across all bosses')}
      ${statHtml('Achievements', `${report.achievementsUnlocked}/${report.achievementsTotal}`, 'Badges unlocked')}
      ${statHtml('Questions', String(report.questionsAnswered), 'Lifetime attempts')}
    </div>
  `;
}

function trendsHtml(report: ProgressReport): string {
  const hasActivity = report.series.some((point) => point.questions > 0);

  if (!hasActivity) {
    return `
      <section class="cn-prog__section">
        <span class="cn-label cn-label--marked">Last 14 days</span>
        <p class="cn-ink-soft mt-3">No activity in the last fortnight — play a round to start the trend.</p>
      </section>
    `;
  }

  const labels = report.series.map((point) => point.label);

  return `
    <section class="cn-prog__section">
      <span class="cn-label cn-label--marked">Last 14 days</span>
      <div class="cn-prog__charts">
        <figure class="cn-prog__chart">
          <figcaption class="cn-label">XP earned per day</figcaption>
          ${barChartSvg(
            report.series.map((point) => ({ label: point.date, value: point.xp })),
            `Daily XP over the last 14 days, ending ${report.series.at(-1)?.date}`,
          )}
          ${axisLabelsHtml(labels)}
        </figure>

        <figure class="cn-prog__chart">
          <figcaption class="cn-label">Accuracy per day</figcaption>
          ${lineChartSvg(
            report.series.map((point) => ({ label: point.date, value: point.accuracy })),
            'Daily accuracy percentage over the last 14 days',
          )}
          ${axisLabelsHtml(labels)}
        </figure>
      </div>
    </section>
  `;
}

function unitHtml(row: UnitRow): string {
  const started = row.topics.filter((entry) => entry.progress && entry.progress.attempted > 0);

  return `
    <details class="cn-prog__unit" ${row.mastery > 0 ? 'open' : ''}>
      <summary class="cn-prog__unit-head">
        <span class="cn-prog__unit-num">${String(row.unit.number).padStart(2, '0')}</span>
        <span class="cn-prog__unit-title">${escapeHtml(row.unit.title)}</span>
        <span class="cn-prog__unit-meta">${row.topicsStarted}/${row.topicsTotal} topics</span>
        <span class="cn-prog__unit-value">${row.mastery}%</span>
        <span class="cn-progress cn-progress--accent cn-prog__unit-bar">
          <span class="cn-progress__bar" style="width:${row.mastery}%"></span>
        </span>
      </summary>

      ${
        started.length === 0
          ? '<p class="cn-prog__none">No topics attempted in this unit yet.</p>'
          : `<table class="cn-prog__table">
               <thead>
                 <tr>
                   <th scope="col">Topic</th>
                   <th scope="col">Attempted</th>
                   <th scope="col">Correct</th>
                   <th scope="col">Accuracy</th>
                   <th scope="col">Mastery</th>
                   <th scope="col">Band</th>
                 </tr>
               </thead>
               <tbody>
                 ${started
                   .map(
                     ({ topic, progress }) => `
                       <tr>
                         <th scope="row"><a href="#/learn/${escapeHtml(topic.id)}">${escapeHtml(topic.title)}</a></th>
                         <td>${progress!.attempted}</td>
                         <td>${progress!.correct}</td>
                         <td>${progress!.accuracy}%</td>
                         <td>${progress!.mastery}%</td>
                         <td><span class="cn-chip">${escapeHtml(masteryBand(progress!.mastery))}</span></td>
                       </tr>`,
                   )
                   .join('')}
               </tbody>
             </table>`
      }
    </details>
  `;
}

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

function rankingHtml(
  title: string,
  rows: ProgressReport['weakest'],
  emptyMessage: string,
): string {
  if (rows.length === 0) {
    return `
      <section>
        <span class="cn-label cn-label--marked">${escapeHtml(title)}</span>
        <p class="cn-ink-soft mt-3" style="font-size: var(--cn-text-sm)">${escapeHtml(emptyMessage)}</p>
      </section>
    `;
  }

  return `
    <section>
      <span class="cn-label cn-label--marked">${escapeHtml(title)}</span>
      <div class="cn-weak">
        ${rows
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

function recentHtml(report: ProgressReport): string {
  if (report.recentAttempts.length === 0) return '';

  return `
    <section class="cn-prog__section">
      <span class="cn-label cn-label--marked">Recent activity</span>
      <div class="cn-prog__log">
        ${report.recentAttempts
          .map(
            (attempt) => `
              <div class="cn-prog__log-row">
                <span class="cn-prog__log-date">${escapeHtml(attempt.createdAt.slice(0, 10))}</span>
                <span class="cn-prog__log-mode">${escapeHtml(MODE_LABELS[attempt.gameType] ?? attempt.gameType)}</span>
                <span class="cn-prog__log-score">${attempt.correct}/${attempt.attempted}</span>
                <span class="cn-prog__log-acc">${attempt.accuracy}%</span>
                <span class="cn-prog__log-xp">+${attempt.xpEarned} XP</span>
              </div>`,
          )
          .join('')}
      </div>
    </section>
  `;
}

function bodyHtml(report: ProgressReport): string {
  return `
    <header class="cn-dash__head cn-rise cn-rise-1">
      <div>
        <span class="cn-label cn-label--marked">Analytics</span>
        <h1 class="cn-dash__greeting mt-2">Your progress</h1>
      </div>
      <span class="cn-label">Computer Networks · ${report.units.length} units</span>
    </header>

    ${headlineHtml(report)}
    ${trendsHtml(report)}

    <section class="cn-prog__section">
      <span class="cn-label cn-label--marked">Mastery by unit and topic</span>
      <div class="cn-prog__units">${report.units.map(unitHtml).join('')}</div>
    </section>

    ${modesHtml(report)}

    <div class="cn-dash__panels">
      ${rankingHtml('Topics to practise', report.weakest, 'Play a few rounds to see your weakest topics.')}
      ${rankingHtml('Strongest topics', report.strongest, 'Your best topics will be listed here.')}
    </div>

    ${recentHtml(report)}
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
