/**
 * Packet Dash screen. Route: `#/games/packet-dash`.
 *
 * The page owns the clock: one requestAnimationFrame loop steps the engine, reacts to its
 * events (sound, haptics, pop-ups, HUD) and hands the snapshot to the 3D scene. The tab
 * going hidden pauses the run, so a phone call never costs a life.
 */

import type { Page } from '@/types/page';
import { PacketDashEngine, type Category, type DashEvent, type GateRow } from '@/games/packet-dash/packet-dash.engine';
import type { DashScene } from '@/games/packet-dash/packet-dash.scene';
import { finishRound, resultScreenHtml, savingHtml } from '@/games/shared/game-shell';
import { enterSession, exitSession, gameHudHtml, setHudLives, setHudStreak } from '@/games/shared/game-hud';
import { playCue } from '@/services/sound';
import { escapeHtml, qs } from '@/utils/dom';
import '@/styles/games.css';
import '@/styles/arena.css';
import '@/styles/packet-dash.css';

const ROOT_ID = 'cn-dash-root';
const AGAIN_ID = 'cn-dash-again';
const BEST_KEY = 'cn-quest.packet-dash.best';
const MAX_FRAME_SECONDS = 0.05;
const SWIPE_MIN_PX = 28;
const TAP_MAX_MOVE_PX = 12;
const GAME_OVER_HOLD_MS = 1400;
const COUNTDOWN_STEP_MS = 650;

const MISSION_COPY: Record<Category, { chip: string; hint: string }> = {
  port: { chip: 'Port', hint: 'Fly through its port number' },
  layer: { chip: 'OSI layer', hint: 'Fly through its layer' },
  subnet: { chip: 'Subnet', hint: 'Fly through the subnet that holds it' },
};

const UNLOCK_COPY: Record<Category, string> = {
  port: '',
  layer: 'New gates: OSI layers',
  subnet: 'New gates: subnets',
};

type Phase = 'menu' | 'countdown' | 'running' | 'paused' | 'over';

let engine: PacketDashEngine | null = null;
let scene: DashScene | null = null;
let phase: Phase = 'menu';
let rafId = 0;
let lastFrame = 0;
let shownRowId = -1;
let shownPoints = -1;
let shownBits = -1;
let shownMultiplier = -1;
let shownShield: boolean | null = null;
let countdownTimer = 0;
let pointerStart: { x: number; y: number } | null = null;

function root(): HTMLElement | null {
  return qs(`#${ROOT_ID}`);
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0; // private mode or blocked storage: no best score, game still works
  }
}

function writeBest(points: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(points));
  } catch {
    // Not worth interrupting the results screen over.
  }
}

// ---------------------------------------------------------------- markup

function shellHtml(): string {
  return `
    ${gameHudHtml({ mode: 'Packet Dash', lives: { remaining: 3, total: 3 }, streak: 0 })}
    <div class="cn-dash" id="cn-dash-stage">
      <div class="cn-dash__hud" aria-hidden="true">
        <div class="cn-dash__score">
          <span class="cn-dash__cap">Score</span>
          <b id="cn-dash-points">0</b>
          <span class="cn-dash__mult" id="cn-dash-mult" data-level="1">×1</span>
        </div>
        <div class="cn-dash__mission" id="cn-dash-mission" hidden>
          <span class="cn-dash__chip" data-role="chip"></span>
          <b data-role="prompt"></b>
          <small data-role="hint"></small>
        </div>
        <div class="cn-dash__side">
          <span class="cn-dash__bits"><i class="bi bi-gem"></i><b id="cn-dash-bits">0</b></span>
          <span class="cn-dash__shield" id="cn-dash-shield" hidden><i class="bi bi-shield-fill-check"></i></span>
        </div>
      </div>
      <button type="button" class="cn-dash__pause" id="cn-dash-pause" aria-label="Pause" hidden>
        <i class="bi bi-pause-fill" aria-hidden="true"></i>
      </button>
      <p class="visually-hidden" id="cn-dash-live" aria-live="polite"></p>
      <div class="cn-dash__pops" id="cn-dash-pops" aria-hidden="true"></div>
      <div class="cn-dash__flash" id="cn-dash-flash" aria-hidden="true"></div>
      <div class="cn-dash__overlay" id="cn-dash-overlay"></div>
    </div>
  `;
}

