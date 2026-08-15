/**
 * Top navigation.
 *
 * Five primary destinations on desktop, with everything personal behind an account menu.
 * On phones the primary destinations move to a bottom bar, because a thumb reaches the
 * bottom of a screen and not the top of one.
 */

import { ACCOUNT_NAV, ADMIN_NAV_ITEM, APP, APP_NAV, MOBILE_NAV, PUBLIC_NAV } from '@/config/app.config';
import type { NavItem } from '@/config/app.config';
import type { Layout } from '@/types/page';
import { escapeHtml, qs, qsa, requireEl } from '@/utils/dom';
import { getSession } from '@/state/session';
import { isAdmin } from '@/services/admin.service';

const MENU_ID = 'cn-primary-nav';
const ACCOUNT_ID = 'cn-account-menu';

function isCurrent(item: NavItem, currentPath: string): boolean {
  const target = item.href.replace(/^#/, '').split('#')[0] || '/';
  if (target === '/') return false;
  // A topic page should still light up "Learn", so a prefix match is what is wanted here.
  return currentPath === target || currentPath.startsWith(`${target}/`);
}

function linkHtml(item: NavItem, currentPath: string): string {
  const current = isCurrent(item, currentPath);
  return `
    <li>
      <a class="cn-navlink" href="${escapeHtml(item.href)}"${current ? ' aria-current="page"' : ''}>
        <i class="bi ${escapeHtml(item.icon)}" aria-hidden="true"></i>
        <span>${escapeHtml(item.label)}</span>
      </a>
    </li>
  `;
}

/** The account menu: identity, the secondary destinations, and the way out. */
function accountHtml(currentPath: string): string {
  const { user, profile, isGuest } = getSession();
  const name = profile?.name ?? user?.displayName ?? user?.email ?? 'Student';
  const label = isGuest ? 'Guest' : name;
  const items = isAdmin() ? [...ACCOUNT_NAV, ADMIN_NAV_ITEM] : ACCOUNT_NAV;

  return `
    <div class="cn-account">
      <button
        type="button"
        class="cn-account__trigger"
        aria-expanded="false"
        aria-controls="${ACCOUNT_ID}"
      >
        <span class="cn-account__avatar" aria-hidden="true">${escapeHtml(label.slice(0, 1).toUpperCase())}</span>
        <span class="cn-account__name">${escapeHtml(label)}</span>
        <i class="bi bi-chevron-down" aria-hidden="true"></i>
      </button>

      <div class="cn-account__menu" id="${ACCOUNT_ID}" hidden>
        ${
          isGuest
            ? `<p class="cn-account__note">Progress is saved on this device only.</p>`
            : `<p class="cn-account__note">${escapeHtml(user?.email ?? '')}</p>`
        }
        <ul>
          ${items
            .map(
              (item) => `
                <li>
                  <a href="${escapeHtml(item.href)}"${isCurrent(item, currentPath) ? ' aria-current="page"' : ''}>
                    <i class="bi ${escapeHtml(item.icon)}" aria-hidden="true"></i>
                    ${escapeHtml(item.label)}
                  </a>
                </li>`,
            )
            .join('')}
        </ul>
        <a class="cn-account__signout" href="#/logout">
          <i class="bi bi-box-arrow-right" aria-hidden="true"></i>
          ${isGuest ? 'Exit guest mode' : 'Sign out'}
        </a>
      </div>
    </div>
  `;
}

function publicActionsHtml(): string {
  return `
    <li><a class="btn btn-cn-ghost btn-sm" href="#/login">Log in</a></li>
    <li><a class="btn btn-cn-primary btn-sm" href="#/register">Start learning</a></li>
  `;
}

/** Bottom bar, phones only. Mirrors the primary destinations minus Library. */
function mobileBarHtml(currentPath: string): string {
  return `
    <nav class="cn-tabbar" aria-label="Primary">
      ${MOBILE_NAV.map(
        (item) => `
          <a class="cn-tabbar__item" href="${escapeHtml(item.href)}"${isCurrent(item, currentPath) ? ' aria-current="page"' : ''}>
            <i class="bi ${escapeHtml(item.icon)}" aria-hidden="true"></i>
            <span>${escapeHtml(item.label)}</span>
          </a>`,
      ).join('')}
      <button type="button" class="cn-tabbar__item cn-tabbar__more" aria-controls="${MENU_ID}" aria-expanded="false">
        <i class="bi bi-three-dots" aria-hidden="true"></i>
        <span>More</span>
      </button>
    </nav>
  `;
}

export function renderNavbar(layout: Layout, currentPath: string): void {
  const header = requireEl('#app-header');

  if (layout === 'bare') {
    header.innerHTML = '';
    removeTabBar();
    return;
  }

  const isApp = layout === 'app';
  const items = isApp ? APP_NAV : PUBLIC_NAV;

  header.innerHTML = `
    <nav class="cn-navbar" aria-label="Main navigation">
      <div class="cn-container cn-navbar__inner">
        <a class="cn-brand" href="${isApp ? '#/dashboard' : '#/'}">
          <img src="${import.meta.env.BASE_URL}icons/icon.svg" alt="" width="30" height="30" />
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
          ${isApp ? '' : publicActionsHtml()}
        </ul>

        ${isApp ? accountHtml(currentPath) : ''}
      </div>
    </nav>
  `;

  bindMobileToggle(header);
  if (isApp) bindAccountMenu(header);
  renderTabBar(isApp, currentPath);
}

// ---------------------------------------------------------------- mobile bar

function removeTabBar(): void {
  qs('.cn-tabbar')?.remove();
  document.body.classList.remove('has-tabbar');
}

function renderTabBar(isApp: boolean, currentPath: string): void {
  removeTabBar();
  if (!isApp) return;

  document.body.insertAdjacentHTML('beforeend', mobileBarHtml(currentPath));
  document.body.classList.add('has-tabbar');

  qs<HTMLButtonElement>('.cn-tabbar__more')?.addEventListener('click', () => {
    const menu = qs<HTMLElement>(`#${MENU_ID}`);
    const toggle = qs<HTMLButtonElement>('.cn-navbar__toggle');
    if (!menu || !toggle) return;
    toggle.click();
    menu.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ---------------------------------------------------------------- menus

function bindAccountMenu(header: HTMLElement): void {
  const trigger = qs<HTMLButtonElement>('.cn-account__trigger', header);
  const menu = qs<HTMLElement>(`#${ACCOUNT_ID}`, header);
  if (!trigger || !menu) return;

  const setOpen = (open: boolean): void => {
    trigger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(trigger.getAttribute('aria-expanded') !== 'true');
  });

  // Clicking anywhere else, or pressing Escape, closes it. A menu that traps the page is
  // worse than no menu.
  document.addEventListener('click', (event) => {
    if (!menu.hidden && !menu.contains(event.target as Node)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      trigger.focus();
    }
  });
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

  menu.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a') && mobileQuery.matches) setOpen(false);
  });
  mobileQuery.addEventListener('change', () => setOpen(false));

  qsa<HTMLAnchorElement>('a', menu).forEach((link) => {
    link.addEventListener('click', () => {
      if (mobileQuery.matches) setOpen(false);
    });
  });
}
