/**
 * Rapid Fire screen — dynamic arcade clock, positive/negative time feedback,
 * kinetic question transitions and dramatic exhaust on buzzer/penalty.
 */

import type { Page, PageContext } from '@/types/page';
import { RapidFireEngine, RAPID_FIRE_DEFAULTS } from '@/games/rapid-fire/rapid-fire.engine';
import { finishRound, resultScreenHtml, savingHtml } from '@/games/shared/game-shell';
import { playCue } from '@/services/sound';
import { getQuestionRound, getTopic } from '@/services/content.service';
import { loaderHtml, stateHtml } from '@/components/loader';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import { enterSession, exitSession, gameHudHtml, setHudStreak, setHudTimer } from '@/games/shared/game-hud';
import type { AnsweredQuestion } from '@/models/game';
import type { Question } from '@/models/content';
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
let isAnswering = false;
let isExhausting = false;

function root(): HTMLElement | null {
  return qs(`#${ROOT_ID}`);
}

function stopTimer(): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function stageHtml(question: Question): string {
  return `
    <h1 class="cn-quiz__question cn-rapid__question">${escapeHtml(question.question)}</h1>

    <div class="cn-options cn-rapid__options" role="group" aria-label="Answer options">
      ${question.options
        .map(
          (option, index) => `
            <button type="button" class="cn-option" data-index="${index}" style="--option-idx: ${index}">
              <span class="cn-option__key" aria-hidden="true">${OPTION_KEYS[index]}</span>
              <span class="cn-option__text">${escapeHtml(option)}</span>
            </button>`,
        )
        .join('')}
    </div>
  `;
}

function arenaHtml(): string {
  const view = engine!.view();

  return `
    <div class="cn-container cn-quiz cn-rapid-arena" id="cn-rapid-arena">
      ${gameHudHtml({
        mode: 'Rapid Fire',
        streak: view.currentStreak,
        seconds: view.secondsLeft,
      })}

      <div class="cn-rapid__clock-wrap">
        <strong class="cn-rapid__clock" id="cn-rapid-clock" data-low="false" data-critical="false">
          <span id="cn-rapid-clock-num">${view.secondsLeft}</span>
        </strong>
        <div class="cn-rapid__pop-layer" id="cn-rapid-pop-layer"></div>
      </div>

      <div class="cn-rapid__status">
        <p class="cn-quiz__topic" id="cn-rapid-topic">
          ${escapeHtml(topicLabel)} · <span id="cn-rapid-score">${view.score}</span> correct
        </p>
        <div class="cn-rapid__streak-pill" id="cn-rapid-streak-pill" data-active="${view.currentStreak >= 2}">
          <span class="cn-rapid__streak-flame" aria-hidden="true">🔥</span>
          <span id="cn-rapid-streak-count">${view.currentStreak}x STREAK</span>
        </div>
      </div>

      <div class="cn-rapid__stage" id="cn-rapid-stage">
        ${stageHtml(view.question)}
      </div>

      <p class="cn-label mt-4">No explanations mid-round — review every answer when the clock stops.</p>
    </div>
  `;
}

function spawnTimePop(text: string, tone: 'bonus' | 'penalty'): void {
  const layer = qs<HTMLElement>('#cn-rapid-pop-layer');
  if (!layer) return;

  const pop = document.createElement('div');
  pop.className = `cn-time-pop cn-time-pop--${tone}`;
  pop.textContent = text;
  layer.appendChild(pop);
  window.setTimeout(() => pop.remove(), 750);
}

function bindOptionListeners(): void {
  const stage = qs<HTMLElement>('#cn-rapid-stage');
  if (!stage) return;

  qsa<HTMLButtonElement>('.cn-option', stage).forEach((button) => {
    button.addEventListener('click', () => {
      submit(Number(button.dataset.index));
    });
  });
}

function triggerExhaustAndFinish(): void {
  if (isExhausting) return;
  isExhausting = true;
  stopTimer();
  engine?.stop();

  playCue('defeat');

  const clock = qs<HTMLElement>('#cn-rapid-clock');
  if (clock) {
    clock.classList.remove('is-bonus', 'is-penalty');
    void clock.offsetWidth;
    clock.classList.add('is-exhausted');
    const clockNum = qs<HTMLElement>('#cn-rapid-clock-num');
    if (clockNum) clockNum.textContent = '0';
  }

  const container = root();
  if (container) {
    const overlay = document.createElement('div');
    overlay.className = 'cn-exhaust-overlay';
    overlay.innerHTML = `
      <div class="cn-exhaust-box">
        <i class="bi bi-alarm-fill" style="font-size: 3rem; color: var(--vga-red);" aria-hidden="true"></i>
        <h2 class="cn-exhaust-title">TIME EXHAUSTED!</h2>
        <p class="cn-exhaust-sub">The clock ran out · Round Complete</p>
      </div>
    `;
    container.appendChild(overlay);
  }

  window.setTimeout(() => {
    void finish();
  }, 850);
}

