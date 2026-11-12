/** Site footer, including the live connectivity indicator used by the offline strategy. */

import { APP } from '@/config/app.config';
import { escapeHtml, qs, requireEl } from '@/utils/dom';
import type { Layout } from '@/types/page';

function statusHtml(): string {
  const online = navigator.onLine;
  return `
    <span class="cn-net-status" id="cn-net-status" data-online="${online}">
      <i class="bi ${online ? 'bi-circle-fill' : 'bi-circle'}" aria-hidden="true"></i>
      <span data-role="label">${online ? 'Online' : 'Offline Mode'}</span>
    </span>
  `;
}

/**
 * Signed-in students have no use for "Login / Register", and Settings has no other entry
 * point in the app — it is not in the primary nav, so without this the screen is reachable
 * only by typing its URL.
 */
function accountLinksHtml(layout: Layout): string {
  if (layout === 'app') {
    return `
      <li><a href="#/profile">Profile</a></li>
      <li><a href="#/settings">Settings</a></li>
      <li><a href="#/logout">Log out</a></li>
    `;
  }
  return `
    <li><a href="#/login">Login</a></li>
    <li><a href="#/register">Register</a></li>
    <li><a href="#/forgot-password">Forgot password</a></li>
  `;
}

export function renderFooter(layout: Layout): void {
  const footer = requireEl('#app-footer');

  if (layout === 'bare') {
    footer.innerHTML = '';
    return;
  }

  // Phones: the signed-in footer collapses to one status line (the tab bar carries the links);
  // public pages keep a compact link grid. Both handled in CSS via the layout modifier.
  footer.innerHTML = `
    <div class="cn-footer cn-footer--${layout}">
      <div class="cn-container">
        <div class="cn-footer__grid">
          <div class="cn-footer__about">
            <a class="cn-brand" href="#/">
              <img src="${import.meta.env.BASE_URL}icons/icon.svg" alt="" width="34" height="34" />
              <span>${escapeHtml(APP.name)}</span>
            </a>
            <p class="cn-footer__blurb">
              A gamified companion for the ${escapeHtml(APP.subject)} syllabus. Built to supplement
              textbooks and classroom teaching, not to replace them.
            </p>
          </div>
          <div>
            <h3>Learn</h3>
            <ul>
              <li><a href="#/learn">Units &amp; Topics</a></li>
              <li><a href="#/dictionary">Networking Dictionary</a></li>
              <li><a href="#/progress">Progress</a></li>
            </ul>
          </div>
          <div>
            <h3>Play</h3>
            <ul>
              <li><a href="#/games">All game modes</a></li>
              <li><a href="#/achievements">Achievements</a></li>
              <li><a href="#/leaderboard">Leaderboard</a></li>
            </ul>
          </div>
          <div>
            <h3>Account</h3>
            <ul>${accountLinksHtml(layout)}</ul>
          </div>
        </div>

        <div class="cn-footer__bottom">
          <span class="cn-footer__legal">
            &copy; ${new Date().getFullYear()} ${escapeHtml(APP.name)}<span class="cn-footer__extra"> · Academic project</span>
            · v${escapeHtml(APP.version)}<span class="cn-footer__extra"> · ${escapeHtml(APP.phase)}</span>
          </span>
          ${statusHtml()}
        </div>
      </div>
    </div>
  `;
}

/** Keeps the footer badge in sync with connectivity. Call once at start-up. */
export function watchConnectivity(): void {
  const sync = (): void => {
    const badge = qs('#cn-net-status');
    if (!badge) return;
    const online = navigator.onLine;
    badge.setAttribute('data-online', String(online));
    const label = qs('[data-role="label"]', badge);
    if (label) label.textContent = online ? 'Online' : 'Offline Mode';
    const icon = qs('i', badge);
    if (icon) icon.className = `bi ${online ? 'bi-circle-fill' : 'bi-circle'}`;
  };

  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
}
