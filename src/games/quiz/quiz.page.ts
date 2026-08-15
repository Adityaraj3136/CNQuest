/**
 * Quiz Blitz screen.
 *
 * The page owns rendering, the timer and input; QuizEngine owns every rule.
 * Phase 5 will hand `summary().result` to GameResultService instead of only displaying it.
 *
 * Query parameters: `?topic=<topicId>&count=<n>&difficulty=<easy|medium|hard>`
 */

import type { Page, PageContext } from '@/types/page';
import { QuizEngine, QUIZ_DEFAULTS } from '@/games/quiz/quiz.engine';
import { getQuestionRound, getTopic } from '@/services/content.service';
import { loaderHtml, stateHtml } from '@/components/loader';
import { showToast } from '@/components/toast';
import { finishRound, resultScreenHtml, savingHtml } from '@/games/shared/game-shell';
import { playCue } from '@/services/sound';
import { suggestDifficulty } from '@/services/adaptive';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import type { AnsweredQuestion, GameSummary } from '@/models/game';
import type { ProcessedResult } from '@/services/game-result.service';
import type { Difficulty } from '@/models/content';
import '@/styles/games.css';

const ROOT_ID = 'cn-quiz-root';
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const TICK_MS = 100;

let engine: QuizEngine | null = null;
let timerId: number | null = null;
let deadline = 0;
let keyHandler: ((event: KeyboardEvent) => void) | null = null;
let topicLabel = 'Computer Networks';

// ---------------------------------------------------------------- rendering

function statChipsHtml(): string {
  const view = engine!.view();
  return `
    <span>Correct <b>${view.score}</b></span>
    <span>Streak <b>${view.currentStreak}</b></span>
  `;
}

function questionHtml(): string {
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
        <button
          type="button"
          class="cn-option"
          data-index="${index}"
          ${state ? `data-state="${state}"` : ''}
          ${answered ? 'disabled' : ''}
        >
          <span class="cn-option__key" aria-hidden="true">${OPTION_KEYS[index]}</span>
          <span>${escapeHtml(option)}</span>
          ${mark}
        </button>
      `;
    })
    .join('');

  return `
    <div class="cn-quiz__bar">
      <span class="cn-quiz__count">
        Q${String(view.questionNumber).padStart(2, '0')} / ${String(view.totalQuestions).padStart(2, '0')}
      </span>
      <span class="cn-quiz__stats">${statChipsHtml()}</span>
    </div>

    <div class="cn-quiz__timerbar" id="cn-timer-bar" role="progressbar"
         aria-label="Time remaining for this question" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
      <span style="width: 100%"></span>
    </div>
    <div class="cn-quiz__timer" id="cn-timer-label">
      <span>${escapeHtml(topicLabel)}</span>
      <span><span data-role="seconds">${view.secondsPerQuestion}</span>s remaining</span>
    </div>

    <h1 class="cn-quiz__question">${escapeHtml(view.question.question)}</h1>

    <div class="cn-options" role="group" aria-label="Answer options">${options}</div>

    <div id="cn-feedback" aria-live="polite">${answered && last ? feedbackHtml(last) : ''}</div>
  `;
}

function feedbackHtml(answer: AnsweredQuestion): string {
  const timedOut = answer.selectedAnswer === null;
  const heading = answer.isCorrect ? '✓ Correct' : timedOut ? '✗ Time up' : '✗ Incorrect';

  return `
    <div class="cn-feedback" data-correct="${answer.isCorrect}">
      <div class="cn-feedback__head">
        <span>${heading}</span>
        ${answer.isCorrect ? `<span class="cn-feedback__xp">+${answer.xpEarned} XP</span>` : ''}
      </div>
      ${
        answer.isCorrect
          ? ''
          : `<p class="mb-2"><strong>Correct answer:</strong> ${escapeHtml(answer.options[answer.correctAnswer])}</p>`
      }
      <p>${escapeHtml(answer.explanation)}</p>
      <div class="cn-feedback__actions">
        <button type="button" class="btn btn-cn-primary" id="cn-next-btn">
          Next <i class="bi bi-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `;
}

