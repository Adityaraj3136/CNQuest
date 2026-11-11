/**
 * Games hub — the seven modes.
 * Quiz Blitz is playable from Phase 4; the rest unlock in Phase 7 and say so plainly.
 */

import type { Page, PageContext } from '@/types/page';
import { getTopic } from '@/services/content.service';
import { escapeHtml, qs } from '@/utils/dom';
import '@/styles/games.css';
import '@/styles/game-attract.css';

const ROOT_ID = 'cn-games-root';

interface GameCard {
  icon: string;
  title: string;
  description: string;
  /** Route to launch, or null while the mode is still to come. */
  href: string | null;
  note: string;
  /** Accent used for this mode's card. Kept inside the palette so six cards do not become a rainbow. */
  tone: 'accent' | 'xp' | 'mastered' | 'special' | 'neutral';
  /** The shape of a round, said in as few words as possible. */
  format: string;
  cta: string;
}

const GAMES: readonly GameCard[] = [
  {
    icon: 'bi-send',
    title: 'Packet Runner',
    description: 'Steer a packet through a 3D network. Read each routing table; the longest prefix wins.',
    href: '#/games/packet-runner',
    note: 'New · 3D',
    tone: 'accent',
    format: '3D · 5–7 routers · TTL lives',
    cta: 'Launch',
  },
  {
    icon: 'bi-lightning-charge',
    title: 'Quiz Blitz',
    description: '10 questions, 20 seconds each, instant feedback and explanations.',
    href: '#/games/quiz',
    note: 'Ready to play',
    tone: 'accent',
    format: '10 questions · 20s each',
    cta: 'Play',
  },
  {
    icon: 'bi-stopwatch',
    title: 'Rapid Fire',
    description: 'Sixty seconds. Answer as many as you can and keep the streak alive.',
    href: '#/games/rapid-fire',
    note: '60 seconds',
    tone: 'xp',
    format: '60 seconds · unlimited',
    cta: 'Start clock',
  },
  {
    icon: 'bi-shield-shaded',
    title: 'Boss Battle',
    description: 'Fight the OSI Guardian, Subnet Overlord and Firewall Guardian.',
    href: '#/games/boss',
    note: 'HP duel',
    tone: 'special',
    format: '3 bosses · HP duel',
    cta: 'Choose boss',
  },
  {
    icon: 'bi-puzzle',
    title: 'Match & Pair',
    description: 'Pair protocols with ports, devices with layers, terms with definitions.',
    href: '#/games/matching',
    note: 'Tap to pair',
    tone: 'mastered',
    format: 'Pair the columns',
    cta: 'Play',
  },
  {
    icon: 'bi-question-diamond',
    title: 'Network Riddles',
    description: 'Name the protocol or device from a clue. Hints cost you XP.',
    href: '#/games/riddles',
    note: '5 riddles',
    tone: 'neutral',
    format: '5 riddles · hints cost XP',
    cta: 'Play',
  },
  {
    icon: 'bi-grid-3x3',
    title: 'Word Search',
    description: 'Find networking vocabulary hidden in a generated grid.',
    href: '#/games/word-search',
    note: 'Generated grid',
    tone: 'neutral',
    format: 'Generated grid · 3 sizes',
    cta: 'Play',
  },
];

function cardHtml(game: GameCard, topicQuery: string): string {
  const locked = game.href === null;
  const href = locked ? '' : `${game.href}${topicQuery}`;

  return `
    <article class="cn-mode ${locked ? 'cn-mode--locked' : ''}" data-tone="${game.tone}">
      ${modeVisualHtml(game.title, game.icon)}

      <h2 class="cn-mode__name">${escapeHtml(game.title)}</h2>
      <p class="cn-mode__format">${escapeHtml(game.format)}</p>
      <p class="cn-mode__desc">${escapeHtml(game.description)}</p>

      <span class="cn-mode__action">
        ${
          locked
            ? `<span class="cn-chip">${escapeHtml(game.note)}</span>`
            : `<a class="btn btn-cn-primary btn-sm" href="${escapeHtml(href)}">${escapeHtml(game.cta)}</a>`
        }
      </span>
    </article>
  `;
}

