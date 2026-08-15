/**
 * Word Search screen.
 *
 * Selection is press-and-drag with pointer events, which covers mouse, touch and pen with
 * one code path. Tapping a start cell and then an end cell also works, so the puzzle is
 * playable without dragging at all.
 */

import type { Page, PageContext } from '@/types/page';
import { WordSearchEngine } from '@/games/word-search/word-search.engine';
import { finishRound, resultScreenHtml, savingHtml } from '@/games/shared/game-shell';
import { getWordSearchSets } from '@/services/content.service';
import { lineBetween } from '@/games/word-search/word-search.generator';
import { loaderHtml, stateHtml } from '@/components/loader';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import type { Cell } from '@/games/word-search/word-search.generator';
import type { WordSearchSet } from '@/models/content';
import '@/styles/games.css';
import '@/styles/arena.css';

const ROOT_ID = 'cn-ws-root';
const AGAIN_ID = 'cn-ws-again';

let engine: WordSearchEngine | null = null;
let sets: WordSearchSet[] = [];
let activeSet: WordSearchSet | null = null;
let anchor: Cell | null = null;

function root(): HTMLElement | null {
  return qs(`#${ROOT_ID}`);
}

function cellKey(cell: Cell): string {
  return `${cell.row}-${cell.col}`;
}

function boardHtml(): string {
  const view = engine!.view();
  const found = new Set(view.foundCells.map(cellKey));

  const rows = view.grid.letters
    .map((row, r) =>
      row
        .map(
          (letter, c) => `
            <button
              type="button"
              class="cn-ws__cell"
              data-row="${r}"
              data-col="${c}"
              data-found="${found.has(`${r}-${c}`)}"
              aria-label="Row ${r + 1} column ${c + 1}, letter ${letter}"
            >${letter}</button>`,
        )
        .join(''),
    )
    .join('');

  return `
    <div class="cn-container cn-arena">
      <header class="cn-arena__head">
        <div>
          <span class="cn-label cn-label--marked">Word Search · ${escapeHtml(view.grid.size + '×' + view.grid.size)}</span>
          <h1 class="cn-arena__title">${escapeHtml(view.title)}</h1>
        </div>
        <span class="cn-arena__stats">
          <span>Found <b>${view.foundCount}/${view.totalWords}</b></span>
          <span>Misses <b>${view.misses}</b></span>
        </span>
      </header>

      <div class="cn-ws">
        <div class="cn-ws__board">
          <div class="cn-ws__grid" id="cn-ws-grid"
               style="grid-template-columns: repeat(${view.grid.size}, minmax(26px, 1fr))">
            ${rows}
          </div>
        </div>

        <aside class="cn-ws__words">
          <span class="cn-label cn-label--marked">Words</span>
          <ul>
            ${view.words
              .map(
                (entry) =>
                  `<li data-found="${entry.found}">${escapeHtml(entry.word)}</li>`,
              )
              .join('')}
          </ul>
          <p class="cn-label mt-3" id="cn-ws-hint" aria-live="polite">
            Drag across a word, or tap its first and last letter.
          </p>
          <button type="button" class="btn btn-cn-ghost btn-sm mt-2" id="cn-ws-give-up">
            Finish round
          </button>
        </aside>
      </div>
    </div>
  `;
}

function setHint(text: string): void {
  const hint = qs('#cn-ws-hint');
  if (hint) hint.textContent = text;
}

function clearPreview(): void {
  qsa('.cn-ws__cell').forEach((cell) => cell.removeAttribute('data-preview'));
}

function previewLine(from: Cell, to: Cell): void {
  clearPreview();
  const cells = lineBetween(from, to);
  if (!cells) return;
  for (const cell of cells) {
    qs(`.cn-ws__cell[data-row="${cell.row}"][data-col="${cell.col}"]`)?.setAttribute('data-preview', 'true');
  }
}

function cellFrom(target: EventTarget | null): Cell | null {
  const element = (target as HTMLElement | null)?.closest<HTMLElement>('.cn-ws__cell');
  if (!element) return null;
  return { row: Number(element.dataset.row), col: Number(element.dataset.col) };
}

function judge(from: Cell, to: Cell): void {
  const outcome = engine!.select(from, to);

  if (outcome.status === 'found') setHint(`Found ${outcome.word}.`);
  else if (outcome.status === 'already-found') setHint(`${outcome.word} is already found.`);
  else if (outcome.status === 'miss') setHint('Not a word — keep looking.');

  if (engine!.isFinished()) {
    void finish();
    return;
  }
  paintBoard();
}