function resultsHtml(summary: GameSummary, processed: ProcessedResult): string {
  const { result } = summary;
  const xp = engine!.xpBreakdown();
  const minutes = Math.floor(result.durationSeconds / 60);
  const seconds = result.durationSeconds % 60;

  return resultScreenHtml(
    processed,
    {
      caption: `Quiz complete · ${topicLabel}`,
      score: String(result.correct),
      scoreSuffix: `/${result.attempted}`,
      stats: [
        { label: 'Accuracy', value: `${result.accuracy}%` },
        { label: 'Best streak', value: String(result.bestStreak ?? 0) },
        { label: 'Time', value: `${minutes}m ${String(seconds).padStart(2, '0')}s` },
        { label: 'Difficulty', value: String(result.difficulty ?? 'mixed') },
      ],
      xpRows: [
        { label: `${result.correct} correct answers`, xp: xp.answerXp },
        { label: 'Accuracy bonus', xp: xp.accuracyBonus },
        { label: 'Streak bonus', xp: xp.streakBonus },
        { label: 'Perfect round bonus', xp: xp.perfectBonus },
      ],
      extraHtml: `
        <div class="cn-result__actions">
          <button type="button" class="btn btn-cn-ghost" id="cn-review-btn">Review answers</button>
        </div>
        <div id="cn-review" class="cn-review" hidden></div>
      `,
    },
    'cn-again-btn',
  );
}

function reviewHtml(answers: AnsweredQuestion[]): string {
  return answers
    .map((answer, index) => {
      const yours =
        answer.selectedAnswer === null
          ? 'No answer (time ran out)'
          : escapeHtml(answer.options[answer.selectedAnswer]);

      return `
        <article class="cn-review__item" data-correct="${answer.isCorrect}">
          <p class="cn-review__q">${index + 1}. ${escapeHtml(answer.question)}</p>
          ${
            answer.isCorrect
              ? `<p class="cn-review__line cn-review__line--right">✓ You answered: ${yours}</p>`
              : `<p class="cn-review__line cn-review__line--yours">✗ You answered: ${yours}</p>
                 <p class="cn-review__line cn-review__line--right">✓ Correct: ${escapeHtml(answer.options[answer.correctAnswer])}</p>`
          }
          <p class="cn-review__why">${escapeHtml(answer.explanation)}</p>
        </article>
      `;
    })
    .join('');
}

// ---------------------------------------------------------------- timer

function stopTimer(): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function startTimer(): void {
  stopTimer();
  const totalMs = engine!.view().secondsPerQuestion * 1000;
  deadline = Date.now() + totalMs;

  const tick = (): void => {
    const remainingMs = Math.max(0, deadline - Date.now());
    const percent = (remainingMs / totalMs) * 100;
    const secondsLeft = Math.ceil(remainingMs / 1000);
    const low = remainingMs <= 5000;

    const label = qs('#cn-timer-label');
    const bar = qs('#cn-timer-bar');
    if (label) {
      label.setAttribute('data-low', String(low));
      const value = qs('[data-role="seconds"]', label);
      if (value) value.textContent = String(secondsLeft);
    }
    if (bar) {
      bar.setAttribute('data-low', String(low));
      bar.setAttribute('aria-valuenow', String(Math.round(percent)));
      const fill = qs('span', bar);
      if (fill) fill.style.width = `${percent}%`;
    }

    if (remainingMs === 0) {
      stopTimer();
      submitAnswer(null);
    }
  };

  tick();
  timerId = window.setInterval(tick, TICK_MS);
}

// ---------------------------------------------------------------- interaction

function root(): HTMLElement | null {
  return qs(`#${ROOT_ID}`);
}

function submitAnswer(selected: number | null): void {
  if (!engine || engine.isFinished()) return;

  const recorded = engine.answer(selected);
  if (!recorded) return;

  playCue(recorded.isCorrect ? 'correct' : 'wrong');
  stopTimer();
  paintQuestion();
}

function goNext(): void {
  if (!engine) return;

  if (engine.next() === 'finished') {
    void paintResults();
    return;
  }
  paintQuestion();
}

function paintQuestion(): void {
  const container = root();
  if (!container || !engine) return;

  container.innerHTML = `<div class="cn-container cn-quiz">${questionHtml()}</div>`;

  const view = engine.view();
  if (view.status === 'asking') {
    qsa<HTMLButtonElement>('.cn-option', container).forEach((button) => {
      button.addEventListener('click', () => submitAnswer(Number(button.dataset.index)));
    });
    startTimer();
  } else {
    qs<HTMLButtonElement>('#cn-next-btn', container)?.focus();
    qs<HTMLButtonElement>('#cn-next-btn', container)?.addEventListener('click', goNext);
  }
}

