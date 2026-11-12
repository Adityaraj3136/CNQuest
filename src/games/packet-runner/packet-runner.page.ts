/**
 * Packet Runner screen — 3D view on top (or left), routing table and interface buttons below
 * (or right). Route: `#/games/packet-runner`, optional `?difficulty=easy|medium|hard`.
 *
 * The 3D scene is a lazily imported chunk. If WebGL is missing or the chunk fails, the run
 * still plays from the panel alone: every fact the scene shows is also in the DOM.
 */

import type { Page, PageContext } from '@/types/page';
import type { Difficulty } from '@/models/content';
import { DIFFICULTIES } from '@/models/content';
import {
  PacketRunnerEngine,
  cidrToString,
  generateRun,
  ipToString,
  type HopDecision,
} from '@/games/packet-runner/packet-runner.engine';
import type { PacketScene } from '@/games/packet-runner/packet-runner.scene';
import { finishRound, resultScreenHtml, savingHtml } from '@/games/shared/game-shell';
import {
  enterSession,
  exitSession,
  flyXp,
  gameHudHtml,
  setHudProgress,
  setHudStreak,
  setHudXp,
} from '@/games/shared/game-hud';
import { playCue } from '@/services/sound';
import { startAdaptiveSession, type AdaptiveSession } from '@/services/adaptive';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import '@/styles/games.css';
import '@/styles/arena.css';
import '@/styles/packet-runner.css';

const ROOT_ID = 'cn-pr-root';
const AGAIN_ID = 'cn-pr-again';
/** Same palette in the 3D links and the DOM chips, so "the pink one" means one thing. */
const IFACE_COLORS: Record<string, string> = {
  eth0: '#22d3ee',
  eth1: '#f472b6',
  eth2: '#facc15',
  eth3: '#4ade80',
};
const DIFFICULTY_COPY: Record<Difficulty, string> = {
  easy: '5 routers · one route matches',
  medium: '6 routers · overlapping routes, longest prefix wins',
  hard: '7 routers · odd prefixes and a default route',
};

let engine: PacketRunnerEngine | null = null;
let scene: PacketScene | null = null;
let difficulty: Difficulty = 'easy';
/** Skill estimate for routing; recommends a level on the intro and hears every hop. */
let adaptive: AdaptiveSession | null = null;
let busy = false;
let runXp = 0;
/** Interfaces already proven wrong at the current router. */
let ruledOut = new Set<string>();
let lastCorrect: HopDecision | null = null;

