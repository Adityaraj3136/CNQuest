/**
 * Games hub — the six modes.
 * Quiz Blitz is playable from Phase 4; the rest unlock in Phase 7 and say so plainly.
 */

import type { Page, PageContext } from '@/types/page';
import { getTopic } from '@/services/content.service';
import { escapeHtml, qs } from '@/utils/dom';
import '@/styles/games.css';

const ROOT_ID = 'cn-games-root';

interface GameCard {
  icon: string;
  title: string;
  description: string;
  /** Route to launch, or null while the mode is still to come. */
  href: string | null;
  note: string;
}

const GAMES: readonly GameCard[] = [
  {
    icon: 'bi-lightning-charge',
    title: 'Quiz Blitz',
    description: '10 questions, 20 seconds each, instant feedback and explanations.',
    href: '#/games/quiz',
    note: 'Ready to play',
  },
  {
    icon: 'bi-stopwatch',
    title: 'Rapid Fire',
    description: 'Sixty seconds. Answer as many as you can and keep the streak alive.',
    href: '#/games/rapid-fire',
    note: '60 seconds',
  },
  {
    icon: 'bi-shield-shaded',
    title: 'Boss Battle',
    description: 'Fight the OSI Guardian, Subnet Overlord and Firewall Guardian.',
    href: '#/games/boss',
    note: 'HP duel',
  },
  {
    icon: 'bi-puzzle',
    title: 'Match & Pair',
    description: 'Pair protocols with ports, devices with layers, terms with definitions.',
    href: '#/games/matching',
    note: 'Tap to pair',
  },
  {
    icon: 'bi-question-diamond',
    title: 'Network Riddles',
    description: 'Name the protocol or device from a clue. Hints cost you XP.',
    href: '#/games/riddles',
    note: '5 riddles',
  },
  {
    icon: 'bi-grid-3x3',
    title: 'Word Search',
    description: 'Find networking vocabulary hidden in a generated grid.',
    href: '#/games/word-search',
    note: 'Generated grid',
  },
];

function cardHtml(game: GameCard, topicQuery: string, index: number): string {
  const locked = game.href === null;
  const href = locked ? '' : `${game.href}${topicQuery}`;

  return `
    <article class="cn-mode ${locked ? 'cn-mode--locked' : ''}">
      <span class="cn-mode__num">${String(index + 1).padStart(2, '0')}</span>
      <h2 class="cn-mode__name">
        <i class="bi ${escapeHtml(game.icon)}" aria-hidden="true"></i>
        ${escapeHtml(game.title)}
      </h2>
      <p class="cn-mode__desc">${escapeHtml(game.description)}</p>
      <span class="cn-mode__action">
        ${
          locked
            ? `<span class="cn-chip">${escapeHtml(game.note)}</span>`
            : `<a class="btn btn-cn-primary btn-sm" href="${escapeHtml(href)}">Play</a>`
        }
      </span>
    </article>
  `;
}

const gamesPage: Page = {
  title: 'Games',

  render() {
    return `
      <section class="cn-games">
        <div class="cn-container" id="${ROOT_ID}">
          <header class="cn-games__head cn-rise cn-rise-1">
            <span class="cn-label cn-label--marked">Practice</span>
            <h1 class="cn-section__title mt-2">Game modes</h1>
            <p class="cn-section__lead mt-2" data-role="lead">
              Every mode draws from the same question bank and feeds the same progress engine.
            </p>
          </header>
          <div class="cn-rise cn-rise-2" data-role="grid"></div>
        </div>
      </section>
    `;
  },

  async mount(ctx: PageContext) {
    const topicId = ctx.query.get('topic');
    const topicQuery = topicId ? `?topic=${encodeURIComponent(topicId)}` : '';

    const grid = qs('[data-role="grid"]');
    if (grid) grid.innerHTML = GAMES.map((game, index) => cardHtml(game, topicQuery, index)).join('');

    if (!topicId) return;

    const topic = await getTopic(topicId);
    const lead = qs('[data-role="lead"]');
    if (topic && lead) {
      lead.textContent = `Practising “${topic.title}”. Every mode below will draw from this topic.`;
    }
  },
};

export default gamesPage;
