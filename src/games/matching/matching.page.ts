/**
 * Match & Pair screen — tap a card on the left, then its partner on the right.
 * Dynamic reactive patch-bay cables, glowing energy lines, and kinetic feedback.
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
let isBusy = false;
let resizeHandler: (() => void) | null = null;

function root(): HTMLElement | null {
  return qs(`#${ROOT_ID}`);
}

function columnHtml(view: MatchingView, side: MatchSide): string {
  const cards = side === 'left' ? view.left : view.right;
  const selected = side === 'left' ? view.selectedLeft : view.selectedRight;
  const label = side === 'left' ? view.leftLabel : view.rightLabel;

  return `
    <div class="cn-match__col cn-match__col--${side}" role="group" aria-label="${escapeHtml(label)}">
      <span class="cn-match__label">${escapeHtml(label)}</span>
      ${cards
        .map(
          (card, index) => `
            <button
              type="button"
              class="cn-match__card"
              data-side="${side}"
              data-pair="${card.pairIndex}"
              data-state="${card.matched ? 'matched' : selected === card.pairIndex ? 'selected' : 'idle'}"
              style="--card-index: ${index};"
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
        <svg class="cn-match__cables" id="cn-match-cables" aria-hidden="true">
          <defs>
            <linearGradient id="cn-cable-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.95" />
              <stop offset="50%" stop-color="#39ff14" stop-opacity="1" />
              <stop offset="100%" stop-color="#00e5ff" stop-opacity="0.95" />
            </linearGradient>
          </defs>
        </svg>
        <div class="cn-match__fx-layer" id="cn-match-fx" aria-hidden="true"></div>
        ${columnHtml(view, 'left')}
        ${columnHtml(view, 'right')}
      </div>
    </div>
  `;
}

function renderCables(): void {
  const board = qs<HTMLElement>('#cn-match-board');
  const svg = qs<SVGSVGElement>('#cn-match-cables');
  if (!board || !svg || !engine) return;

  const bRect = board.getBoundingClientRect();
  if (bRect.width === 0 || bRect.height === 0) return;

  svg.setAttribute('viewBox', `0 0 ${bRect.width} ${bRect.height}`);
  svg.style.width = `${bRect.width}px`;
  svg.style.height = `${bRect.height}px`;

  const view = engine.view();
  let cablesHtml = `
    <defs>
      <linearGradient id="cn-cable-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.95" />
        <stop offset="50%" stop-color="#39ff14" stop-opacity="1" />
        <stop offset="100%" stop-color="#00e5ff" stop-opacity="0.95" />
      </linearGradient>
    </defs>
  `;

  for (let p = 0; p < view.totalPairs; p++) {
    const leftCard = qs<HTMLElement>(`button[data-side="left"][data-pair="${p}"]`, board);
    const rightCard = qs<HTMLElement>(`button[data-side="right"][data-pair="${p}"]`, board);
    if (!leftCard || !rightCard) continue;

    const isMatched = leftCard.dataset.state === 'matched';
    if (!isMatched) continue;

    const leftPort = qs<HTMLElement>('.cn-match__port', leftCard) || leftCard;
    const rightPort = qs<HTMLElement>('.cn-match__port', rightCard) || rightCard;

    const p1 = leftPort.getBoundingClientRect();
    const p2 = rightPort.getBoundingClientRect();

    const x1 = p1.left + p1.width / 2 - bRect.left;
    const y1 = p1.top + p1.height / 2 - bRect.top;
    const x2 = p2.left + p2.width / 2 - bRect.left;
    const y2 = p2.top + p2.height / 2 - bRect.top;

    let pathD = '';
    if (x2 > x1 + 30) {
      // Two-column side-by-side layout
      const dx = (x2 - x1) * 0.52;
      pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    } else {
      // Stacked layout (mobile)
      const bow = Math.max(36, Math.abs(y2 - y1) * 0.2);
      pathD = `M ${x1} ${y1} C ${x1 + bow} ${y1}, ${x2 + bow} ${y2}, ${x2} ${y2}`;
    }

    cablesHtml += `
      <g class="cn-cable-group" data-pair="${p}">
        <path d="${pathD}" class="cn-cable__glow" />
        <path d="${pathD}" class="cn-cable__core" />
        <path d="${pathD}" class="cn-cable__pulse" />
        <circle cx="${x1}" cy="${y1}" r="4" class="cn-cable__node" />
        <circle cx="${x2}" cy="${y2}" r="4" class="cn-cable__node" />
      </g>
    `;
  }

  svg.innerHTML = cablesHtml;
}

function spawnFloatingChip(text: string, x: number, y: number, type: 'matched' | 'wrong'): void {
  const fxLayer = qs<HTMLElement>('#cn-match-fx');
  if (!fxLayer) return;

  const chip = document.createElement('div');
  chip.className = `cn-match__chip cn-match__chip--${type}`;
  chip.textContent = text;
  chip.style.left = `${Math.round(x)}px`;
  chip.style.top = `${Math.round(y)}px`;
  fxLayer.appendChild(chip);

  window.setTimeout(() => {
    chip.remove();
  }, 1000);
}

function syncCardStates(): void {
  const view = engine!.view();
  const board = qs<HTMLElement>('#cn-match-board');
  if (!board) return;

  qsa<HTMLButtonElement>('.cn-match__card', board).forEach((btn) => {
    const s = btn.dataset.side as MatchSide;
    const p = Number(btn.dataset.pair);
    const cardData = s === 'left' ? view.left.find((c) => c.pairIndex === p) : view.right.find((c) => c.pairIndex === p);

    if (cardData?.matched) {
      btn.dataset.state = 'matched';
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      if (!btn.querySelector('.cn-match__tick')) {
        btn.insertAdjacentHTML('beforeend', '<i class="bi bi-check-lg cn-match__tick" aria-hidden="true"></i>');
      }
      return;
    }

    const isSelected = (s === 'left' && view.selectedLeft === p) || (s === 'right' && view.selectedRight === p);
    btn.dataset.state = isSelected ? 'selected' : 'idle';
  });
}

function setHint(text: string): void {
  const hint = qs('#cn-match-hint');
  if (hint) hint.textContent = text;
}

function triggerVictorySurge(): void {
  const board = qs<HTMLElement>('#cn-match-board');
  const svg = qs<SVGSVGElement>('#cn-match-cables');
  if (board) board.classList.add('cn-match--victory');
  if (svg) svg.classList.add('cn-cables--victory');

  setHint('⚡ ALL CIRCUITS COMPLETE! ⚡');
  playCue('victory');

  window.setTimeout(() => {
    void finish();
  }, 650);
}

function bindCardEvents(): void {
  const container = root();
  if (!container || !engine) return;

  qsa<HTMLButtonElement>('.cn-match__card', container).forEach((button) => {
    button.addEventListener('click', () => {
      if (isBusy || !engine) return;

      const side = button.dataset.side as MatchSide;
      const pair = Number(button.dataset.pair);

      // Cache other selected element before engine judges and resets
      const viewBefore = engine.view();
      const prevSelectedSide: MatchSide = side === 'left' ? 'right' : 'left';
      const prevSelectedPair = side === 'left' ? viewBefore.selectedRight : viewBefore.selectedLeft;

      const outcome = engine.select(side, pair);

      if (outcome === 'matched') {
        playCue('correct');
        const view = engine.view();

        const leftBtn = qs<HTMLButtonElement>(`button[data-side="left"][data-pair="${pair}"]`, container);
        const rightBtn = qs<HTMLButtonElement>(`button[data-side="right"][data-pair="${pair}"]`, container);

        if (leftBtn && rightBtn) {
          leftBtn.dataset.state = 'matched';
          leftBtn.disabled = true;
          leftBtn.setAttribute('aria-disabled', 'true');
          leftBtn.classList.add('is-matched-pop');

          rightBtn.dataset.state = 'matched';
          rightBtn.disabled = true;
          rightBtn.setAttribute('aria-disabled', 'true');
          rightBtn.classList.add('is-matched-pop');

          if (!leftBtn.querySelector('.cn-match__tick')) {
            leftBtn.insertAdjacentHTML('beforeend', '<i class="bi bi-check-lg cn-match__tick" aria-hidden="true"></i>');
          }
          if (!rightBtn.querySelector('.cn-match__tick')) {
            rightBtn.insertAdjacentHTML('beforeend', '<i class="bi bi-check-lg cn-match__tick" aria-hidden="true"></i>');
          }

          const board = qs<HTMLElement>('#cn-match-board');
          if (board) {
            const bRect = board.getBoundingClientRect();
            const r1 = leftBtn.getBoundingClientRect();
            const r2 = rightBtn.getBoundingClientRect();
            const midX = (r1.left + r2.right) / 2 - bRect.left;
            const midY = (r1.top + r2.top) / 2 - bRect.top;
            spawnFloatingChip('⚡ +15 XP LINKED!', midX, midY, 'matched');
          }
        }

        syncCardStates();
        renderCables();

        setHint(`Connected! ${view.matchedCount} of ${view.totalPairs} linked.`);
        setHudProgress(view.matchedCount, view.totalPairs);
        setHudStreak(view.matchedCount);

        if (engine.isFinished()) {
          isBusy = true;
          triggerVictorySurge();
        }
      } else if (outcome === 'wrong') {
        isBusy = true;
        playCue('wrong');
        button.dataset.state = 'wrong';
        button.classList.add('cn-match-shake');

        let otherBtn: HTMLButtonElement | null = null;
        if (prevSelectedPair !== null) {
          otherBtn = qs<HTMLButtonElement>(
            `button[data-side="${prevSelectedSide}"][data-pair="${prevSelectedPair}"]`,
            container,
          );
          if (otherBtn) {
            otherBtn.dataset.state = 'wrong';
            otherBtn.classList.add('cn-match-shake');
          }
        }

        const board = qs<HTMLElement>('#cn-match-board');
        if (board) {
          const bRect = board.getBoundingClientRect();
          const r1 = button.getBoundingClientRect();
          const r2 = otherBtn ? otherBtn.getBoundingClientRect() : r1;
          const midX = (r1.left + r2.right) / 2 - bRect.left;
          const midY = (r1.top + r2.top) / 2 - bRect.top;
          spawnFloatingChip('✕ MISMATCH', midX, midY, 'wrong');
        }

        setHint('Not quite. That one connects elsewhere.');

        window.setTimeout(() => {
          button.classList.remove('cn-match-shake');
          if (otherBtn) otherBtn.classList.remove('cn-match-shake');
          syncCardStates();
          renderCables();
          isBusy = false;
        }, 450);
      } else {
        // outcome === 'selected' or 'deselected'
        syncCardStates();
        renderCables();
      }
    });
  });
}

function paintBoard(): void {
  const container = root();
  if (!container || !engine) return;

  container.innerHTML = boardHtml();
  bindCardEvents();

  // Initial render of any pre-matched cables (after DOM layout pass)
  window.requestAnimationFrame(() => {
    renderCables();
  });
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
  isBusy = false;

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

    resizeHandler = () => {
      window.requestAnimationFrame(() => renderCables());
    };
    window.addEventListener('resize', resizeHandler);

    await start();
  },

  unmount() {
    exitSession();
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    engine?.abandon();
    engine = null;
  },
};

export default matchingPage;
