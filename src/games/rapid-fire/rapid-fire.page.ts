/**
 * Rapid Fire screen — one 60-second clock, immediate advance, no explanations mid-round.
 * Explanations are saved for the review list on the results screen.
 */

import type { Page, PageContext } from '@/types/page';
import { RapidFireEngine, RAPID_FIRE_DEFAULTS } from '@/games/rapid-fire/rapid-fire.engine';
import { finishRound, resultScreenHtml, savingHtml } from '@/games/shared/game-shell';
import { playCue } from '@/services/sound';
import { getQuestionRound, getTopic } from '@/services/content.service';
import { loaderHtml, stateHtml } from '@/components/loader';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import type { AnsweredQuestion } from '@/models/game';
import '@/styles/games.css';

const ROOT_ID = 'cn-rapid-root';
const AGAIN_ID = 'cn-rapid-again';
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const TICK_MS = 100;

let engine: RapidFireEngine | null = null;
let timerId: number | null = null;
let keyHandler: ((event: KeyboardEvent) => void) | null = null;
let topicLabel = 'Mixed topics';
let topicId: string | undefined;

function root(): HTMLElement | null {
  return qs(`#${ROOT_ID}`);
}

function stopTimer(): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function questionHtml(): string {
  const view = engine!.view();

  return `
    <div class="cn-quiz__bar">
      <span class="cn-quiz__count">Rapid Fire</span>
      <span class="cn-quiz__stats">
        <span>Correct <b>${view.score}</b></span>
        <span>Streak <b>${view.currentStreak}</b></span>
      </span>
    </div>

    <div class="cn-quiz__timerbar" id="cn-rapid-bar" role="progressbar"
         aria-label="Time remaining" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
      <span style="width:100%"></span>
    </div>
    <div class="cn-quiz__timer" id="cn-rapid-clock">
      <span>${escapeHtml(topicLabel)}</span>
      <span><span data-role="seconds">${view.secondsLeft}</span>s left</span>
    </div>

    <h1 class="cn-quiz__question">${escapeHtml(view.question.question)}</h1>

    <div class="cn-options" role="group" aria-label="Answer options">
      ${view.question.options
        .map(
          (option, index) => `
            <button type="button" class="cn-option" data-index="${index}">
              <span class="cn-option__key" aria-hidden="true">${OPTION_KEYS[index]}</span>
              <span>${escapeHtml(option)}</span>
            </button>`,
        )
        .join('')}
    </div>

    <p class="cn-label mt-4">No explanations mid-round — review every answer when the clock stops.</p>
  `;
}

/** A brief flash on the chosen option; the next question is already rendering behind it. */
function flash(answer: AnsweredQuestion, container: HTMLElement): void {
  const marker = document.createElement('div');
  marker.className = `cn-flash cn-flash--${answer.isCorrect ? 'correct' : 'wrong'}`;
  marker.setAttribute('role', 'status');
  marker.textContent = answer.isCorrect ? `✓ +${answer.xpEarned} XP` : '✗ Wrong';
  container.appendChild(marker);
  window.setTimeout(() => marker.remove(), 650);
}

function paintQuestion(): void {
  const container = root();
  if (!container || !engine) return;

  container.innerHTML = `<div class="cn-container cn-quiz">${questionHtml()}</div>`;
  qsa<HTMLButtonElement>('.cn-option', container).forEach((button) => {
    button.addEventListener('click', () => submit(Number(button.dataset.index)));
  });
}

function submit(index: number | null): void {
  if (!engine || engine.isFinished()) return;

  const answer = engine.answer(index);
  if (!answer) return;

  playCue(answer.isCorrect ? 'correct' : 'wrong');
  const container = root();
  if (container) flash(answer, container);

  if (engine.isFinished()) {
    void finish();
    return;
  }
  paintQuestion();
}

function startTimer(): void {
  stopTimer();
  const totalMs = RAPID_FIRE_DEFAULTS.durationSeconds * 1000;

  const tick = (): void => {
    if (!engine) return;
    const remaining = engine.millisLeft();
    const low = remaining <= 10_000;

    const bar = qs('#cn-rapid-bar');
    if (bar) {
      bar.setAttribute('data-low', String(low));
      bar.setAttribute('aria-valuenow', String(Math.round((remaining / totalMs) * 100)));
      const fill = qs('span', bar);
      if (fill) fill.style.width = `${(remaining / totalMs) * 100}%`;
    }
    const clock = qs('#cn-rapid-clock');
    if (clock) {
      clock.setAttribute('data-low', String(low));
      const seconds = qs('[data-role="seconds"]', clock);
      if (seconds) seconds.textContent = String(engine.secondsLeft());
    }

    if (remaining === 0) {
      stopTimer();
      void finish();
    }
  };

  tick();
  timerId = window.setInterval(tick, TICK_MS);
}

