/** Top navigation. Collapses into a toggle menu below the md breakpoint. */

import { ADMIN_NAV_ITEM, APP, APP_NAV, PUBLIC_NAV } from '@/config/app.config';
import type { NavItem } from '@/config/app.config';
import { isAdmin } from '@/services/admin.service';
import type { Layout } from '@/types/page';
import { escapeHtml, qs, requireEl } from '@/utils/dom';
import { getSession } from '@/state/session';

const MENU_ID = 'cn-primary-nav';

function linkHtml(item: NavItem, currentPath: string): string {
  const target = item.href.replace(/^#/, '').split('#')[0] || '/';
  const isCurrent = target === currentPath && target !== '/';
  return `
    <li>
      <a class="cn-navlink" href="${escapeHtml(item.href)}"${isCurrent ? ' aria-current="page"' : ''}>
        <i class="bi ${escapeHtml(item.icon)}" aria-hidden="true"></i>
        <span>${escapeHtml(item.label)}</span>
      </a>
    </li>
  `;
}

function actionsHtml(layout: Layout): string {
  if (layout === 'app') {
    const { user, profile, isGuest } = getSession();
    const name = profile?.name ?? user?.displayName ?? user?.email ?? 'Student';
    return `
      <li
        class="cn-navbar__user${isGuest ? ' cn-navbar__user--guest' : ''}"
        title="${isGuest ? 'Guest mode — progress is saved on this device only' : escapeHtml(name)}"
      >
        <i class="bi ${isGuest ? 'bi-person-badge' : 'bi-person-circle'}" aria-hidden="true"></i>
        <span>${isGuest ? 'Guest' : escapeHtml(name)}</span>
      </li>
      <li>
        <a class="btn btn-cn-ghost btn-sm" href="#/logout">
          <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
          ${isGuest ? 'Exit guest' : 'Log out'}
        </a>
      </li>
    `;
  }
  return `
    <li><a class="btn btn-cn-ghost btn-sm" href="#/login">Login</a></li>
    <li><a class="btn btn-cn-primary btn-sm" href="#/register">Start Learning</a></li>
  `;
}

export function renderNavbar(layout: Layout, currentPath: string): void {
  const header = requireEl('#app-header');

  if (layout === 'bare') {
    header.innerHTML = '';
    return;
  }

  // The admin link is offered only to the course owner. Hiding it is courtesy, not security —
  // the route and the Firestore rules both check the identity independently.
  const items =
    layout === 'app' ? (isAdmin() ? [...APP_NAV, ADMIN_NAV_ITEM] : APP_NAV) : PUBLIC_NAV;

  header.innerHTML = `
    <nav class="cn-navbar" aria-label="Main navigation">
      <div class="cn-container cn-navbar__inner">
        <a class="cn-brand" href="#/">
          <img src="${import.meta.env.BASE_URL}icons/icon.svg" alt="" width="34" height="34" />
          <span>${escapeHtml(APP.name)}</span>
        </a>

        <button
          type="button"
          class="cn-navbar__toggle"
          aria-controls="${MENU_ID}"
          aria-expanded="false"
          aria-label="Toggle navigation menu"
        >
          <i class="bi bi-list" aria-hidden="true"></i>
        </button>

        <ul class="cn-navbar__links" id="${MENU_ID}">
          ${items.map((item) => linkHtml(item, currentPath)).join('')}
          ${actionsHtml(layout)}
        </ul>
      </div>
    </nav>
  `;

  bindMobileToggle(header);
}

function bindMobileToggle(header: HTMLElement): void {
  const toggle = qs<HTMLButtonElement>('.cn-navbar__toggle', header);
  const menu = qs<HTMLElement>(`#${MENU_ID}`, header);
  if (!toggle || !menu) return;

  // Must match the breakpoint in components.css where the menu becomes a drawer.
  const mobileQuery = window.matchMedia('(max-width: 991.98px)');

  const setOpen = (open: boolean): void => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = mobileQuery.matches ? !open : false;
  };

  setOpen(false);
  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  // Close after navigating on mobile, and reset when growing to desktop width.
  menu.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a') && mobileQuery.matches) setOpen(false);
  });
  mobileQuery.addEventListener('change', () => setOpen(false));
}