function menuHtml(): string {
  const best = readBest();
  return `
    <div class="cn-dash__card cn-dash__card--menu">
      <p class="cn-dash__eyebrow">Arcade · endless</p>
      <h1 class="cn-dash__logo">Packet<span>Dash</span></h1>
      <p class="cn-dash__tagline">Your packet is on the wire. Hit the right gates, dodge the firewalls, don't drop the connection.</p>
      <ul class="cn-dash__how">
        <li><i class="bi bi-arrow-left-right" aria-hidden="true"></i><span><b>Swipe or tap</b> left / right · <kbd>←</kbd><kbd>→</kbd></span></li>
        <li><i class="bi bi-door-open" aria-hidden="true"></i><span><b>Fly through</b> the gate that answers the prompt</span></li>
        <li><i class="bi bi-bricks" aria-hidden="true"></i><span><b>Dodge</b> firewalls · grab <i class="bi bi-gem"></i> bits and <i class="bi bi-shield-fill-check"></i> shields</span></li>
      </ul>
      <button type="button" class="btn btn-cn-primary cn-dash__go" id="cn-dash-start">
        <i class="bi bi-play-fill" aria-hidden="true"></i> Start run
      </button>
      ${best > 0 ? `<p class="cn-dash__best">Best <b>${best.toLocaleString()}</b></p>` : ''}
    </div>
  `;
}

function pausedHtml(): string {
  return `
    <div class="cn-dash__card">
      <h2 class="cn-dash__title">Paused</h2>
      <button type="button" class="btn btn-cn-primary cn-dash__go" id="cn-dash-resume">
        <i class="bi bi-play-fill" aria-hidden="true"></i> Resume
      </button>
      <a class="cn-dash__quit" href="#/games">Quit run</a>
    </div>
  `;
}

function noWebGlHtml(): string {
  return `
    <div class="cn-dash__card">
      <h2 class="cn-dash__title">3D graphics are off</h2>
      <p class="cn-dash__tagline">Packet Dash needs WebGL 2, which this browser has disabled or doesn't support.
        Try an up-to-date Chrome, Edge, Firefox or Safari — or play Packet Runner, which works without it.</p>
      <a class="btn btn-cn-primary" href="#/games/packet-runner">Play Packet Runner</a>
      <a class="cn-dash__quit" href="#/games">Back to games</a>
    </div>
  `;
}

function setOverlay(html: string): void {
  const overlay = qs('#cn-dash-overlay');
  if (!overlay) return;
  overlay.innerHTML = html;
  overlay.hidden = html === '';
}

// ---------------------------------------------------------------- feedback

function pop(text: string, tone: 'good' | 'bad' | 'info' | 'gold', big = false): void {
  const layer = qs('#cn-dash-pops');
  if (!layer) return;
  const el = document.createElement('div');
  el.className = `cn-dash__pop${big ? ' cn-dash__pop--big' : ''}`;
  el.dataset.tone = tone;
  el.textContent = text;
  layer.appendChild(el);
  // A timer, not animationend: it also cleans up when animations are off.
  window.setTimeout(() => el.remove(), 1900);
  while (layer.children.length > 3) layer.firstElementChild?.remove();
}

function announce(text: string): void {
  const live = qs('#cn-dash-live');
  if (live) live.textContent = text;
}

function flash(tone: 'bad' | 'good'): void {
  const el = qs<HTMLElement>('#cn-dash-flash');
  if (!el || reducedMotion()) return;
  el.dataset.tone = tone;
  el.classList.remove('is-on');
  void el.offsetWidth; // restart the animation
  el.classList.add('is-on');
}

function buzz(ms: number): void {
  navigator.vibrate?.(ms);
}

function handleEvents(events: readonly DashEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      case 'gate':
        if (event.isCorrect) {
          playCue('correct');
          pop(`+${event.points}${event.multiplier > 1 ? `  ×${event.multiplier}` : ''}`, 'good', event.multiplier > 1);
          flash('good');
          announce(`Correct. ${event.row.question.explanation}`);
        } else {
          playCue('wrong');
          buzz(80);
          flash('bad');
          pop(event.row.question.explanation, 'bad');
          announce(`Wrong gate. ${event.row.question.explanation}`);
        }
        break;
      case 'firewall':
        playCue('wrong');
        buzz(120);
        flash('bad');
        pop('Firewall!', 'bad', true);
        announce('Hit a firewall. Lost a life.');
        break;
      case 'shield-saved':
        buzz(40);
        pop('Shield absorbed it', 'info');
        break;
      case 'shield-pickup':
        playCue('achievement');
        pop('Shield up', 'info');
        break;
      case 'unlock':
        pop(UNLOCK_COPY[event.category], 'gold', true);
        break;
      case 'bit':
      case 'over':
        break;
    }
  }
}