async function paintResults(): Promise<void> {
  const container = root();
  if (!container || !engine) return;

  stopTimer();
  const summary = engine.summary();

  // The pipeline decides XP, level, streak, mastery and achievements — the page only shows them.
  container.innerHTML = savingHtml();
  const processed = await finishRound(summary);

  if (root() !== container) return; // the student navigated away mid-save
  container.innerHTML = `<div class="cn-container">${resultsHtml(summary, processed)}</div>`;

  const reviewPanel = qs('#cn-review', container);
  qs<HTMLButtonElement>('#cn-review-btn', container)?.addEventListener('click', (event) => {
    if (!reviewPanel) return;
    const opening = reviewPanel.hidden;
    if (opening && reviewPanel.childElementCount === 0) {
      reviewPanel.innerHTML = reviewHtml(summary.answers);
    }
    reviewPanel.hidden = !opening;
    (event.currentTarget as HTMLButtonElement).textContent = opening ? 'Hide review' : 'Review answers';
    if (opening) reviewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  qs<HTMLButtonElement>('#cn-again-btn', container)?.addEventListener('click', () => {
    void startRound();
  });
}

/** Number keys 1-4 answer; Enter advances. Keyboard players never need the mouse. */
function bindKeys(): void {
  keyHandler = (event: KeyboardEvent): void => {
    if (!engine || engine.isFinished()) return;
    const view = engine.view();

    if (view.status === 'asking' && /^[1-4]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (index < view.question.options.length) {
        event.preventDefault();
        submitAnswer(index);
      }
      return;
    }

    if (view.status === 'feedback' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      goNext();
    }
  };

  window.addEventListener('keydown', keyHandler);
}

// ---------------------------------------------------------------- lifecycle

let roundOptions: { topicId?: string; difficulty?: Difficulty; count: number } = {
  count: QUIZ_DEFAULTS.questionCount,
};

async function startRound(): Promise<void> {
  const container = root();
  if (!container) return;

  stopTimer();
  engine = null;
  container.innerHTML = `<div class="cn-container">${loaderHtml('Loading your questions…')}</div>`;

  try {
    const questions = await getQuestionRound(roundOptions.count, {
      gameType: 'quiz',
      ...(roundOptions.topicId ? { topicId: roundOptions.topicId } : {}),
      ...(roundOptions.difficulty ? { difficulty: roundOptions.difficulty } : {}),
    });

    if (questions.length === 0) {
      container.innerHTML = `<div class="cn-container">${stateHtml({
        icon: 'bi-patch-question',
        title: 'No questions available',
        message: 'This topic has no questions yet. Try another topic or the mixed quiz.',
        actionLabel: 'Back to Learn',
        actionHref: '#/learn',
      })}</div>`;
      return;
    }

    if (questions.length < roundOptions.count) {
      showToast(`Only ${questions.length} questions are available for this selection.`, {
        variant: 'info',
      });
    }

    engine = new QuizEngine(questions, {
      ...(roundOptions.topicId ? { topicId: roundOptions.topicId } : {}),
    });
    paintQuestion();
  } catch (error) {
    console.error('[quiz] could not start round', error);
    container.innerHTML = `<div class="cn-container">${stateHtml({
      icon: 'bi-exclamation-triangle',
      title: "We couldn't load this challenge",
      message: 'Check your connection or try again in a moment.',
      actionLabel: 'Back to games',
      actionHref: '#/games',
    })}</div>`;
  }
}

const quizPage: Page = {
  title: 'Quiz Blitz',

  render() {
    return `<section id="${ROOT_ID}">${loaderHtml('Preparing Quiz Blitz…')}</section>`;
  },

  async mount(ctx: PageContext) {
    const topicId = ctx.query.get('topic') ?? undefined;
    const difficultyParam = ctx.query.get('difficulty');
    const countParam = Number(ctx.query.get('count'));

    const difficulty =
      difficultyParam === 'easy' || difficultyParam === 'medium' || difficultyParam === 'hard'
        ? difficultyParam
        : undefined;

    // No explicit difficulty and a topic with history: let the adaptive engine pick the level.
    const adaptiveDifficulty =
      !difficulty && topicId ? await suggestDifficulty(topicId) : null;

    roundOptions = {
      count: Number.isFinite(countParam) && countParam > 0 ? Math.min(countParam, 30) : QUIZ_DEFAULTS.questionCount,
      ...(topicId ? { topicId } : {}),
      ...(difficulty ?? adaptiveDifficulty ? { difficulty: (difficulty ?? adaptiveDifficulty)! } : {}),
    };

    topicLabel = topicId ? ((await getTopic(topicId))?.title ?? 'Computer Networks') : 'Mixed topics';

    bindKeys();
    await startRound();
  },

  unmount() {
    stopTimer();
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    // Leaving mid-round closes it cleanly rather than leaving a dangling engine.
    engine?.abandon();
    engine = null;
  },
};

export default quizPage;
