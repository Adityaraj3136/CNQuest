/**
 * Match & Pair screen — tap a card on the left, then its partner on the right.
 * Tap-to-match rather than drag: it works identically with a mouse, a finger and a keyboard.
 */

import type { Page, PageContext } from '@/types/page';
import { MatchingEngine } from '@/games/matching/matching.engine';
import { finishRound, resultScreenHtml, savingHtml } from '@/games/shared/game-shell';
import { playCue } from '@/services/sound';
import { getMatchingSets } from '@/services/content.service';
import { loaderHtml, stateHtml } from '@/components/loader';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import {
  enterSession,
  exitSession,
  gameHudHtml,
  setHudProgress,
  setHudStreak,
} from '@/games/shared/game-hud';
import type { MatchSide, MatchingView } from '@/games/matching/matching.engine';
import type { MatchingSet } from '@/models/content';
import '@/styles/games.css';
import '@/styles/arena.css';

const ROOT_ID = 'cn-match-root';
const AGAIN_ID = 'cn-match-again';

let engine: MatchingEngine | null = null;
let sets: MatchingSet[] = [];
let activeSet: MatchingSet | null = null;

function root(): HTMLElement | null {
  return qs(`#${ROOT_ID}`);
}

function columnHtml(view: MatchingView, side: MatchSide): string {
  const cards = side === 'left' ? view.left : view.right;
  const selected = side === 'left' ? view.selectedLeft : view.selectedRight;
  const label = side === 'left' ? view.leftLabel : view.rightLabel;

  return `
    <div class="cn-match__col" role="group" aria-label="${escapeHtml(label)}">
      <span class="cn-match__label">${escapeHtml(label)}</span>
      ${cards
        .map(
          (card) => `
            <button
              type="button"
              class="cn-match__card"
              data-side="${side}"
              data-pair="${card.pairIndex}"
              data-state="${card.matched ? 'matched' : selected === card.pairIndex ? 'selected' : 'idle'}"
              ${card.matched ? 'disabled aria-disabled="true"' : ''}
            >
              <span class="cn-match__text">${escapeHtml(card.text)}</span>
              <span class="cn-match__port" aria-hidden="true"></span>
              ${card.matched ? '<i class="bi bi-check-lg cn-match__tick" aria-hidden="true"></i>' : ''}
            </button>`,
        )
        .join('')}
    </div>
  `;
}

function boardHtml(): string {
  const view = engine!.view();

  return `
    ${gameHudHtml({
      mode: 'Match & Pair',
      progress: { current: view.matchedCount, total: view.totalPairs, unit: 'paired' },
      streak: view.matchedCount,
    })}

    <div class="cn-arena cn-arena--match">
      <h1 class="cn-arena__title">${escapeHtml(view.title)}</h1>
      <p class="cn-arena__brief" id="cn-match-hint" aria-live="polite">
        Pick one from each side to connect them.
      </p>

      <div class="cn-match" id="cn-match-board">
        ${columnHtml(view, 'left')}
        ${columnHtml(view, 'right')}
      </div>
    </div>
  `;
}

function paintBoard(): void {
  const container = root();
  if (!container || !engine) return;

  container.innerHTML = boardHtml();
  qsa<HTMLButtonElement>('.cn-match__card', container).forEach((button) => {
    button.addEventListener('click', () => {
      const side = button.dataset.side as MatchSide;
      const outcome = engine!.select(side, Number(button.dataset.pair));
      if (outcome === 'matched') playCue('correct');
      if (outcome === 'wrong') playCue('wrong');

      if (outcome === 'wrong') {
        // Show the miss briefly before the board redraws, so the mistake is legible.
        button.dataset.state = 'wrong';
        window.setTimeout(() => {
          if (engine?.isFinished()) void finish();
          else paintBoard();
        }, 420);
        setHint('Not quite. That one connects elsewhere.');
        return;
      }

      if (engine!.isFinished()) {
        void finish();
        return;
      }

      paintBoard();
      if (outcome === 'matched') {
        const view = engine!.view();
        setHint(`Connected. ${view.matchedCount} of ${view.totalPairs} linked.`);
        setHudProgress(view.matchedCount, view.totalPairs);
        setHudStreak(view.matchedCount);
      }
    });
  });
}

function setHint(text: string): void {
  const hint = qs('#cn-match-hint');
  if (hint) hint.textContent = text;
}

async function finish(): Promise<void> {
  const container = root();
  if (!container || !engine) return;

  engine.abandon();
  const summary = engine.summary();
  const breakdown = engine.xpBreakdown();
  container.innerHTML = savingHtml();

  const processed = await finishRound(summary);
  if (root() !== container) return;

  const { result } = summary;
  container.innerHTML = `<div class="cn-container">${resultScreenHtml(
    processed,
    {
      caption: `Match & Pair · ${activeSet?.title ?? ''}`,
      score: String(result.correct),
      scoreSuffix: `/${activeSet?.pairs.length ?? result.correct}`,
      stats: [
        { label: 'Accuracy', value: `${result.accuracy}%` },
        { label: 'Mistakes', value: String(result.wrong) },
        { label: 'Time', value: `${result.durationSeconds}s` },
        { label: 'Difficulty', value: String(result.difficulty ?? 'easy') },
      ],
      xpRows: [
        { label: 'Pairs matched', xp: breakdown.answerXp },
        { label: 'Accuracy bonus', xp: breakdown.accuracyBonus },
        { label: 'Streak bonus', xp: breakdown.streakBonus },
        { label: 'Perfect board bonus', xp: breakdown.perfectBonus },
      ],
    },
    AGAIN_ID,
  )}</div>`;

  qs<HTMLButtonElement>(`#${AGAIN_ID}`, container)?.addEventListener('click', () => void start());
}

async function start(): Promise<void> {
  const container = root();
  if (!container) return;

  container.innerHTML = `<div class="cn-container">${loaderHtml('Shuffling the board')}</div>`;

  if (sets.length === 0) {
    container.innerHTML = `<div class="cn-container">${stateHtml({
      icon: 'bi-puzzle',
      title: 'No matching sets available',
      message: 'There is no pairing challenge for this topic yet. Try another topic.',
      actionLabel: 'Back to games',
      actionHref: '#/games',
    })}</div>`;
    return;
  }

  // A different set each round keeps replays interesting.
  activeSet = sets[Math.floor(Math.random() * sets.length)];
  engine = new MatchingEngine(activeSet);
  paintBoard();
}

const matchingPage: Page = {
  title: 'Match & Pair',

  render() {
    return `<section id="${ROOT_ID}">${loaderHtml('Preparing Match & Pair')}</section>`;
  },

  async mount(ctx: PageContext) {
    enterSession();
    const topicId = ctx.query.get('topic') ?? undefined;
    const scoped = await getMatchingSets(topicId);
    // Fall back to the full catalogue rather than dead-ending on a topic with no set.
    sets = scoped.length > 0 ? scoped : await getMatchingSets();
    await start();
  },

  unmount() {
    exitSession();
    engine?.abandon();
    engine = null;
  },
};

export default matchingPage;