function paintBoard(): void {
  const container = root();
  if (!container || !engine) return;

  container.innerHTML = boardHtml();
  const grid = qs('#cn-ws-grid', container);
  if (!grid) return;

  let dragging = false;

  grid.addEventListener('pointerdown', (event) => {
    const cell = cellFrom(event.target);
    if (!cell) return;
    event.preventDefault();

    // Second tap of a tap-tap selection.
    if (anchor && (anchor.row !== cell.row || anchor.col !== cell.col)) {
      const from = anchor;
      anchor = null;
      clearPreview();
      judge(from, cell);
      return;
    }

    dragging = true;
    anchor = cell;
    previewLine(cell, cell);
  });

  grid.addEventListener('pointermove', (event) => {
    if (!dragging || !anchor) return;
    const cell = cellFrom(document.elementFromPoint(event.clientX, event.clientY));
    if (cell) previewLine(anchor, cell);
  });

  const endDrag = (event: PointerEvent): void => {
    if (!dragging || !anchor) return;
    dragging = false;

    const cell = cellFrom(document.elementFromPoint(event.clientX, event.clientY));
    // A press without movement leaves the anchor set, turning it into a tap-tap selection.
    if (!cell || (cell.row === anchor.row && cell.col === anchor.col)) return;

    const from = anchor;
    anchor = null;
    clearPreview();
    judge(from, cell);
  };

  grid.addEventListener('pointerup', endDrag);
  grid.addEventListener('pointercancel', () => {
    dragging = false;
    anchor = null;
    clearPreview();
  });

  qs<HTMLButtonElement>('#cn-ws-give-up', container)?.addEventListener('click', () => void finish());
}

async function finish(): Promise<void> {
  const container = root();
  if (!container || !engine) return;

  engine.abandon();
  const summary = engine.summary();
  const breakdown = engine.xpBreakdown();
  const view = engine.view();
  container.innerHTML = savingHtml();

  const processed = await finishRound(summary);
  if (root() !== container) return;

  const { result } = summary;
  container.innerHTML = `<div class="cn-container">${resultScreenHtml(
    processed,
    {
      caption: `Word Search · ${activeSet?.title ?? ''}`,
      score: String(result.correct),
      scoreSuffix: `/${view.totalWords}`,
      stats: [
        { label: 'Accuracy', value: `${result.accuracy}%` },
        { label: 'Misses', value: String(result.wrong) },
        { label: 'Time', value: `${result.durationSeconds}s` },
        { label: 'Difficulty', value: String(result.difficulty ?? 'medium') },
      ],
      xpRows: [
        { label: 'Words found', xp: breakdown.answerXp },
        { label: 'Accuracy bonus', xp: breakdown.accuracyBonus },
        { label: 'Perfect grid bonus', xp: breakdown.perfectBonus },
      ],
    },
    AGAIN_ID,
  )}</div>`;

  qs<HTMLButtonElement>(`#${AGAIN_ID}`, container)?.addEventListener('click', () => void start());
}

async function start(): Promise<void> {
  const container = root();
  if (!container) return;

  container.innerHTML = `<div class="cn-container">${loaderHtml('Building the grid')}</div>`;

  if (sets.length === 0) {
    container.innerHTML = `<div class="cn-container">${stateHtml({
      icon: 'bi-grid-3x3',
      title: 'No word banks available',
      message: 'There is no word search for this topic yet. Try another topic.',
      actionLabel: 'Back to games',
      actionHref: '#/games',
    })}</div>`;
    return;
  }

  activeSet = sets[Math.floor(Math.random() * sets.length)];
  engine = new WordSearchEngine(activeSet);
  anchor = null;
  paintBoard();
}

const wordSearchPage: Page = {
  title: 'Word Search',

  render() {
    return `<section id="${ROOT_ID}">${loaderHtml('Preparing Word Search')}</section>`;
  },

  async mount(ctx: PageContext) {
    const topicId = ctx.query.get('topic') ?? undefined;
    const scoped = await getWordSearchSets(topicId);
    sets = scoped.length > 0 ? scoped : await getWordSearchSets();
    await start();
  },

  unmount() {
    engine?.abandon();
    engine = null;
    anchor = null;
  },
};

export default wordSearchPage;