function renderMission(row: GateRow | null): void {
  const el = qs<HTMLElement>('#cn-dash-mission');
  if (!el) return;
  if (!row) {
    el.hidden = true;
    return;
  }
  const copy = MISSION_COPY[row.question.category];
  el.hidden = false;
  el.dataset.category = row.question.category;
  qs('[data-role="chip"]', el)!.textContent = copy.chip;
  qs('[data-role="prompt"]', el)!.textContent = row.question.prompt;
  qs('[data-role="hint"]', el)!.textContent = copy.hint;
  // Re-trigger the slide-in for each new prompt.
  el.classList.remove('is-new');
  void el.offsetWidth;
  el.classList.add('is-new');
}

function syncHud(): void {
  if (!engine) return;
  const snap = engine.snapshot();

  if (snap.points !== shownPoints) {
    shownPoints = snap.points;
    qs('#cn-dash-points')!.textContent = snap.points.toLocaleString();
  }
  if (snap.bits !== shownBits) {
    shownBits = snap.bits;
    qs('#cn-dash-bits')!.textContent = String(snap.bits);
  }
  if (snap.multiplier !== shownMultiplier) {
    shownMultiplier = snap.multiplier;
    const mult = qs<HTMLElement>('#cn-dash-mult')!;
    mult.textContent = `×${snap.multiplier}`;
    mult.dataset.level = String(snap.multiplier);
    setHudStreak(snap.combo);
  }
  if (snap.hasShield !== shownShield) {
    shownShield = snap.hasShield;
    qs<HTMLElement>('#cn-dash-shield')!.hidden = !snap.hasShield;
  }
  const rowId = snap.nextRow?.id ?? -1;
  if (rowId !== shownRowId) {
    shownRowId = rowId;
    renderMission(snap.nextRow);
    setHudStreak(snap.combo);
    setHudLives(snap.lives, 3);
  }
}

// ---------------------------------------------------------------- loop

function frame(now: number): void {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min(MAX_FRAME_SECONDS, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  if (!engine) return;

  const events = phase === 'running' || phase === 'menu' || phase === 'countdown' ? engine.step(dt) : [];
  if (events.length) handleEvents(events);
  if (phase === 'running') syncHud();
  scene?.update(engine.snapshot(), events, phase === 'paused' ? 0 : dt);

  if (events.some((e) => e.type === 'over')) gameOver();
}

function startLoop(): void {
  cancelAnimationFrame(rafId);
  lastFrame = performance.now();
  rafId = requestAnimationFrame(frame);
}

function stopLoop(): void {
  cancelAnimationFrame(rafId);
  rafId = 0;
}

// ---------------------------------------------------------------- phases

function showMenu(): void {
  phase = 'menu';
  setOverlay(menuHtml());
  qs<HTMLButtonElement>('#cn-dash-start')?.addEventListener('click', beginCountdown);
  qs<HTMLButtonElement>('#cn-dash-start')?.focus();
}

function beginCountdown(): void {
  if (phase !== 'menu') return;
  phase = 'countdown';
  let n = 3;
  const tick = (): void => {
    if (phase !== 'countdown') return;
    if (n === 0) {
      setOverlay('');
      phase = 'running';
      engine?.start();
      qs<HTMLElement>('#cn-dash-pause')!.hidden = false;
      qs<HTMLElement>('#cn-dash-stage')?.focus({ preventScroll: true });
      return;
    }
    setOverlay(`<div class="cn-dash__count" aria-live="assertive">${n}</div>`);
    n -= 1;
    countdownTimer = window.setTimeout(tick, COUNTDOWN_STEP_MS);
  };
  tick();
}

function pause(): void {
  if (phase !== 'running') return;
  phase = 'paused';
  setOverlay(pausedHtml());
  const resume = qs<HTMLButtonElement>('#cn-dash-resume');
  resume?.addEventListener('click', resumeRun);
  resume?.focus();
}

function resumeRun(): void {
  if (phase !== 'paused') return;
  setOverlay('');
  phase = 'running';
  lastFrame = performance.now();
  qs<HTMLElement>('#cn-dash-stage')?.focus({ preventScroll: true });
}

function gameOver(): void {
  phase = 'over';
  playCue('defeat');
  buzz(250);
  qs<HTMLElement>('#cn-dash-pause')!.hidden = true;
  const points = engine?.stats().points ?? 0;
  setOverlay(`
    <div class="cn-dash__card cn-dash__card--over">
      <p class="cn-dash__eyebrow">Connection lost</p>
      <p class="cn-dash__final">${points.toLocaleString()}</p>
    </div>`);
  window.setTimeout(() => void finish(), GAME_OVER_HOLD_MS);
}

async function finish(): Promise<void> {
  const container = root();
  if (!container || !engine) return;
  const finished = engine;
  stopLoop();
  disposeScene();

  const stats = finished.stats();
  const previousBest = readBest();
  const isNewBest = stats.points > previousBest;
  if (isNewBest) writeBest(stats.points);

  const summary = finished.summary();
  const breakdown = finished.xpBreakdown();
  container.innerHTML = savingHtml();
  const processed = await finishRound(summary);
  if (root() !== container) return;

  const missed = finished.missedGates();
  const review = missed.length
    ? `<section class="cn-dash-review mt-4">
         <p class="cn-result__section">Gates you missed</p>
         ${missed
           .map(
             (m) => `<p class="cn-dash-review__item"><b>${escapeHtml(m.prompt)}</b>
               you took <s>${escapeHtml(m.chosen)}</s>, right was <span>${escapeHtml(m.answer)}</span></p>`,
           )
           .join('')}
       </section>`
    : '';

  container.innerHTML = `<div class="cn-container">
    ${resultScreenHtml(
      processed,
      {
        caption: isNewBest ? 'Packet Dash · new best!' : `Packet Dash · best ${Math.max(previousBest, stats.points).toLocaleString()}`,
        score: stats.points.toLocaleString(),
        scoreSuffix: ' pts',
        stats: [
          { label: 'Gates', value: `${stats.gatesCorrect} / ${stats.gatesAttempted}` },
          { label: 'Best combo', value: String(stats.bestCombo) },
          { label: 'Data bits', value: String(stats.bits) },
          { label: 'Distance', value: `${stats.distance.toLocaleString()} m` },
        ],
        xpRows: [
          { label: 'Gates + score', xp: breakdown.answerXp },
          { label: 'Accuracy bonus', xp: breakdown.accuracyBonus },
          { label: 'Combo bonus', xp: breakdown.streakBonus },
          { label: 'Perfect run', xp: breakdown.perfectBonus },
        ],
        extraHtml: review,
      },
      AGAIN_ID,
    )}
  </div>`;
  qs<HTMLButtonElement>(`#${AGAIN_ID}`, container)?.addEventListener('click', () => void boot());
}

// ---------------------------------------------------------------- input

function steer(direction: -1 | 1): void {
  if (phase === 'running') engine?.steer(direction);
}

function onKey(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key;
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
    event.preventDefault();
    steer(-1);
  } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
    event.preventDefault();
    steer(1);
  } else if (key === 'Escape' || key === 'p' || key === 'P') {
    if (phase === 'running') pause();
    else if (phase === 'paused') resumeRun();
  }
}

