/**
 * Boss Battle screen — HP bars, damage numbers, combat animations and a verdict.
 *
 * Route: `#/games/boss` picks a boss, `#/games/boss?boss=<id>` fights a specific one.
 */

import type { Page, PageContext } from '@/types/page';
import { BossEngine } from '@/games/boss/boss.engine';
import { finishRound, resultScreenHtml, savingHtml } from '@/games/shared/game-shell';
import { playCue } from '@/services/sound';
import { getBosses, getQuestionRound } from '@/services/content.service';
import { questionScope, startAdaptiveSession } from '@/services/adaptive';
import { loaderHtml, stateHtml } from '@/components/loader';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import { enterSession, exitSession, gameHudHtml, setHudLives } from '@/games/shared/game-hud';
import type { Boss } from '@/models/content';
import '@/styles/games.css';
import '@/styles/arena.css';

const ROOT_ID = 'cn-boss-root';
const AGAIN_ID = 'cn-boss-again';
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const QUESTION_POOL = 20;

let engine: BossEngine | null = null;
let bosses: Boss[] = [];
let activeBoss: Boss | null = null;

function root(): HTMLElement | null {
  return qs(`#${ROOT_ID}`);
}

function hpBarHtml(label: string, current: number, max: number, percent: number, variant: string): string {
  const isCritical = percent <= 25;
  return `
    <div class="cn-hp cn-hp--${variant} ${isCritical ? 'is-critical' : ''}">
      <div class="cn-hp__row">
        <span class="cn-label">${escapeHtml(label)}</span>
        <span class="cn-hp__value">${current} / ${max}</span>
      </div>
      <div class="cn-hp__track">
        <div class="cn-hp__fill" style="width:${percent}%"></div>
      </div>
    </div>
  `;
}

function battleHtml(): string {
  const view = engine!.view();
  const answered = view.status === 'feedback';
  const last = view.lastAnswer;

  const options = view.question.options
    .map((option, index) => {
      let state = '';
      let mark = '';
      if (answered && last) {
        if (index === last.correctAnswer) {
          state = 'correct';
          mark = '<span class="cn-option__mark">✓ Correct</span>';
        } else if (index === last.selectedAnswer) {
          state = 'wrong';
          mark = '<span class="cn-option__mark">✗ Your answer</span>';
        } else {
          state = 'muted';
        }
      }

      return `
        <button type="button" class="cn-option" data-index="${index}"
          ${state ? `data-state="${state}"` : ''} ${answered ? 'disabled' : ''}>
          <span class="cn-option__key" aria-hidden="true">${OPTION_KEYS[index]}</span>
          <span>${escapeHtml(option)}</span>
          ${mark}
        </button>`;
    })
    .join('');

  const hitBoss = answered && last?.isCorrect;
  const hitPlayer = answered && last && !last.isCorrect;

  return `
    ${gameHudHtml({
      mode: 'Boss Battle',
      lives: { remaining: view.playerHp, total: view.playerMaxHp },
    })}

    <div class="cn-arena cn-arena--boss ${hitPlayer ? 'is-player-hit' : ''}">
      <header class="cn-boss__head">
        <div style="position: relative;">
          <span class="cn-boss__sigil ${hitBoss ? 'is-hit' : ''}" aria-hidden="true">
            <i class="bi ${escapeHtml(view.boss.icon)}"></i>
          </span>
          ${
            hitBoss
              ? `<div class="cn-dmg-float cn-dmg-float--boss" aria-hidden="true">💥 -${view.lastDamage} HP</div>`
              : ''
          }
        </div>
        <div>
          <h1 class="cn-boss__name">${escapeHtml(view.boss.name)}</h1>
          <p class="cn-boss__subtitle">${escapeHtml(view.boss.title)}</p>
        </div>
      </header>

      <div class="cn-boss__bars" style="position: relative;">
        ${hpBarHtml(view.boss.name, view.bossHp, view.bossMaxHp, view.bossHpPercent, 'boss')}
        ${hpBarHtml('You', view.playerHp, view.playerMaxHp, view.playerHpPercent, 'player')}
        ${
          hitPlayer
            ? `<div class="cn-dmg-float cn-dmg-float--player" aria-hidden="true">💔 -${view.lastDamage} HP</div>`
            : ''
        }
      </div>

      ${
        answered && last
          ? `<p class="cn-boss__damage" role="status">
               ${
                 last.isCorrect
                   ? `You hit ${escapeHtml(view.boss.name)} for ${view.lastDamage} damage.`
                   : `${escapeHtml(view.boss.name)} strikes back for ${view.lastDamage} damage.`
               }
             </p>`
          : `<p class="cn-boss__quote">“${escapeHtml(view.boss.intro)}”</p>`
      }

      <div class="cn-boss__stage ${!answered ? 'cn-boss__stage--enter' : ''}">
        <h2 class="cn-quiz__question">${escapeHtml(view.question.question)}</h2>
        <div class="cn-options" role="group" aria-label="Answer options">${options}</div>
      </div>

      ${
        answered && last
          ? `<div class="cn-feedback" data-correct="${last.isCorrect}">
               <div class="cn-feedback__head">
                 <span>${last.isCorrect ? '✓ Direct hit' : '✗ You take damage'}</span>
                 ${last.isCorrect ? `<span class="cn-feedback__xp">+${last.xpEarned} XP</span>` : ''}
               </div>
               <p>${escapeHtml(last.explanation)}</p>
               <div class="cn-feedback__actions">
                 <button type="button" class="btn btn-cn-primary" id="cn-boss-next">Continue</button>
               </div>
             </div>`
          : `<div class="cn-arena__foot">
               <button type="button" class="btn btn-cn-ghost btn-sm" id="cn-boss-flee">Retreat (counts as a defeat)</button>
             </div>`
      }
    </div>
  `;
}

