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
  /** Accent used for this mode's card. Kept inside the palette so six cards do not become a rainbow. */
  tone: 'accent' | 'xp' | 'mastered' | 'special' | 'neutral';
  /** The shape of a round, said in as few words as possible. */
  format: string;
  cta: string;
}

const GAMES: readonly GameCard[] = [
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
      <span class="cn-mode__glyph" aria-hidden="true">
        <i class="bi ${escapeHtml(game.icon)}"></i>
      </span>

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

const gamesPage: Page = {
  title: 'Games',

  render() {
    return `
      <section class="cn-games">
        <div class="cn-container" id="${ROOT_ID}">
          <header class="cn-games__head cn-rise cn-rise-1">
            <h1 class="cn-games__title">Pick your challenge</h1>
            <p class="cn-games__sub" data-role="lead">
              Six ways to practise the same syllabus. Every one earns XP and moves your mastery.
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