function submit(index: number | null): void {
  if (!engine || engine.isFinished() || isAnswering || isExhausting) return;
  isAnswering = true;

  // Lock buttons during micro-transition
  const stage = qs<HTMLElement>('#cn-rapid-stage');
  if (stage) {
    qsa<HTMLButtonElement>('.cn-option', stage).forEach((btn) => {
      btn.disabled = true;
    });
  }

  const answer = engine.answer(index);
  if (!answer) {
    isAnswering = false;
    return;
  }

  const selectedBtn = stage ? qs<HTMLButtonElement>(`.cn-option[data-index="${index}"]`, stage) : null;
  const correctBtn = stage ? qs<HTMLButtonElement>(`.cn-option[data-index="${answer.correctAnswer}"]`, stage) : null;

  const clock = qs<HTMLElement>('#cn-rapid-clock');
  const clockNum = qs<HTMLElement>('#cn-rapid-clock-num');
  const arena = qs<HTMLElement>('#cn-rapid-arena');

  if (answer.isCorrect) {
    playCue('correct');

    if (selectedBtn) {
      selectedBtn.classList.add('is-selected-correct');
    }

    if (clock) {
      clock.classList.remove('is-bonus', 'is-penalty');
      void clock.offsetWidth;
      clock.classList.add('is-bonus');
    }

    spawnTimePop(`+${answer.timeDeltaSeconds}s`, 'bonus');
  } else {
    playCue('wrong');

    if (selectedBtn) {
      selectedBtn.classList.add('is-selected-wrong');
    }
    if (correctBtn && correctBtn !== selectedBtn) {
      correctBtn.classList.add('is-reveal-correct');
    }

    if (clock) {
      clock.classList.remove('is-bonus', 'is-penalty');
      void clock.offsetWidth;
      clock.classList.add('is-penalty');
    }

    if (arena) {
      arena.classList.remove('cn-shake-screen');
      void arena.offsetWidth;
      arena.classList.add('cn-shake-screen');
    }

    spawnTimePop(`${answer.timeDeltaSeconds}s`, 'penalty');
  }

  // Update clock number immediately
  if (clockNum) {
    clockNum.textContent = String(engine.secondsLeft());
  }

  // Update live status & streak
  const view = engine.view();
  const scoreElem = qs<HTMLElement>('#cn-rapid-score');
  if (scoreElem) scoreElem.textContent = String(view.score);

  const streakPill = qs<HTMLElement>('#cn-rapid-streak-pill');
  const streakCount = qs<HTMLElement>('#cn-rapid-streak-count');
  if (streakPill) streakPill.dataset.active = String(view.currentStreak >= 2);
  if (streakCount) streakCount.textContent = `${view.currentStreak}x STREAK`;

  setHudStreak(view.currentStreak);
  setHudTimer(view.secondsLeft);

  // Check if round finished or exhausted
  if (answer.exhausted || engine.isFinished()) {
    triggerExhaustAndFinish();
    return;
  }

  // Next question transition with fast kinetic stagger
  window.setTimeout(() => {
    if (!engine || engine.isFinished() || isExhausting) {
      isAnswering = false;
      return;
    }

    const currentStage = qs<HTMLElement>('#cn-rapid-stage');
    if (currentStage) {
      currentStage.classList.remove('cn-rapid__stage');
      void currentStage.offsetWidth;
      currentStage.innerHTML = stageHtml(engine.view().question);
      currentStage.classList.add('cn-rapid__stage');
      bindOptionListeners();
    }

    isAnswering = false;
  }, 180);
}

function startTimer(): void {
  stopTimer();
  const totalMs = RAPID_FIRE_DEFAULTS.durationSeconds * 1000;

  const tick = (): void => {
    if (!engine || isExhausting) return;
    const remaining = engine.millisLeft();
    const low = remaining <= 10_000 && remaining > 5_000;
    const critical = remaining <= 5_000 && remaining > 0;

    const fill = qs<HTMLElement>('#cn-hud-fill');
    if (fill) {
      const pct = Math.min(100, Math.max(0, (remaining / totalMs) * 100));
      fill.style.width = `${pct}%`;
    }

    setHudTimer(engine.secondsLeft());

    const clockNum = qs<HTMLElement>('#cn-rapid-clock-num');
    if (clockNum) {
      clockNum.textContent = String(engine.secondsLeft());
    }

    const clock = qs<HTMLElement>('#cn-rapid-clock');
    if (clock) {
      clock.dataset.low = String(low);
      clock.dataset.critical = String(critical);
    }

    if (remaining === 0) {
      stopTimer();
      triggerExhaustAndFinish();
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
  isAnswering = false;
  isExhausting = false;
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
    container.innerHTML = arenaHtml();
    bindOptionListeners();
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
    enterSession();
    topicId = ctx.query.get('topic') ?? undefined;
    topicLabel = topicId ? ((await getTopic(topicId))?.title ?? 'Mixed topics') : 'Mixed topics';

    keyHandler = (event: KeyboardEvent) => {
      if (!engine || engine.isFinished() || isAnswering || isExhausting) return;
      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        submit(Number(event.key) - 1);
      }
    };
    window.addEventListener('keydown', keyHandler);

    await start();
  },

  unmount() {
    exitSession();
    stopTimer();
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    engine?.stop();
    engine = null;
    isAnswering = false;
    isExhausting = false;
  },
};

export default rapidFirePage;
