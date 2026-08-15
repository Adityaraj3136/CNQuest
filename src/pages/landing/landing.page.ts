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
          <span>Master</span>
          <span>Computer</span>
          <span class="cn-hero__accent">
            Networks
            <i class="cn-hero__trace" aria-hidden="true"></i>
          </span>
        </h1>

        <div class="cn-hero__body">
          <div class="cn-rise cn-rise-3">
            <p class="cn-hero__lead">
              Six game modes, XP, levels and daily streaks built around the ${escapeHtml(APP.subject)}
              syllabus. Read a topic, play it, and watch your mastery move.
            </p>
            <div class="cn-hero__actions">
              <a class="btn btn-cn-primary" href="#/register">
                Start learning <i class="bi bi-arrow-right" aria-hidden="true"></i>
              </a>
              <button class="btn btn-cn-ghost" type="button" id="${GUEST_BTN_ID}">Try as guest</button>
            </div>
          </div>

          ${heroImageHtml()}
        </div>
      </div>
    </section>
  `;
}

/**
 * Hero visual.
 *
 * This replaced a dashboard preview built out of styled divs, with invented figures
 * (`accuracy 82%`, `answered 431`). A hand-drawn fake screenshot is not evidence the product
 * works, and inventing precision the app never claims is worse than showing nothing.
 *
 * Placeholder photography, swappable for a real screenshot or studio shot: the seed is
 * descriptive so the same image is served on every load rather than shuffling per visit.
 */
function heroImageHtml(): string {
  return `
    <figure class="cn-hero__figure cn-rise cn-rise-4">
      <img
        src="https://picsum.photos/seed/cn-quest-network-cabling/960/720"
        alt="Network patch cabling in a campus switch cabinet"
        width="960"
        height="720"
        fetchpriority="high"
        decoding="async"
      />
    </figure>
  `;
}

function ledgerHtml(): string {
  return `
    <section class="cn-section cn-ledger-band" aria-label="CN Quest at a glance">
      <div class="cn-container">
        <figure class="cn-band__figure">
          <img
            src="https://picsum.photos/seed/cn-quest-students-studying/1600/600"
            alt="Students revising together at a campus desk"
            width="1600"
            height="600"
            loading="lazy"
            decoding="async"
          />
        </figure>
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
    return `${heroHtml()}${ledgerHtml()}${featuresHtml()}${flowHtml()}${installHtml()}`;
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
