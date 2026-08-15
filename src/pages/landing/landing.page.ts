/**
 * Landing page.
 *
 * Composition (Technical Editorial): status bar → display headline with a packet trace →
 * lead + console preview → stat ledger → indexed feature list → flow → inverted install band.
 * Deliberately not a hero-plus-card-grid.
 */

import type { Page } from '@/types/page';
import { APP, HOW_IT_WORKS, LANDING_FEATURES } from '@/config/app.config';
import { escapeHtml, qs } from '@/utils/dom';
import { beginGuestSession } from '@/state/session';
import { showToast } from '@/components/toast';
import { navigate } from '@/router';
import '@/styles/landing.css';

const GUEST_BTN_ID = 'cn-hero-guest-btn';

/** Figures shown in the ledger. Kept beside the seed data they describe. */
const LEDGER = [
  { value: '06', label: 'Syllabus units' },
  { value: '17', label: 'Topics' },
  { value: '90', label: 'Questions' },
  { value: '06', label: 'Game modes' },
] as const;

function heroHtml(): string {
  return `
    <section class="cn-hero" aria-labelledby="hero-heading">
      <div class="cn-container">
        <div class="cn-hero__meta cn-rise cn-rise-1">
          <span class="cn-label cn-label--marked">Reinforcement-AI gamified learning</span>
        </div>

        <h1 class="cn-hero__title cn-rise cn-rise-2" id="hero-heading">
          Master Computer Networks by playing
        </h1>

        <div class="cn-hero__body">
          <div class="cn-rise cn-rise-3">
            <p class="cn-hero__lead">
              Learn the syllabus, practise through challenges, defeat networking bosses, and
              track what you have actually mastered.
            </p>
            <div class="cn-hero__actions">
              <a class="btn btn-cn-primary" href="#/register">
                Start learning <i class="bi bi-arrow-right" aria-hidden="true"></i>
              </a>
              <a class="btn btn-cn-ghost" href="#/learn">Explore the syllabus</a>
              <button class="btn btn-cn-ghost" type="button" id="${GUEST_BTN_ID}">Try as guest</button>
            </div>
          </div>

          ${heroVisualHtml()}
        </div>
      </div>
    </section>
  `;
}

/**
 * Hero visual: a packet crossing a small network.
 *
 * Placeholder photography was tried here and thrown out. Stock images of cabling say nothing
 * about this app, and random photography fights an ink-on-paper palette that has exactly one
 * accent. A diagram drawn in the page's own language is on-subject, identical on every load,
 * and needs no network of its own, which matters for an app that promises to work offline.
 *
 * Kept to primitives: circles, lines and labels. `currentColor` inherits the ink, so it stays
 * correct wherever it is placed.
 */