function reviewHtml(answers: AnsweredQuestion[]): string {
  if (answers.length === 0) return '';

  return `
    <section style="margin-top: var(--cn-space-7)">
      <span class="cn-label cn-label--marked">Every answer</span>
      <div class="cn-review">
        ${answers
          .map(
            (answer, index) => `
              <article class="cn-review__item" data-correct="${answer.isCorrect}">
                <p class="cn-review__q">${index + 1}. ${escapeHtml(answer.question)}</p>
                <p class="cn-review__line cn-review__line--right">
                  ✓ ${escapeHtml(answer.options[answer.correctAnswer])}
                </p>
                ${
                  answer.isCorrect
                    ? ''
                    : `<p class="cn-review__line cn-review__line--yours">✗ You answered: ${
                        answer.selectedAnswer === null
                          ? 'nothing'
                          : escapeHtml(answer.options[answer.selectedAnswer])
                      }</p>`
                }
                <p class="cn-review__why">${escapeHtml(answer.explanation)}</p>
              </article>`,
          )
          .join('')}
      </div>
    </section>
  `;
}

async function finish(): Promise<void> {
  const container = root();
  if (!container || !engine) return;

  stopTimer();
  engine.stop();

  const summary = engine.summary();
  const breakdown = engine.xpBreakdown();
  container.innerHTML = savingHtml();

  const processed = await finishRound(summary);
  if (root() !== container) return;

  const { result } = summary;
  container.innerHTML = `<div class="cn-container">${resultScreenHtml(
    processed,
    {
      caption: `Rapid Fire · ${topicLabel}`,
      score: String(result.correct),
      scoreSuffix: `/${result.attempted}`,
      stats: [
        { label: 'Accuracy', value: `${result.accuracy}%` },
        { label: 'Answered', value: String(result.attempted) },
        { label: 'Best streak', value: String(result.bestStreak ?? 0) },
        { label: 'Time', value: `${result.durationSeconds}s` },
      ],
      xpRows: [
        { label: `${result.correct} correct answers`, xp: breakdown.answerXp },
        { label: 'Accuracy bonus', xp: breakdown.accuracyBonus },
        { label: 'Streak bonus', xp: breakdown.streakBonus },
        { label: 'Perfect round bonus', xp: breakdown.perfectBonus },
      ],
      extraHtml: reviewHtml(summary.answers),
    },
    AGAIN_ID,
  )}</div>`;

  qs<HTMLButtonElement>(`#${AGAIN_ID}`, container)?.addEventListener('click', () => void start());
}

async function start(): Promise<void> {
  const container = root();
  if (!container) return;

  stopTimer();
  engine = null;
  container.innerHTML = `<div class="cn-container">${loaderHtml('Loading questions')}</div>`;

  try {
    const questions = await getQuestionRound(RAPID_FIRE_DEFAULTS.questionPool, {
      gameType: 'rapid-fire',
      ...(topicId ? { topicId } : {}),
    });

    if (questions.length === 0) {
      container.innerHTML = `<div class="cn-container">${stateHtml({
        icon: 'bi-patch-question',
        title: 'No questions available',
        message: 'This topic has no questions yet. Try another topic or the mixed round.',
        actionLabel: 'Back to games',
        actionHref: '#/games',
      })}</div>`;
      return;
    }

    engine = new RapidFireEngine(questions, { ...(topicId ? { topicId } : {}) });
    paintQuestion();
    startTimer();
  } catch (error) {
    console.error('[rapid-fire] could not start', error);
    container.innerHTML = `<div class="cn-container">${stateHtml({
      icon: 'bi-exclamation-triangle',
      title: "We couldn't load this challenge",
      message: 'Check your connection or try again in a moment.',
      actionLabel: 'Back to games',
      actionHref: '#/games',
    })}</div>`;
  }
}

const rapidFirePage: Page = {
  title: 'Rapid Fire',

  render() {
    return `<section id="${ROOT_ID}">${loaderHtml('Preparing Rapid Fire')}</section>`;
  },

  async mount(ctx: PageContext) {
    topicId = ctx.query.get('topic') ?? undefined;
    topicLabel = topicId ? ((await getTopic(topicId))?.title ?? 'Mixed topics') : 'Mixed topics';

    keyHandler = (event: KeyboardEvent) => {
      if (!engine || engine.isFinished()) return;
      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        submit(Number(event.key) - 1);
      }
    };
    window.addEventListener('keydown', keyHandler);

    await start();
  },

  unmount() {
    stopTimer();
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    engine?.stop();
    engine = null;
  },
};

export default rapidFirePage;