function modeVisualHtml(title: string, icon: string): string {
  if (title === 'Packet Runner') {
    return `<div class="cn-mode__visual cn-mode__visual--packet" aria-hidden="true">
      <svg viewBox="0 0 240 140" preserveAspectRatio="xMidYMid meet">
        <path d="M30 110 L120 70 M120 70 L60 20 M120 70 L120 15 M120 70 L210 25" />
        <circle cx="30" cy="110" r="7" /><circle cx="120" cy="70" r="9" />
        <circle cx="60" cy="20" r="7" /><circle cx="120" cy="15" r="7" /><circle cx="210" cy="25" r="7" />
        <circle class="cn-mode__packet-dot" cx="30" cy="110" r="5" />
      </svg>
      <small>10.1.2.5 → /24 wins</small>
    </div>`;
  }
  if (title === 'Quiz Blitz') {
    return `<div class="cn-mode__visual cn-mode__visual--quiz" aria-hidden="true">
      <span class="cn-mode__visual-icon"><i class="bi ${escapeHtml(icon)}"></i></span>
      <div class="cn-mode__quiz-question"><b>Which layer routes packets?</b><span>A</span><span>B</span><span class="is-answer">C</span><span>D</span></div>
    </div>`;
  }
  if (title === 'Rapid Fire') {
    return `<div class="cn-mode__visual cn-mode__visual--rapid" aria-hidden="true">
      <span class="cn-mode__timer">00:42</span><span class="cn-mode__pulse">Next packet incoming</span>
    </div>`;
  }
  if (title === 'Boss Battle') {
    return `<div class="cn-mode__visual cn-mode__visual--boss" aria-hidden="true">
      <i class="bi bi-shield-shaded"></i><span>OSI Guardian</span><div><b></b></div><small>Boss HP</small>
    </div>`;
  }
  if (title === 'Match & Pair') {
    return `<div class="cn-mode__visual cn-mode__visual--match" aria-hidden="true">
      <span>HTTPS</span><i></i><i></i><span>443</span><span>DNS</span><i></i><i></i><span>53</span>
    </div>`;
  }
  if (title === 'Network Riddles') {
    return `<div class="cn-mode__visual cn-mode__visual--riddle" aria-hidden="true">
      <span>&gt; identify protocol</span><b>I translate names into addresses</b>
    </div>`;
  }
  return `<div class="cn-mode__visual cn-mode__visual--words" aria-hidden="true">
    ${'TCPIPROUTERDNS'.split('').slice(0, 12).map((letter, index) => `<span style="--i:${index}"${[0, 5, 10].includes(index) ? ' class="is-found"' : ''}>${letter}</span>`).join('')}
  </div>`;
}

const gamesPage: Page = {
  title: 'Games',

  render() {
    return `
      <section class="cn-games">
        <div class="cn-container" id="${ROOT_ID}">
          <header class="cn-games__head cn-rise cn-rise-1">
            <h1 class="cn-games__title">Choose a game mode</h1>
            <p class="cn-games__sub" data-role="lead">
              Seven ways to practise the same syllabus. Every one earns XP and moves your mastery.
            </p>
          </header>
          <div class="cn-mode-grid cn-rise cn-rise-2" data-role="grid"></div>
        </div>
      </section>
    `;
  },

  async mount(ctx: PageContext) {
    const topicId = ctx.query.get('topic');
    const topicQuery = topicId ? `?topic=${encodeURIComponent(topicId)}` : '';

    const grid = qs('[data-role="grid"]');
    if (grid) grid.innerHTML = GAMES.map((game) => cardHtml(game, topicQuery)).join('');

    if (!topicId) return;

    const topic = await getTopic(topicId);
    const lead = qs('[data-role="lead"]');
    if (topic && lead) {
      lead.textContent = `Practising “${topic.title}”. Every mode below will draw from this topic.`;
    }
  },
};

export default gamesPage;