function onPointerDown(event: PointerEvent): void {
  if ((event.target as Element).closest('button, a')) return;
  pointerStart = { x: event.clientX, y: event.clientY };
}

function onPointerUp(event: PointerEvent): void {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
    steer(dx < 0 ? -1 : 1);
    return;
  }
  if (Math.hypot(dx, dy) <= TAP_MAX_MOVE_PX) {
    // A tap steers toward the side of the screen it landed on.
    const stage = event.currentTarget as HTMLElement;
    const rect = stage.getBoundingClientRect();
    steer(event.clientX < rect.left + rect.width / 2 ? -1 : 1);
  }
}

function onVisibility(): void {
  if (document.hidden) {
    pause();
    stopLoop();
  } else if (engine && phase !== 'over') {
    startLoop();
  }
}

// ---------------------------------------------------------------- lifecycle

function disposeScene(): void {
  scene?.dispose();
  scene = null;
}

async function boot(): Promise<void> {
  const container = root();
  if (!container) return;
  stopLoop();
  disposeScene();
  window.clearTimeout(countdownTimer);

  engine = new PacketDashEngine();
  shownRowId = shownPoints = shownBits = shownMultiplier = -1;
  shownShield = null;
  container.innerHTML = shellHtml();

  const stage = qs<HTMLElement>('#cn-dash-stage')!;
  stage.tabIndex = -1;
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointerup', onPointerUp);
  qs('#cn-dash-pause')?.addEventListener('click', pause);

  try {
    const { createDashScene } = await import('@/games/packet-dash/packet-dash.scene');
    if (!engine || !document.contains(stage)) return;
    scene = createDashScene(stage, { reducedMotion: reducedMotion() });
  } catch (error) {
    console.warn('[packet-dash] WebGL unavailable', error);
    setOverlay(noWebGlHtml());
    return;
  }

  showMenu();
  startLoop();
}

const packetDashPage: Page = {
  title: 'Packet Dash',

  render() {
    return `<section id="${ROOT_ID}" class="cn-dash-root"></section>`;
  },

  mount() {
    enterSession();
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    void boot();
  },

  unmount() {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    window.clearTimeout(countdownTimer);
    stopLoop();
    disposeScene();
    exitSession();
    engine = null;
    phase = 'menu';
  },
};

export default packetDashPage;
