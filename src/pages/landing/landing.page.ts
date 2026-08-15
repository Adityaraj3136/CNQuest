/**
 * Landing page.
 *
 * The job is to show the product, not describe it. The first viewport carries a real question
 * card built in the game's own visual language, with XP and a streak on it, so a visitor sees
 * what playing looks like before reading a word of prose.
 *
 * Section rhythm alternates surface so the page has shape without every block sitting on the
 * same grid.
 */

import type { Page } from '@/types/page';
import { APP, HOW_IT_WORKS } from '@/config/app.config';
import { UNITS } from '@/data/index';
import { escapeHtml, qs } from '@/utils/dom';
import { beginGuestSession } from '@/state/session';
import { showToast } from '@/components/toast';
import { navigate } from '@/router';
import '@/styles/landing.css';

const GUEST_BTN_ID = 'cn-hero-guest-btn';

/** Real figures, matching the content actually shipped in the bundle. */
const PROOF = [
  { value: '6', label: 'units' },
  { value: '17', label: 'topics' },
  { value: '6', label: 'game modes' },
  { value: '182', label: 'questions' },
  { value: '142', label: 'dictionary terms' },
] as const;

// ---------------------------------------------------------------- hero

/**
 * A real question card, in the same visual language the quiz renders.
 *
 * Showing the product beats describing it, and keeping the preview inside the product's own
 * design language means it cannot drift far from what a round actually looks like.
 */