function paint(): void {
  const container = root();
  if (!container || !engine) return;

  container.innerHTML = battleHtml();

  qsa<HTMLButtonElement>('.cn-option', container).forEach((button) => {
    button.addEventListener('click', () => {
      const answer = engine!.answer(Number(button.dataset.index));
      playCue(answer?.isCorrect ? 'correct' : 'wrong');

      paint();
      // Repainted first: the HUD lives inside the markup paint() replaces.
      const view = engine!.view();
      setHudLives(view.playerHp, view.playerMaxHp);
    });
  });

  const next = qs<HTMLButtonElement>('#cn-boss-next', container);
  next?.focus();
  next?.addEventListener('click', () => {
    const status = engine!.next();
    if (status === 'victory' || status === 'defeat') void finish();
    else paint();
  });

  qs<HTMLButtonElement>('#cn-boss-flee', container)?.addEventListener('click', () => {
    engine!.flee();
    void finish();
  });
}

async function finish(): Promise<void> {
  const container = root();
  if (!container || !engine) return;

  const victory = engine.isVictory();
  playCue(victory ? 'victory' : 'defeat');
  const summary = engine.summary();
  const breakdown = engine.xpBreakdown();
  container.innerHTML = savingHtml();

  const processed = await finishRound(summary, { bossVictory: victory });
  if (root() !== container) return;

  const { result } = summary;
  const view = engine.view();

  container.innerHTML = `<div class="cn-container">
    ${resultScreenHtml(
      processed,
      {
        caption: `${activeBoss?.name ?? 'Boss'} · ${victory ? 'defeated' : 'still standing'}`,
        score: '',
        verdict: victory ? 'VICTORY' : 'DEFEAT',
        stats: [
          { label: 'Boss HP left', value: String(view.bossHp) },
          { label: 'Your HP left', value: String(view.playerHp) },
          { label: 'Accuracy', value: `${result.accuracy}%` },
          { label: 'Questions', value: String(result.attempted) },
        ],
        xpRows: [
          { label: 'Correct answers', xp: breakdown.answerXp },
          { label: 'Accuracy bonus', xp: breakdown.accuracyBonus },
          { label: 'Streak bonus', xp: breakdown.streakBonus },
        ],
        extraHtml: `<p class="cn-boss__quote mt-4">“${escapeHtml(
          victory ? (activeBoss?.defeatLine ?? '') : (activeBoss?.victoryLine ?? ''),
        )}”</p>`,
      },
      AGAIN_ID,
    )}
  </div>`;

  qs<HTMLButtonElement>(`#${AGAIN_ID}`, container)?.addEventListener('click', () => void start());
}

async function start(): Promise<void> {
  const container = root();
  if (!container || !activeBoss) return;

  container.innerHTML = `<div class="cn-container">${loaderHtml('Summoning the boss')}</div>`;

  try {
    // A boss spans a whole unit, so it shares the mixed-topic skill estimate.
    const [questions, adaptive] = await Promise.all([
      getQuestionRound(QUESTION_POOL, { gameType: 'boss', unitId: activeBoss.unitId }),
      startAdaptiveSession(questionScope()),
    ]);

    if (questions.length === 0) {
      container.innerHTML = `<div class="cn-container">${stateHtml({
        icon: 'bi-shield-slash',
        title: 'This boss has no questions yet',
        message: 'The unit behind this battle has no question bank. Try another boss.',
        actionLabel: 'Back to games',
        actionHref: '#/games',
      })}</div>`;
      return;
    }

    engine = new BossEngine(activeBoss, questions, { adaptive });
    paint();
  } catch (error) {
    console.error('[boss] could not start', error);
    container.innerHTML = `<div class="cn-container">${stateHtml({
      icon: 'bi-exclamation-triangle',
      title: "We couldn't start this battle",
      message: 'Check your connection or try again in a moment.',
      actionLabel: 'Back to games',
      actionHref: '#/games',
    })}</div>`;
  }
}

const bossPage: Page = {
  title: 'Boss Battle',

  render() {
    return `<section id="${ROOT_ID}">${loaderHtml('Preparing the battle')}</section>`;
  },

  async mount(ctx: PageContext) {
    enterSession();
    const bossId = ctx.query.get('boss');
    const unitId = ctx.query.get('unit') ?? undefined;

    bosses = await getBosses(unitId);
    if (bosses.length === 0) bosses = await getBosses();

    activeBoss = bossId ? (bosses.find((boss) => boss.id === bossId) ?? bosses[0]) : bosses[0];

    if (!activeBoss) {
      const container = root();
      if (container) {
        container.innerHTML = `<div class="cn-container">${stateHtml({
          icon: 'bi-shield-slash',
          title: 'No bosses available',
          message: 'No boss battles are configured yet.',
          actionLabel: 'Back to games',
          actionHref: '#/games',
        })}</div>`;
      }
      return;
    }

    await start();
  },

  unmount() {
    exitSession();
    engine = null;
    activeBoss = null;
  },
};

export default bossPage;
