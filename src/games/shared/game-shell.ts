/**
 * Shared results screen for every game mode.
 *
 * Each game produces a GameSummary and a few labels; this module runs the result through
 * the pipeline and renders the same hero, stat ledger, XP breakdown and rewards for all six
 * modes. Without it, each game would reimplement (and eventually contradict) the others.
 */

import { processGameResult } from '@/services/game-result.service';
import { showToast } from '@/components/toast';
import { playCue } from '@/services/sound';
import { observeOutcome } from '@/services/adaptive';
import { loaderHtml } from '@/components/loader';
import type { Difficulty } from '@/models/content';
import { BASE_XP } from '@/config/xp.config';
import { escapeHtml } from '@/utils/dom';
import type { GameSummary } from '@/models/game';
import type { ProcessedResult, ResultExtras } from '@/services/game-result.service';

export interface StatCell {
  label: string;
  value: string;
}

export interface XpRow {
  label: string;
  xp: number;
}

export interface ResultScreenOptions {
  /** Small caption above the score, e.g. "Rapid Fire · Mixed topics". */
  caption: string;
  /** The headline figure, e.g. "23". */
  score: string;
  /** Optional smaller suffix, e.g. "/28". */
  scoreSuffix?: string;
  /** Shown instead of a score when a round has a verdict, e.g. "Victory". */
  verdict?: string;
  stats: StatCell[];
  xpRows: XpRow[];
  /** Extra markup appended after the actions (a review panel, for example). */
  extraHtml?: string;
}

export function statCellHtml({ label, value }: StatCell): string {
  return `
    <div class="cn-stat">
      <span class="cn-stat__label">${escapeHtml(label)}</span>
      <span class="cn-stat__value">${escapeHtml(value)}</span>
    </div>
  `;
}

/** Level-up, achievements, streak and mastery movement. */
export function rewardsHtml(processed: ProcessedResult): string {
  if (!processed.saved) {
    return `
      <div class="cn-notice mt-4">
        <i class="bi bi-cloud-slash" aria-hidden="true"></i>
        <span>
          Your score is shown above but could not be saved. Check your connection — replay the round
          once you are back online to keep the XP.
        </span>
      </div>
    `;
  }

  const blocks: string[] = [];

  if (processed.leveledUp) {
    blocks.push(`
      <div class="cn-levelup cn-rise cn-rise-2" role="status">
        <span class="cn-label">Level up</span>
        <div class="cn-levelup__number">${String(processed.levelAfter).padStart(2, '0')}</div>
        <div class="cn-levelup__title">${escapeHtml(processed.newLevelTitle)}</div>
        <p class="cn-levelup__meta">${processed.xpToNextLevel} XP to level ${processed.levelAfter + 1}</p>
      </div>
    `);
  }

  if (processed.unlockedAchievements.length > 0) {
    blocks.push(`
      <section class="cn-rise cn-rise-3" style="margin-top: var(--cn-space-6)">
        <span class="cn-label cn-label--marked">
          Achievement${processed.unlockedAchievements.length > 1 ? 's' : ''} unlocked
        </span>
        <div class="cn-unlocks">
          ${processed.unlockedAchievements
            .map(
              (achievement) => `
                <article class="cn-unlock">
                  <i class="bi ${escapeHtml(achievement.icon)}" aria-hidden="true"></i>
                  <div>
                    <h3>${escapeHtml(achievement.name)}</h3>
                    <p>${escapeHtml(achievement.description)}</p>
                  </div>
                  <span class="cn-unlock__xp">+${achievement.rewardXP} XP</span>
                </article>`,
            )
            .join('')}
        </div>
      </section>
    `);
  }

  const movement: string[] = [];
  if (processed.firstActivityToday) {
    movement.push(`Day ${processed.currentStreak} of your streak — first activity today.`);
  }
  if (processed.topicProgress && processed.masteryAfter !== processed.masteryBefore) {
    movement.push(`Topic mastery ${processed.masteryBefore}% → ${processed.masteryAfter}%.`);
  }

  if (movement.length > 0) {
    blocks.push(`
      <div class="cn-notice mt-4">
        <i class="bi bi-graph-up-arrow" aria-hidden="true"></i>
        <span>${movement.map((line) => escapeHtml(line)).join(' ')}</span>
      </div>
    `);
  }

  return blocks.join('');
}

/**
 * The full results screen. `playAgainId` and `homeHref` wire the action row; the caller
 * attaches the click handler for Play again.
 */
