/**
 * Network Riddles screen — type the answer, or spend XP on a hint.
 */

import type { Page, PageContext } from '@/types/page';
import { RiddleEngine } from '@/games/riddles/riddle.engine';
import { finishRound, resultScreenHtml, savingHtml } from '@/games/shared/game-shell';
import { playCue } from '@/services/sound';
import { getRiddles } from '@/services/content.service';
import { shuffle } from '@/services/content.filters';
import { loaderHtml, stateHtml } from '@/components/loader';
import { escapeHtml, qs } from '@/utils/dom';
import { enterSession, exitSession, gameHudHtml } from '@/games/shared/game-hud';
import type { Riddle } from '@/models/content';
import '@/styles/games.css';

const ROOT_ID = 'cn-riddle-root';
const AGAIN_ID = 'cn-riddle-again';
const ROUND_SIZE = 5;

let engine: RiddleEngine | null = null;
let pool: Riddle[] = [];

function root(): HTMLElement | null {
  return qs(`#${ROOT_ID}`);
}

function askHtml(): string {
  const view = engine!.view();

  return `
    ${gameHudHtml({
      mode: 'Network Riddles',
      progress: { current: view.index, total: view.total },
      xp: view.xpAtStake,
    })}

    <div class="cn-arena cn-arena--riddle">
      <p class="cn-riddle__label">Clue ${String(view.index).padStart(2, '0')}</p>
      <p class="cn-riddle__clue">${escapeHtml(view.riddle.question)}</p>

      <div class="cn-riddle__hints" aria-live="polite">
        ${view.revealedHints
          .map(
            (hint, index) =>
              `<p class="cn-riddle__hint"><span class="cn-label">Hint ${index + 1}</span>${escapeHtml(hint)}</p>`,
          )
          .join('')}
      </div>

      <form id="cn-riddle-form" class="cn-riddle__form" novalidate>
        <label class="visually-hidden" for="cn-riddle-answer">Your answer</label>
        <input
          class="form-control cn-riddle__input"
          id="cn-riddle-answer"
          name="answer"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Name the protocol, device or term…"
        />
        <div class="cn-riddle__actions">
          <button class="btn btn-cn-primary" type="submit">Lock answer</button>
          <button class="btn btn-cn-ghost" type="button" id="cn-riddle-hint" ${
            view.hintsRemaining === 0 ? 'disabled' : ''
          }>
            Hint (−5 XP) · ${view.hintsRemaining} left
          </button>
          <button class="btn btn-cn-ghost" type="button" id="cn-riddle-skip">Skip</button>
        </div>
      </form>
    </div>
  `;
}

function feedbackHtml(): string {
  const view = engine!.view();
  const attempt = view.lastAttempt!;

  return `
    ${gameHudHtml({
      mode: 'Network Riddles',
      progress: { current: view.index, total: view.total },
      xp: attempt.isCorrect ? attempt.xpEarned : 0,
    })}

    <div class="cn-arena cn-arena--riddle">
      <p class="cn-riddle__verdict" data-correct="${attempt.isCorrect}">
        <i class="bi ${attempt.isCorrect ? 'bi-check-circle-fill' : 'bi-x-circle'}" aria-hidden="true"></i>
        ${attempt.isCorrect ? 'Decoded' : 'Not quite'}
      </p>

      <p class="cn-riddle__clue">${escapeHtml(attempt.question)}</p>

      <div class="cn-feedback" data-correct="${attempt.isCorrect}">
        <div class="cn-feedback__head">
          <span>Answer</span>
          <span class="cn-feedback__xp">${escapeHtml(attempt.answer)}</span>
        </div>
        ${
          attempt.isCorrect
            ? `<p>You answered “${escapeHtml(attempt.given)}”${
                attempt.hintsUsed > 0 ? ` after ${attempt.hintsUsed} hint${attempt.hintsUsed > 1 ? 's' : ''}` : ' with no hints'
              }.</p>`
            : `<p>You answered “${escapeHtml(attempt.given || 'nothing')}”.</p>`
        }
        <div class="cn-feedback__actions">
          <button type="button" class="btn btn-cn-primary" id="cn-riddle-next">Next</button>
        </div>
      </div>
    </div>
  `;
}