function root(): HTMLElement | null {
  return qs(`#${ROOT_ID}`);
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function chipHtml(iface: string): string {
  return `<span class="cn-pr__chip" style="--chip:${IFACE_COLORS[iface]}">${escapeHtml(iface)}</span>`;
}

// ---------------------------------------------------------------- intro

function introHtml(): string {
  const recommended = adaptive?.difficulty();
  return `
    ${gameHudHtml({ mode: 'Packet Runner' })}
    <div class="cn-container cn-arena cn-arena--narrow cn-pr-intro">
      <h1 class="cn-arena__title">Packet Runner</h1>
      <p class="cn-arena__brief">
        You are the router. At each hop, read the routing table and send the packet out the
        interface whose route matches its destination. When several routes match, the
        <strong>longest prefix</strong> wins.
      </p>
      <ul class="cn-pr-intro__rules">
        <li>Correct hop: TTL −1, packet moves on.</li>
        <li>Wrong hop: TTL −2, packet bounces back. TTL 0 and it is dropped.</li>
        <li>Tap a glowing branch in 3D, or use the buttons (keys 1–4).</li>
      </ul>
      <div class="cn-pr-intro__levels" role="group" aria-label="Choose difficulty">
        ${DIFFICULTIES.map(
          (level) => `
            <button type="button" class="cn-pr-level${level === recommended ? ' is-recommended' : ''}" data-level="${level}">
              <span class="cn-pr-level__name">${level}${level === recommended ? '<span class="cn-pr-level__tag">Fits you</span>' : ''}</span>
              <span class="cn-pr-level__desc">${escapeHtml(DIFFICULTY_COPY[level])}</span>
            </button>`,
        ).join('')}
      </div>
    </div>
  `;
}

function showIntro(): void {
  const container = root();
  if (!container) return;
  disposeScene();
  container.innerHTML = introHtml();
  qsa<HTMLButtonElement>('.cn-pr-level', container).forEach((button) =>
    button.addEventListener('click', () => {
      difficulty = button.dataset.level as Difficulty;
      void start();
    }),
  );
  (qs<HTMLButtonElement>('.cn-pr-level.is-recommended', container) ?? qs<HTMLButtonElement>('.cn-pr-level', container))?.focus();
}

// ---------------------------------------------------------------- run

function shellHtml(): string {
  const view = engine!.view();
  return `
    ${gameHudHtml({
      mode: 'Packet Runner',
      progress: { current: 1, total: view.totalHops, unit: 'hops' },
      streak: 0,
      xp: 0,
    })}
    <div class="cn-pr">
      <div class="cn-pr__stage" id="cn-pr-stage">
        <div class="cn-pr__overlay">
          <span class="cn-pr__dest"><i class="bi bi-envelope-paper" aria-hidden="true"></i>
            ${escapeHtml(ipToString(view.destination))}</span>
          <span class="cn-pr__ttl" id="cn-pr-ttl"></span>
        </div>
      </div>
      <aside class="cn-pr__panel" id="cn-pr-panel" aria-live="polite"></aside>
    </div>
  `;
}

function ttlHtml(): string {
  const { ttl, maxTtl } = engine!.view();
  const cells = Array.from({ length: maxTtl }, (_, i) => `<i data-on="${i < ttl}"></i>`).join('');
  const low = ttl <= 2 ? ' data-low="true"' : '';
  return `<span class="cn-pr__ttl-label"${low}>TTL ${ttl}</span><span class="cn-pr__ttl-bar" aria-hidden="true">${cells}</span>`;
}

function panelHtml(feedback: HopDecision | null): string {
  const view = engine!.view();
  const waiting = view.status === 'choosing';

  const rows = view.hop.table
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(cidrToString(entry))}</td>
          <td>${chipHtml(entry.iface)}</td>
        </tr>`,
    )
    .join('');

  const buttons = view.hop.interfaces
    .map((iface, index) => {
      const out = ruledOut.has(iface);
      return `
        <button type="button" class="cn-pr__iface" data-iface="${iface}" style="--chip:${IFACE_COLORS[iface]}"
          ${!waiting || out ? 'disabled' : ''} ${out ? 'data-out="true"' : ''}>
          <kbd aria-hidden="true">${index + 1}</kbd>${escapeHtml(iface)}
        </button>`;
    })
    .join('');

  const result = feedback
    ? `<div class="cn-feedback cn-pr__feedback" data-correct="${feedback.isCorrect}">
         <p class="cn-feedback__title">${feedback.isCorrect ? '✓ Packet delivered to next hop' : '✗ Misrouted'}
           ${feedback.isCorrect ? `<span class="cn-feedback__xp">+${feedback.xpEarned} XP</span>` : ''}</p>
         <p>${escapeHtml(feedback.explanation)}</p>
         ${
           feedback.isCorrect
             ? ''
             : `<button type="button" class="btn btn-cn-primary btn-sm" id="cn-pr-continue">${view.ttl > 0 ? 'Try again' : 'See result'}</button>`
         }
       </div>`
    : lastCorrect
      ? `<p class="cn-pr__last">Last hop: ${escapeHtml(lastCorrect.explanation)}</p>`
      : '';

  // A misroute explanation goes first: on a phone it then sits right under the 3D view instead
  // of below the fold. The quiet "last hop" note stays at the bottom.
  const misroute = feedback && !feedback.isCorrect ? result : '';
  const footnote = misroute ? '' : result;

  return `
    ${misroute}
    <p class="cn-label">Router ${escapeHtml(view.hop.name)} · routing table</p>
    <div class="cn-pr__table-wrap">
      <table class="cn-pr__table">
        <thead><tr><th scope="col">Destination network</th><th scope="col">Interface</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="cn-pr__ask">Forward <strong>${escapeHtml(ipToString(view.destination))}</strong> out of:</p>
    <div class="cn-pr__ifaces" role="group" aria-label="Outgoing interface">${buttons}</div>
    ${footnote}
  `;
}

function paintPanel(feedback: HopDecision | null = null): void {
  const panel = qs('#cn-pr-panel');
  const ttl = qs('#cn-pr-ttl');
  if (!panel || !engine) return;
  panel.innerHTML = panelHtml(feedback);
  if (ttl) ttl.innerHTML = ttlHtml();

  qsa<HTMLButtonElement>('.cn-pr__iface', panel).forEach((button) =>
    button.addEventListener('click', () => void choose(button.dataset.iface!)),
  );
  const retry = qs<HTMLButtonElement>('#cn-pr-continue', panel);
  retry?.addEventListener('click', () => void advance());
  retry?.focus({ preventScroll: true });
}

/** Green or red pulse around the 3D view, so the verdict lands where the eyes are. */
function flashStage(isCorrect: boolean): void {
  const stage = qs<HTMLElement>('#cn-pr-stage');
  if (!stage || reducedMotion()) return;
  stage.dataset.flash = isCorrect ? 'good' : 'bad';
  stage.classList.remove('is-flashing');
  void stage.offsetWidth; // restart the animation
  stage.classList.add('is-flashing');
}

async function choose(iface: string): Promise<void> {
  if (!engine || busy || ruledOut.has(iface)) return;
  const view = engine.view();
  const decision = engine.choose(iface);
  if (!decision) return;
  adaptive?.record(difficulty, decision.isCorrect);

  busy = true;
  playCue(decision.isCorrect ? 'correct' : 'wrong');
  flashStage(decision.isCorrect);
  flyXp(decision.xpEarned, qs<HTMLElement>(`.cn-pr__iface[data-iface="${iface}"]`));
  runXp += decision.xpEarned;
  setHudXp(runXp);
  setHudStreak(engine.view().currentStreak);
  paintPanel(); // lock the buttons and show the new TTL while the packet travels

  const lastHop = view.hopIndex === view.totalHops - 1;
  const outcome = decision.isCorrect ? (lastHop ? 'deliver' : 'forward') : 'bounce';
  await scene?.sendPacket(iface, outcome);
  if (!engine) return; // left the screen mid-animation

  if (decision.isCorrect) {
    lastCorrect = decision;
    await advance();
  } else {
    ruledOut.add(iface);
    paintPanel(decision);
    busy = false;
  }
}

async function advance(): Promise<void> {
  if (!engine) return;
  const before = engine.view().hopIndex;
  const status = engine.next();
  busy = false;

  if (status === 'delivered' || status === 'expired') {
    await finish();
    return;
  }

  const view = engine.view();
  if (view.hopIndex !== before) {
    ruledOut = new Set();
    scene?.showHop(view.hop.name, view.hop.interfaces);
    setHudProgress(view.hopIndex + 1, view.totalHops);
  }
  paintPanel();
  qs<HTMLButtonElement>('.cn-pr__iface:not([disabled])')?.focus({ preventScroll: true });
}

async function mountScene(): Promise<void> {
  const stage = qs('#cn-pr-stage');
  if (!stage || !engine) return;
  try {
    const { createPacketScene } = await import('@/games/packet-runner/packet-runner.scene');
    if (!engine || !document.contains(stage)) return;
    scene = createPacketScene(stage, {
      colors: IFACE_COLORS,
      reducedMotion: reducedMotion(),
      onPick: (iface) => void choose(iface),
    });
    const view = engine.view();
    scene.showHop(view.hop.name, view.hop.interfaces);
  } catch (error) {
    // No WebGL (old device, disabled GPU, some in-app browsers) — the panel alone is the game.
    console.warn('[packet-runner] 3D view unavailable, playing in panel mode', error);
    stage.dataset.fallback = 'true';
    stage.insertAdjacentHTML(
      'beforeend',
      '<p class="cn-pr__fallback">3D view isn’t available on this device. The run plays the same from the panel.</p>',
    );
  }
}

function disposeScene(): void {
  scene?.dispose();
  scene = null;
}

async function start(): Promise<void> {
  const container = root();
  if (!container) return;
  disposeScene();
  engine = new PacketRunnerEngine(generateRun(difficulty));
  busy = false;
  runXp = 0;
  ruledOut = new Set();
  lastCorrect = null;

  container.innerHTML = shellHtml();
  paintPanel();
  await mountScene();
}

async function finish(): Promise<void> {
  const container = root();
  if (!container || !engine) return;

  const delivered = engine.isDelivered();
  playCue(delivered ? 'victory' : 'defeat');
  const summary = engine.summary();
  const breakdown = engine.xpBreakdown();
  const view = engine.view();
  disposeScene();
  container.innerHTML = savingHtml();

  const processed = await finishRound(summary);
  if (root() !== container) return;

  const { result } = summary;
  const mistakes = summary.answers.filter((a) => !a.isCorrect);
  const review = mistakes.length
    ? `<section class="cn-pr-review mt-4">
         <p class="cn-result__section">Where the packet went wrong</p>
         ${mistakes.map((m) => `<p class="cn-pr-review__item">${escapeHtml(m.explanation)}</p>`).join('')}
       </section>`
    : '';

  container.innerHTML = `<div class="cn-container">
    ${resultScreenHtml(
      processed,
      {
        caption: `Packet Runner · ${difficulty}`,
        score: '',
        verdict: delivered ? 'DELIVERED' : 'DROPPED',
        stats: [
          { label: 'Hops cleared', value: `${delivered ? view.totalHops : view.hopIndex} / ${view.totalHops}` },
          { label: 'TTL left', value: String(view.ttl) },
          { label: 'Accuracy', value: `${result.accuracy}%` },
          { label: 'Misroutes', value: String(result.wrong) },
        ],
        xpRows: [
          { label: 'Correct hops + delivery', xp: breakdown.answerXp },
          { label: 'Accuracy bonus', xp: breakdown.accuracyBonus },
          { label: 'Streak bonus', xp: breakdown.streakBonus },
          { label: 'Perfect run', xp: breakdown.perfectBonus },
        ],
        extraHtml: review,
      },
      AGAIN_ID,
    )}
  </div>`;

  qs<HTMLButtonElement>(`#${AGAIN_ID}`, container)?.addEventListener('click', () => void start());
}

function onKey(event: KeyboardEvent): void {
  if (!engine || event.ctrlKey || event.metaKey || event.altKey) return;
  const index = Number(event.key) - 1;
  const iface = engine.view().hop.interfaces[index];
  if (iface && engine.view().status === 'choosing') void choose(iface);
}

const packetRunnerPage: Page = {
  title: 'Packet Runner',

  render() {
    return `<section id="${ROOT_ID}"></section>`;
  },

  async mount(ctx: PageContext) {
    enterSession();
    document.addEventListener('keydown', onKey);
    adaptive = await startAdaptiveSession('packet-runner');
    const requested = ctx.query.get('difficulty') as Difficulty | null;
    if (requested && DIFFICULTIES.includes(requested)) {
      difficulty = requested;
      void start();
    } else {
      showIntro();
    }
  },

  unmount() {
    document.removeEventListener('keydown', onKey);
    exitSession();
    disposeScene();
    engine = null;
    adaptive = null;
  },
};

export default packetRunnerPage;