export function resultScreenHtml(
  processed: ProcessedResult,
  options: ResultScreenOptions,
  playAgainId: string,
): string {
  const rows = [...options.xpRows];

  if (processed.firstActivityToday) {
    rows.push({ label: 'First activity today', xp: BASE_XP.firstDailyActivity });
  }
  for (const achievement of processed.unlockedAchievements) {
    rows.push({ label: `Achievement · ${achievement.name}`, xp: achievement.rewardXP });
  }

  // A milestone is worth marking; an ordinary round is not. Confetti after every game is
  // noise, and noise makes the real moments worth nothing.
  const levelledUp = processed.levelAfter > processed.levelBefore;
  const milestone = levelledUp || Boolean(options.verdict) || processed.unlockedAchievements.length > 0;

  return `
    <div class="cn-result">
      <div class="cn-result__hero cn-rise cn-rise-1" data-milestone="${milestone}">
        <p class="cn-result__eyebrow">${escapeHtml(options.caption)}</p>

        <div class="cn-result__score">
          ${escapeHtml(options.verdict ?? options.score)}
          ${options.verdict ? '' : `<small>${escapeHtml(options.scoreSuffix ?? '')}</small>`}
        </div>

        <p class="cn-result__xp">+${processed.xpAwarded} XP</p>

        ${
          levelledUp
            ? `<p class="cn-result__milestone">Level ${processed.levelAfter} reached</p>`
            : ''
        }

        ${
          processed.saved
            ? `<p class="cn-result__meta">
                 ${processed.totalXP.toLocaleString()} XP total · Level ${processed.levelAfter} ·
                 ${processed.currentStreak} day streak
               </p>`
            : ''
        }
      </div>

      ${rewardsHtml(processed)}

      <div class="cn-result__grid cn-rise cn-rise-2">
        ${options.stats.map(statCellHtml).join('')}
      </div>

      <section class="cn-rise cn-rise-3" style="margin-top: var(--cn-space-6)">
        <p class="cn-result__section">How your XP was earned</p>
        <div class="cn-xp-rows">
          ${rows
            .filter((row) => row.xp > 0)
            .map(
              (row) =>
                `<div class="cn-xp-row"><span>${escapeHtml(row.label)}</span><span>+${row.xp} XP</span></div>`,
            )
            .join('')}
          <div class="cn-xp-row cn-xp-row--total"><span>Total</span><span>+${processed.xpAwarded} XP</span></div>
        </div>
      </section>

      <div class="cn-result__actions cn-rise cn-rise-4">
        <button type="button" class="btn btn-cn-primary" id="${escapeHtml(playAgainId)}">Play again</button>
        <a class="btn btn-cn-ghost" href="#/games">Next challenge</a>
        <a class="cn-result__back" href="#/dashboard">Back to home</a>
      </div>

      ${options.extraHtml ?? ''}
    </div>
  `;
}

/** Saving placeholder shown while the pipeline runs. */
export function savingHtml(): string {
  return `<div class="cn-container">${loaderHtml('Saving your progress')}</div>`;
}

/**
 * Runs the result through the gamification pipeline and raises the toasts.
 * Returns what the pipeline decided so the caller can render it.
 */
export async function finishRound(
  summary: GameSummary,
  extras: ResultExtras = {},
): Promise<ProcessedResult> {
  const processed = await processGameResult(summary.result, extras);

  // Close the adaptive loop: the engine sees what its last recommendation produced.
  // The rule-based engine ignores this; a learned policy uses it to update itself.
  if (processed.saved && summary.result.topicId !== 'mixed') {
    observeOutcome({
      topicId: summary.result.topicId,
      difficulty: (summary.result.difficulty === 'mixed'
        ? 'medium'
        : (summary.result.difficulty ?? 'medium')) as Difficulty,
      gameType: summary.result.gameType,
      accuracy: summary.result.accuracy,
      masteryBefore: processed.masteryBefore,
      masteryAfter: processed.masteryAfter,
      attempted: summary.result.attempted,
    });
  }

  if (processed.queued) {
    showToast('You are offline — this round is saved on your device and will sync automatically.', {
      title: 'Saved for later',
      variant: 'warning',
    });
  }

  if (processed.leveledUp) {
    playCue('levelUp');
  }
  if (processed.unlockedAchievements.length > 0) {
    playCue('achievement');
  }

  if (processed.leveledUp) {
    showToast(`Level ${processed.levelAfter} — ${processed.newLevelTitle}`, {
      title: 'Level up',
      variant: 'success',
    });
  }
  for (const achievement of processed.unlockedAchievements) {
    showToast(`${achievement.name} · +${achievement.rewardXP} XP`, {
      title: 'Achievement unlocked',
      variant: 'success',
    });
  }

  return processed;
}