function paint(savedValue?: string): void {
  const container = root();
  if (!container || !engine) return;

  const view = engine.view();

  if (view.status === 'feedback') {
    container.innerHTML = feedbackHtml();
    const next = qs<HTMLButtonElement>('#cn-riddle-next', container);
    next?.focus();
    next?.addEventListener('click', () => {
      if (engine!.next() === 'finished') void finish();
      else paint();
    });
    return;
  }

  container.innerHTML = askHtml();
  const input = qs<HTMLInputElement>('#cn-riddle-answer', container);
  if (input && savedValue) {
    input.value = savedValue;
  }
  input?.focus();

  qs<HTMLFormElement>('#cn-riddle-form', container)?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input?.value ?? '';
    if (!value.trim()) {
      input?.focus();
      return;
    }
    const attempt = engine!.submit(value);
    playCue(attempt?.isCorrect ? 'correct' : 'wrong');
    paint();
  });

  qs<HTMLButtonElement>('#cn-riddle-hint', container)?.addEventListener('click', () => {
    const currentVal = input?.value ?? '';
    engine!.useHint();
    paint(currentVal);
  });

  qs<HTMLButtonElement>('#cn-riddle-skip', container)?.addEventListener('click', () => {
    engine!.skip();
    paint();
  });
}

async function finish(): Promise<void> {
  const container = root();
  if (!container || !engine) return;

  const summary = engine.summary();
  const breakdown = engine.xpBreakdown();
  const solvedWithoutHint = engine.solvedWithoutHint();
  container.innerHTML = savingHtml();

  const processed = await finishRound(summary, { riddlesSolvedWithoutHint: solvedWithoutHint });
  if (root() !== container) return;

  const { result } = summary;
  container.innerHTML = `<div class="cn-container">${resultScreenHtml(
    processed,
    {
      caption: 'Network Riddles',
      score: String(result.correct),
      scoreSuffix: `/${result.attempted}`,
      stats: [
        { label: 'Accuracy', value: `${result.accuracy}%` },
        { label: 'No-hint solves', value: String(solvedWithoutHint) },
        { label: 'Best streak', value: String(result.bestStreak ?? 0) },
        { label: 'Time', value: `${result.durationSeconds}s` },
      ],
      xpRows: [
        { label: 'Riddles solved', xp: breakdown.answerXp },
        { label: 'Accuracy bonus', xp: breakdown.accuracyBonus },
        { label: 'Streak bonus', xp: breakdown.streakBonus },
        { label: 'Perfect round bonus', xp: breakdown.perfectBonus },
      ],
    },
    AGAIN_ID,
  )}</div>`;

  qs<HTMLButtonElement>(`#${AGAIN_ID}`, container)?.addEventListener('click', () => void start());
}

async function start(): Promise<void> {
  const container = root();
  if (!container) return;

  if (pool.length === 0) {
    container.innerHTML = `<div class="cn-container">${stateHtml({
      icon: 'bi-question-diamond',
      title: 'No riddles available',
      message: 'There are no riddles for this topic yet. Try another topic.',
      actionLabel: 'Back to games',
      actionHref: '#/games',
    })}</div>`;
    return;
  }

  engine = new RiddleEngine(shuffle(pool).slice(0, ROUND_SIZE));
  paint();
}

const riddlePage: Page = {
  title: 'Network Riddles',

  render() {
    return `<section id="${ROOT_ID}">${loaderHtml('Preparing riddles')}</section>`;
  },

  async mount(ctx: PageContext) {
    enterSession();
    const topicId = ctx.query.get('topic') ?? undefined;
    const scoped = await getRiddles(topicId ? { topicId } : {});
    pool = scoped.length > 0 ? scoped : await getRiddles();
    await start();
  },

  unmount() {
    exitSession();
    engine?.abandon();
    engine = null;
  },
};

export default riddlePage;
