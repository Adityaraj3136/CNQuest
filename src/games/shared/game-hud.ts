/**
 * The heads-up display every game session wears.
 *
 * One HUD for six modes, because the alternative is six that slowly disagree about where the
 * timer sits and what a streak looks like. Each field is optional: a word search has no
 * question counter, riddles have no timer, and showing an empty slot is worse than showing
 * nothing, so a mode declares only what it actually has.
 *
 * Values that change every second (timer, XP, streak) are updated in place rather than by
 * re-rendering the bar, so a running clock never rebuilds the DOM sixty times a minute.
 */

import { escapeHtml, qs } from '@/utils/dom';

export interface GameHudOptions {
  /** Mode name, e.g. "Quiz Blitz". */
  mode: string;
  /** Where leaving the game takes you. */
  exitHref?: string;
  /** Round position, e.g. { current: 4, total: 10 }. Omit for open-ended modes. */
  progress?: { current: number; total: number; unit?: string };
  streak?: number;
  xp?: number;
  /** Seconds remaining, when the mode is timed. */
  seconds?: number;
  /** Lives or shields, when the mode has them. */
  lives?: { remaining: number; total: number };
}

const HUD_ID = 'cn-hud';

function fieldHtml(id: string, icon: string, value: string, tone: string): string {
  return `
    <span class="cn-hud__field" data-tone="${tone}" id="${id}">
      <i class="bi ${icon}" aria-hidden="true"></i>
      <span data-role="value">${escapeHtml(value)}</span>
    </span>
  `;
}

export function gameHudHtml(options: GameHudOptions): string {
  const { mode, exitHref = '#/games', progress, streak, xp, seconds, lives } = options;

  const percent = progress && progress.total > 0
    ? Math.round(((progress.current - 1) / progress.total) * 100)
    : 0;

  return `
    <header class="cn-hud" id="${HUD_ID}">
      <div class="cn-hud__bar">
        <a class="cn-hud__exit" href="${escapeHtml(exitHref)}">
          <i class="bi bi-arrow-left" aria-hidden="true"></i>
          <span>Exit</span>
        </a>

        <span class="cn-hud__mode">${escapeHtml(mode)}</span>

        <div class="cn-hud__fields">
          ${
            progress
              ? `<span class="cn-hud__field" data-tone="neutral" id="cn-hud-progress">
                   <span data-role="value">${progress.current} / ${progress.total}</span>
                   ${progress.unit ? `<small>${escapeHtml(progress.unit)}</small>` : ''}
                 </span>`
              : ''
          }
          ${lives ? fieldHtml('cn-hud-lives', 'bi-heart-fill', `${lives.remaining}/${lives.total}`, 'danger') : ''}
          ${streak === undefined ? '' : fieldHtml('cn-hud-streak', 'bi-lightning-charge-fill', String(streak), 'streak')}
          ${xp === undefined ? '' : fieldHtml('cn-hud-xp', 'bi-star-fill', `+${xp}`, 'xp')}
          ${seconds === undefined ? '' : fieldHtml('cn-hud-timer', 'bi-clock', `${seconds}s`, 'neutral')}
        </div>
      </div>

      <div class="cn-hud__track" role="progressbar" aria-label="Round progress"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <span id="cn-hud-fill" style="width:${percent}%"></span>
      </div>
    </header>
  `;
}

// ---------------------------------------------------------------- live updates

function setField(id: string, value: string): void {
  const field = qs(`#${id} [data-role="value"]`);
  if (field) field.textContent = value;
}

export function setHudProgress(current: number, total: number): void {
  setField('cn-hud-progress', `${current} / ${total}`);

  const fill = qs<HTMLElement>('#cn-hud-fill');
  if (fill) fill.style.width = `${total > 0 ? Math.round(((current - 1) / total) * 100) : 0}%`;
}

export function setHudXp(xp: number): void {
  setField('cn-hud-xp', `+${xp}`);
}

/**
 * Updates the streak, and marks milestones so the display can react to 3, 5 and 10 without
 * every game re-implementing what counts as a milestone.
 */
export function setHudStreak(streak: number): void {
  setField('cn-hud-streak', String(streak));

  const field = qs<HTMLElement>('#cn-hud-streak');
  if (!field) return;

  field.dataset.active = String(streak >= 2);
  if ([3, 5, 10].includes(streak)) {
    // Restarting the animation requires the class to actually leave the element first.
    field.classList.remove('cn-hud__field--milestone');
    void field.offsetWidth;
    field.classList.add('cn-hud__field--milestone');
  }
}

export function setHudLives(remaining: number, total: number): void {
  setField('cn-hud-lives', `${remaining}/${total}`);
}

/** Seconds left, with an urgent state under five so the clock is felt before it is read. */
export function setHudTimer(seconds: number): void {
  setField('cn-hud-timer', `${seconds}s`);

  const field = qs<HTMLElement>('#cn-hud-timer');
  if (field) field.dataset.tone = seconds <= 5 ? 'urgent' : 'neutral';
}

/**
 * Floats an XP gain up towards the counter that is about to change.
 *
 * The number moving from where it was earned to where it is kept is what makes XP feel taken
 * rather than merely displayed. Skipped entirely under reduced motion, where a value that
 * simply updates is the correct behaviour rather than a degraded one.
 */
export function flyXp(amount: number, origin?: HTMLElement | null): void {
  if (amount <= 0) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const target = qs<HTMLElement>('#cn-hud-xp');
  if (!target) return;

  const from = (origin ?? target).getBoundingClientRect();
  const to = target.getBoundingClientRect();

  const chip = document.createElement('span');
  chip.className = 'cn-xp-fly';
  chip.textContent = `+${amount} XP`;
  chip.style.left = `${from.left + from.width / 2}px`;
  chip.style.top = `${from.top}px`;
  chip.style.setProperty('--dx', `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
  chip.style.setProperty('--dy', `${to.top - from.top}px`);

  document.body.appendChild(chip);
  chip.addEventListener('animationend', () => chip.remove(), { once: true });
}

/** Marks the document as being in a game session, which tones the page background down. */
export function enterSession(): void {
  document.body.classList.add('cn-in-session');
}

export function exitSession(): void {
  document.body.classList.remove('cn-in-session');
}