function heroVisualHtml(): string {
  const nodes = [
    { x: 40, y: 150, label: 'HOST' },
    { x: 170, y: 70, label: 'SWITCH' },
    { x: 170, y: 230, label: 'ROUTER' },
    { x: 320, y: 150, label: 'GATEWAY' },
    { x: 450, y: 150, label: 'SERVER' },
  ];

  const links = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [3, 4],
  ];

  return `
    <figure class="cn-hero__figure cn-rise cn-rise-4">
      <svg viewBox="0 0 500 300" role="img" aria-labelledby="cn-hero-visual-title">
        <title id="cn-hero-visual-title">
          A packet travelling from a host through a switch and gateway to a server
        </title>

        ${links
          .map(([from, to]) => {
            const a = nodes[from];
            const b = nodes[to];
            return `<line class="cn-topo__link" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
          })
          .join('')}

        <!-- The traced route is the one thing in accent, so the eye follows the packet. -->
        <polyline
          class="cn-topo__route"
          points="${[nodes[0], nodes[1], nodes[3], nodes[4]].map((node) => `${node.x},${node.y}`).join(' ')}"
        />

        <circle class="cn-topo__packet" r="6">
          <animateMotion dur="4s" repeatCount="indefinite"
            path="M${nodes[0].x},${nodes[0].y} L${nodes[1].x},${nodes[1].y} L${nodes[3].x},${nodes[3].y} L${nodes[4].x},${nodes[4].y}" />
        </circle>

        ${nodes
          .map(
            (node) => `
              <g class="cn-topo__node">
                <circle cx="${node.x}" cy="${node.y}" r="13" />
                <text x="${node.x}" y="${node.y + 34}" text-anchor="middle">${node.label}</text>
              </g>`,
          )
          .join('')}
      </svg>
    </figure>
  `;
}

function ledgerHtml(): string {
  return `
    <section class="cn-section cn-ledger-band" aria-label="CN Quest at a glance">
      <div class="cn-container">
        <dl class="cn-ledger">
          ${LEDGER.map(
            (cell) => `
              <div class="cn-ledger__cell">
                <dt class="visually-hidden">${escapeHtml(cell.label)}</dt>
                <dd class="mb-0">
                  <span class="cn-ledger__value">${escapeHtml(cell.value)}</span>
                  <span class="cn-ledger__label">${escapeHtml(cell.label)}</span>
                </dd>
              </div>`,
          ).join('')}
        </dl>
      </div>
    </section>
  `;
}

/**
 * What the app is, stated plainly.
 *
 * The landing page previously opened with features and never said what the product was for.
 * A visitor could read the whole hero and still not know it was a revision tool for one
 * university subject, so this sits directly under it and answers the three questions a
 * student actually has before signing up.
 */
function purposeHtml(): string {
  const answers = [
    {
      q: 'What is it',
      a: `A revision app for the ${APP.subject} paper. Every unit of the syllabus as short notes, then questions on the same material in six different game formats.`,
    },
    {
      q: 'Who it is for',
      a: 'Undergraduate CS students revising for a Computer Networks exam, or anyone who wants the fundamentals to stick without reading a 900-page textbook cover to cover.',
    },
    {
      q: 'How it works',
      a: 'Read a topic, play a round on it, and the app tracks per-topic mastery from what you actually got right. Weak topics come back; strong ones make way.',
    },
  ];

  return `
    <section class="cn-section cn-purpose" aria-labelledby="purpose-heading">
      <div class="cn-container">
        <h2 class="cn-section__title" id="purpose-heading">
          A syllabus you can play through
        </h2>

        <dl class="cn-purpose__list">
          ${answers
            .map(
              (entry) => `
                <div class="cn-purpose__row">
                  <dt>${escapeHtml(entry.q)}</dt>
                  <dd>${escapeHtml(entry.a)}</dd>
                </div>`,
            )
            .join('')}
        </dl>

        <p class="cn-purpose__note">
          Built to supplement lectures and textbooks, not to replace them. Free, installable,
          and usable offline once loaded.
        </p>
      </div>
    </section>
  `;
}

function featuresHtml(): string {
  return `
    <section class="cn-section" id="features" aria-labelledby="features-heading">
      <div class="cn-container">
        <div class="cn-head">
          <h2 class="cn-section__title" id="features-heading">Everything in one app</h2>
          <p class="cn-section__lead">
            Learning material, six practice modes and a gamification layer that remembers every
            answer you give.
          </p>
        </div>

        ${(['Study', 'Play', 'Progress'] as const)
          .map(
            (group) => `
              <div class="cn-group">
                <h3 class="cn-group__name">${escapeHtml(group)}</h3>
                <div class="cn-index">
                  ${LANDING_FEATURES.filter((feature) => feature.group === group)
                    .map(
                      (feature) => `
                        <article class="cn-index__item">
                          <h4 class="cn-index__name">
                            <i class="bi ${escapeHtml(feature.icon)}" aria-hidden="true"></i>
                            ${escapeHtml(feature.title)}
                          </h4>
                          <p class="cn-index__desc">${escapeHtml(feature.description)}</p>
                        </article>`,
                    )
                    .join('')}
                </div>
              </div>`,
          )
          .join('')}
      </div>
    </section>
  `;
}

function flowHtml(): string {
  return `
    <section class="cn-section" id="how-it-works" aria-labelledby="how-heading">
      <div class="cn-container">
        <div class="cn-head">
          <h2 class="cn-section__title" id="how-heading">
            Learn → Practice → Earn XP → Level up → Master networking
          </h2>
          <p class="cn-section__lead">
            Every mode feeds one shared result pipeline, so XP, progress, streaks and achievements
            always agree with each other.
          </p>
        </div>

        <ol class="cn-flow" style="list-style:none;padding:0;margin-top:var(--cn-space-6)">
          ${HOW_IT_WORKS.map(
            (step) => `
              <li class="cn-flow__step">
                <h3>${escapeHtml(step.title)}</h3>
                <p>${escapeHtml(step.description)}</p>
              </li>`,
          ).join('')}
        </ol>
      </div>
    </section>
  `;
}

function installHtml(): string {
  const points = [
    'Install to your home screen or desktop',
    'App shell and lessons load with no network',
    'Results are queued locally while offline',
    'Progress syncs the moment you reconnect',
  ];

  return `
    <section class="cn-section cn-section--field cn-on-field" id="install" aria-labelledby="install-heading">
      <div class="cn-container cn-install">
        <div>
          <span class="cn-label cn-label--marked">Progressive Web App</span>
          <h2 class="cn-install__title mt-3" id="install-heading">
            Install it.<br />Study on patchy campus Wi-Fi.
          </h2>
          <p class="cn-section__lead mt-4">
            ${escapeHtml(APP.name)} installs like a native app on Android, Windows and macOS. Cached
            topics stay readable offline, and anything you finish is uploaded the moment you are back.
          </p>
          <div class="cn-hero__actions">
            <a class="btn btn-cn-primary" href="#/register">
              Start learning <i class="bi bi-arrow-right" aria-hidden="true"></i>
            </a>
          </div>
        </div>

        <ul class="cn-install__list">
          ${points
            .map(
              (point) =>
                `<li><i class="bi bi-check-lg" aria-hidden="true"></i><span>${escapeHtml(point)}</span></li>`,
            )
            .join('')}
        </ul>
      </div>
    </section>
  `;
}

const landingPage: Page = {
  title: APP.tagline,

  render() {
    return `${heroHtml()}${purposeHtml()}${ledgerHtml()}${featuresHtml()}${flowHtml()}${installHtml()}`;
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