function previewHtml(): string {
  const options = [
    { key: 'A', text: 'Switch', state: '' },
    { key: 'B', text: 'Router', state: 'correct' },
    { key: 'C', text: 'Hub', state: '' },
    { key: 'D', text: 'Repeater', state: '' },
  ];

  return `
    <div class="cn-preview cn-rise cn-rise-3" role="img"
         aria-label="A Quiz Blitz question asking which device forwards packets between networks, with Router marked correct, a three answer streak and thirty XP earned">
      <div class="cn-preview__bar">
        <span class="cn-preview__mode">Quiz Blitz</span>
        <span class="cn-preview__fields">
          <span class="cn-preview__streak"><i class="bi bi-lightning-charge-fill" aria-hidden="true"></i>3</span>
          <span class="cn-preview__xp">+30 XP</span>
        </span>
      </div>

      <div class="cn-preview__body">
        <p class="cn-preview__count">Question 3 of 10</p>
        <p class="cn-preview__q">Which device forwards packets between networks?</p>

        <div class="cn-preview__options">
          ${options
            .map(
              (option) => `
                <div class="cn-preview__option"${option.state ? ` data-state="${option.state}"` : ''}>
                  <span class="cn-preview__key">${option.key}</span>
                  <span>${escapeHtml(option.text)}</span>
                  ${option.state === 'correct' ? '<i class="bi bi-check-lg" aria-hidden="true"></i>' : ''}
                </div>`,
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}

/** The packet route, small, sitting under the preview card. */
function routeHtml(): string {
  const nodes = [
    { x: 30, label: 'Host' },
    { x: 150, label: 'Switch' },
    { x: 270, label: 'Router' },
    { x: 390, label: 'Server' },
  ];

  return `
    <svg class="cn-route" viewBox="0 0 420 70" aria-hidden="true">
      <line class="cn-route__line" x1="30" y1="40" x2="390" y2="40" />

      ${nodes
        .map(
          (node) => `
            <g>
              <circle class="cn-route__node" cx="${node.x}" cy="40" r="7" />
              <text class="cn-route__label" x="${node.x}" y="62" text-anchor="middle">${node.label}</text>
            </g>`,
        )
        .join('')}

      <circle class="cn-route__packet" r="5">
        <animateMotion dur="5s" repeatCount="indefinite" path="M30,40 L390,40" />
      </circle>
    </svg>
  `;
}

function heroHtml(): string {
  return `
    <section class="cn-hero" aria-labelledby="hero-heading">
      <div class="cn-container cn-hero__grid">
        <div class="cn-hero__copy">
          <h1 class="cn-hero__title cn-rise cn-rise-1" id="hero-heading">
            Learn Computer Networks.
            <span>Play your way through them.</span>
          </h1>

          <p class="cn-hero__lead cn-rise cn-rise-2">
            Short lessons, six challenge modes, and mastery tracked topic by topic.
          </p>

          <div class="cn-hero__actions cn-rise cn-rise-2">
            <a class="btn btn-cn-primary btn-lg" href="#/register">Start your first quest</a>
            <button class="btn btn-cn-ghost" type="button" id="${GUEST_BTN_ID}">Try without an account</button>
          </div>
        </div>

        <div class="cn-hero__stage">
          ${previewHtml()}
          ${routeHtml()}
        </div>
      </div>
    </section>
  `;
}

// ---------------------------------------------------------------- proof

function proofHtml(): string {
  return `
    <section class="cn-proof" aria-label="What is included">
      <div class="cn-container cn-proof__row">
        ${PROOF.map(
          (item) => `
            <div class="cn-proof__item">
              <span class="cn-proof__value">${item.value}</span>
              <span class="cn-proof__label">${escapeHtml(item.label)}</span>
            </div>`,
        ).join('')}
      </div>
    </section>
  `;
}

// ---------------------------------------------------------------- loop

/** The product loop as four nodes on a wire, which is what the subject is anyway. */
function loopHtml(): string {
  return `
    <section class="cn-section cn-loop" id="how-it-works" aria-labelledby="loop-heading">
      <div class="cn-container">
        <h2 class="cn-section__title" id="loop-heading">Learn. Play. Master.</h2>

        <ol class="cn-loop__steps">
          ${HOW_IT_WORKS.slice(0, 4)
            .map(
              (step) => `
                <li class="cn-loop__step">
                  <span class="cn-loop__node" aria-hidden="true"></span>
                  <h3>${escapeHtml(step.title)}</h3>
                  <p>${escapeHtml(step.description)}</p>
                </li>`,
            )
            .join('')}
        </ol>
      </div>
    </section>
  `;
}

// ---------------------------------------------------------------- modes

/**
 * Game modes, sized by how much each has to show.
 *
 * Two carry a miniature of their own interface; the rest stay compact. Six equal cards would
 * say nothing about which is worth trying first.
 */
function modesHtml(): string {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ['HTTPS', '443'],
    ['DNS', '53'],
    ['SSH', '22'],
  ];

  return `
    <section class="cn-section cn-modes" id="features" aria-labelledby="modes-heading">
      <div class="cn-container">
        <h2 class="cn-section__title" id="modes-heading">Revision that is not another lecture</h2>
        <p class="cn-section__lead">Six ways to practise the same syllabus. Pick whichever suits the hour you have.</p>

        <div class="cn-modes__grid">
          <article class="cn-modes__card cn-modes__card--wide" data-tone="mastered">
            <h3>Match &amp; Pair</h3>
            <p>Connect protocols, ports, devices and layers before the board clears.</p>

            <div class="cn-mini">
              ${pairs
                .map(
                  ([left, right]) => `
                    <div class="cn-mini__pair">
                      <span>${left}</span>
                      <i aria-hidden="true"></i>
                      <span>${right}</span>
                    </div>`,
                )
                .join('')}
            </div>
          </article>

          <article class="cn-modes__card" data-tone="special">
            <h3>Boss Battle</h3>
            <p>The Firewall Guardian and the Subnet Overlord lose HP for every right answer.</p>
            <div class="cn-mini__hp"><span style="width:62%"></span></div>
          </article>

          <article class="cn-modes__card" data-tone="xp">
            <h3>Rapid Fire</h3>
            <p>Sixty seconds. Answer as many as you can.</p>
            <p class="cn-mini__clock">0:42</p>
          </article>

          <article class="cn-modes__card" data-tone="accent">
            <h3>Quiz Blitz</h3>
            <p>Ten questions, twenty seconds each, explained as you go.</p>
          </article>

          <article class="cn-modes__card">
            <h3>Network Riddles</h3>
            <p>Name the protocol from a clue. Hints cost XP.</p>
          </article>

          <article class="cn-modes__card">
            <h3>Word Hunt</h3>
            <p>Find networking terms hidden in a generated grid.</p>
            <div class="cn-mini__letters">
              ${'FIREWALL'
                .split('')
                .map((letter) => `<span>${letter}</span>`)
                .join('')}
            </div>
          </article>
        </div>
      </div>
    </section>
  `;
}

// ---------------------------------------------------------------- journey

function journeyHtml(): string {
  return `
    <section class="cn-section cn-syllabus" id="install" aria-labelledby="syllabus-heading">
      <div class="cn-container">
        <h2 class="cn-section__title" id="syllabus-heading">A syllabus that reads as progression</h2>
        <p class="cn-section__lead">
          The whole ${escapeHtml(APP.subject)} paper, split into quests you finish one at a time.
        </p>

        <ol class="cn-syllabus__list">
          ${UNITS.map(
            (unit, index) => `
              <li class="cn-syllabus__unit" data-state="${index === 0 ? 'current' : 'ahead'}">
                <span class="cn-syllabus__node" aria-hidden="true"></span>
                <span class="cn-syllabus__num">${String(unit.number).padStart(2, '0')}</span>
                <span class="cn-syllabus__name">${escapeHtml(unit.title)}</span>
              </li>`,
          ).join('')}
        </ol>
      </div>
    </section>
  `;
}

// ---------------------------------------------------------------- close

function closingHtml(): string {
  return `
    <section class="cn-section cn-close cn-on-field" aria-labelledby="close-heading">
      <div class="cn-container cn-close__inner">
        <h2 class="cn-close__title" id="close-heading">Ready to enter the network?</h2>
        <p class="cn-close__lead">Start with Foundations and earn your first XP in about five minutes.</p>
        <a class="btn btn-cn-primary btn-lg" href="#/register">Start your first quest</a>
      </div>
    </section>
  `;
}

const landingPage: Page = {
  title: APP.tagline,

  render() {
    return `
      ${heroHtml()}
      ${proofHtml()}
      ${loopHtml()}
      ${modesHtml()}
      ${journeyHtml()}
      ${closingHtml()}
    `;
  },

  mount() {
    qs<HTMLButtonElement>(`#${GUEST_BTN_ID}`)?.addEventListener('click', () => {
      beginGuestSession();
      showToast('Playing as a guest. Progress is saved on this device only.', {
        title: 'Guest mode',
        variant: 'info',
      });
      navigate('/dashboard', true);
    });
  },
};

export default landingPage;
