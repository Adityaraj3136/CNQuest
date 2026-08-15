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
          <span class="cn-label"><i class="bi bi-circle-fill" style="font-size:.45rem;color:var(--cn-positive)"></i> Installable · works offline</span>
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
              <a class="btn btn-cn-ghost" href="#/login">Login</a>
              <button class="btn btn-cn-ghost" type="button" id="${GUEST_BTN_ID}">Try as guest</button>
            </div>
          </div>

          ${consoleHtml()}
        </div>
      </div>
    </section>
  `;
}

/** A miniature of the real dashboard, rendered as a terminal readout. */
function consoleHtml(): string {
  const modes = [
    { icon: 'bi-lightning-charge', label: 'quiz.blitz' },
    { icon: 'bi-stopwatch', label: 'rapid.fire' },
    { icon: 'bi-shield-shaded', label: 'boss.battle' },
    { icon: 'bi-puzzle', label: 'match.pair' },
    { icon: 'bi-question-diamond', label: 'riddles' },
    { icon: 'bi-grid-3x3', label: 'word.search' },
  ];

  return `
    <div class="cn-console cn-rise cn-rise-4" role="img"
         aria-label="Preview of a CN Quest dashboard showing level 5, 1250 of 1500 XP, a 7 day streak and six game modes">
      <div class="cn-console__bar">
        <span>cn.quest / dashboard</span>
        <span>streak 07d</span>
      </div>
      <div class="cn-console__body">
        <div class="cn-console__row">
          <span class="cn-console__level">LVL 05 · Network Specialist</span>
          <span class="cn-console__xp">1250 / 1500 XP</span>
        </div>
        <div class="cn-progress cn-progress--reward" aria-hidden="true">
          <div class="cn-progress__bar" style="width:83%"></div>
        </div>
        <div class="cn-console__modes">
          ${modes
            .map(
              (mode) =>
                `<span class="cn-console__mode"><i class="bi ${mode.icon}" aria-hidden="true"></i>${mode.label}</span>`,
            )
            .join('')}
        </div>
        <div class="cn-console__row">
          <span>accuracy 82%</span>
          <span>answered 431</span>
          <span>badges 07</span>
        </div>
      </div>
    </div>
  `;
}

function ledgerHtml(): string {
  return `
    <section class="cn-section" aria-label="CN Quest at a glance" style="padding-block: clamp(2rem,1rem+2vw,3rem)">
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

function featuresHtml(): string {
  return `
    <section class="cn-section" id="features" aria-labelledby="features-heading">
      <div class="cn-container">
        <div class="cn-head">
          <span class="cn-label cn-label--marked">Index</span>
          <h2 class="cn-section__title" id="features-heading">Everything in one app</h2>
          <p class="cn-section__lead">
            Learning material, six practice modes and a gamification layer that remembers every
            answer you give.
          </p>
        </div>

        <div class="cn-index">
          ${LANDING_FEATURES.map(
            (feature, index) => `
              <article class="cn-index__item">
                <span class="cn-index__num">${String(index + 1).padStart(2, '0')}</span>
                <h3 class="cn-index__name">
                  <i class="bi ${escapeHtml(feature.icon)}" aria-hidden="true"></i>
                  ${escapeHtml(feature.title)}
                </h3>
                <p class="cn-index__desc">${escapeHtml(feature.description)}</p>
              </article>`,
          ).join('')}
        </div>
      </div>
    </section>
  `;
}

function flowHtml(): string {
  return `
    <section class="cn-section" id="how-it-works" aria-labelledby="how-heading">
      <div class="cn-container">
        <div class="cn-head">
          <span class="cn-label cn-label--marked">Method</span>
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
            (step, index) => `
              <li class="cn-flow__step" data-step="STEP ${String(index + 1).padStart(2, '0')}">
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
              Create your account <i class="bi bi-arrow-right" aria-hidden="true"></i>
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
