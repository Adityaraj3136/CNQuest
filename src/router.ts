/**
 * Hash-based client-side router.
 *
 * Hash format: `#/path/segment?query=1#anchor`
 * Hash routing keeps CN Quest deployable as a static PWA without server rewrites,
 * and keeps deep links working from the installed app shell.
 */

import type { Layout, Page, PageContext, RouteDefinition } from '@/types/page';
import { APP } from '@/config/app.config';
import { renderNavbar } from '@/components/navbar';
import { renderFooter } from '@/components/footer';
import { loaderHtml, stateHtml } from '@/components/loader';
import { qs, requireEl } from '@/utils/dom';

/** Set for one page-load after an automatic recovery reload, so we never loop. */
const RELOAD_FLAG = 'cn-quest.chunk-reload';

/**
 * True when a dynamic import failed because the chunk is missing, rather than because the
 * module itself threw. Browsers word this differently, so match on the shape of the message.
 */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically|ChunkLoadError|Failed to fetch/i.test(
    message,
  );
}

interface ParsedHash {
  path: string;
  query: URLSearchParams;
  anchor: string;
}

/** Returns null when the pattern does not match, otherwise the extracted params. */
function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];
    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return null;
    }
  }
  return params;
}

export function parseHash(rawHash: string): ParsedHash {
  const raw = rawHash.replace(/^#/, '') || '/';
  const [beforeAnchor, ...anchorParts] = raw.split('#');
  const [pathPart, queryPart = ''] = beforeAnchor.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  return {
    path: path.length > 1 ? path.replace(/\/+$/, '') : '/',
    query: new URLSearchParams(queryPart),
    anchor: anchorParts.join('#'),
  };
}

/**
 * Every hash this router owns starts with `#/`. A bare `#fragment` is a document position —
 * the skip link's `#main-content`, or any in-page anchor — and resolving it as a route lands
 * the student on "Route not found" for pressing Tab then Enter.
 */
export function isRouteHash(hash: string): boolean {
  return hash === '' || hash === '#' || hash.startsWith('#/');
}

export function navigate(path: string, replace = false): void {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (replace) {
    window.location.replace(target);
  } else {
    window.location.hash = target;
  }
}

/** Resolves whether a protected route may render. Phase 2 replaces the default. */
export type AuthGuard = () => Promise<boolean> | boolean;

/**
 * A screen that must not be left by accident (a game round in progress) registers a guard.
 * Returning false cancels the navigation: the URL is put back and nothing re-renders.
 */
let leaveGuard: (() => boolean) | null = null;

export function setLeaveGuard(guard: (() => boolean) | null): void {
  leaveGuard = guard;
}

export class Router {
  private currentPage: Page | null = null;
  private renderToken = 0;
  private lastLayout: Layout = 'public';
  private lastPath = '/';
  /** The full hash of the screen on display, to restore a cancelled navigation. */
  private lastHash = '';

  constructor(
    private readonly routes: readonly RouteDefinition[],
    /** May this visitor enter a protected route? Guests count as authenticated. */
    private readonly authGuard: AuthGuard = () => false,
    /**
     * Should this visitor be bounced off the auth screens? Defaults to `authGuard`,
     * but a guest must stay able to reach /register and /login to upgrade to an account.
     */
    private readonly redirectGuard: AuthGuard = authGuard,
  ) {}

  start(): void {
    window.addEventListener('hashchange', () => void this.resolve());
    if (!window.location.hash) {
      window.location.replace('#/');
      return;
    }
    void this.resolve();
  }

  /** Re-runs the current route, e.g. after the auth identity changes. */
  reload(): void {
    void this.resolve(true);
  }

  /** The hash of the screen currently shown; the exit guard restores it when a back is cancelled. */
  currentHash(): string {
    return this.lastHash;
  }

  /** Re-renders only the navbar/footer, e.g. once the profile name loads. */
  refreshChrome(): void {
    renderNavbar(this.lastLayout, this.lastPath);
    renderFooter(this.lastLayout);
  }

  private async resolve(force = false): Promise<void> {
    const rawHash = window.location.hash;


    // An in-page anchor must not tear down the screen the student is on.
    if (!isRouteHash(rawHash)) {
      // Unless nothing is rendered yet — someone deep-linked straight to `#main-content`,
      // and an empty outlet is worse than starting at the landing page.
      if (!this.currentPage) {
        navigate('/', true);
        return;
      }
      this.focusAnchor(rawHash.slice(1));
      return;
    }

    // A cancelled navigation restores the URL, which can re-fire hashchange for the screen
    // already on display. Rendering it again would restart a game the student chose to stay in.
    if (!force && this.currentPage && rawHash === this.lastHash) return;

    if (leaveGuard && this.currentPage && rawHash !== this.lastHash) {
      if (!leaveGuard()) {
        history.pushState(history.state, '', this.lastHash || '#/');
        return;
      }
      leaveGuard = null;
    }

    const { path, query, anchor } = parseHash(rawHash);
    const token = ++this.renderToken;

    const match = this.routes
      .map((route) => ({ route, params: matchPath(route.path, path) }))
      .find((candidate) => candidate.params !== null);

    if (!match || !match.params) {
      await this.renderNotFound(path);
      return;
    }

    const { route, params } = match;

    if (route.requiresAuth && !(await this.authGuard())) {
      navigate(`/login?next=${encodeURIComponent(path)}`, true);
      return;
    }

    if (route.redirectIfAuthed && (await this.redirectGuard())) {
      navigate(route.redirectIfAuthed, true);
      return;
    }

    // Stop the outgoing screen before anything else. Unmounting only after the next chunk had
    // loaded left a 3D game's render loop and session mode running meanwhile; on a slow phone,
    // or when that load failed, the screen froze with the tab bar still hidden.
    this.currentPage?.unmount?.();
    this.currentPage = null;
    this.lastHash = rawHash;

    const outlet = requireEl('#main-content');
    this.lastLayout = route.layout;
    this.lastPath = path;
    renderNavbar(route.layout, path);
    renderFooter(route.layout);
    outlet.innerHTML = loaderHtml();

    try {
      const page = await route.load();
      if (token !== this.renderToken) return; // a newer navigation won

      const ctx: PageContext = { params, query };
      outlet.innerHTML = page.render(ctx);
      this.currentPage = page;
      document.title = `${page.title} · ${APP.name}`;
      await page.mount?.(ctx);
      this.restoreScroll(anchor);
      // The screen rendered, so any earlier recovery reload succeeded.
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch (error) {
      console.error('[router] failed to load route', path, error);
      if (token !== this.renderToken) return;

      // A screen is a lazily imported chunk. After a redeploy (or a dev-server restart) the
      // running page holds filenames that no longer exist, so the import 404s through no
      // fault of the student. One reload picks up the current build; the session flag stops
      // a reload loop if something is genuinely broken.
      if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
        return;
      }

      outlet.innerHTML = stateHtml({
        icon: 'bi-exclamation-triangle',
        title: "We couldn't load this screen",
        message: 'Something went wrong loading this part of the app. Your progress is safe.',
        actionLabel: 'Reload CN Quest',
        actionHref: '#/',
      });

      // The state's link only changes the hash, which would not re-fetch the failed chunk.
      qs<HTMLAnchorElement>('.cn-state .btn', outlet)?.addEventListener('click', (event) => {
        event.preventDefault();
        sessionStorage.removeItem(RELOAD_FLAG);
        window.location.reload();
      });
    }
  }

  private async renderNotFound(path: string): Promise<void> {
    renderNavbar('public', path);
    renderFooter('public');
    this.currentPage?.unmount?.();
    this.currentPage = null;
    document.title = `Page not found · ${APP.name}`;
    requireEl('#main-content').innerHTML = stateHtml({
      icon: 'bi-signpost-split',
      title: 'Route not found',
      message: `Nothing is mapped to "${path}" yet. It may arrive in a later development phase.`,
      actionLabel: 'Back to home',
      actionHref: '#/',
    });
  }

  /**
   * Scrolls to an in-page anchor and moves keyboard focus there. Scrolling alone would leave
   * a screen-reader or keyboard user's focus stranded at the top, which defeats a skip link.
   */
  private focusAnchor(id: string): void {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  }

  private restoreScroll(anchor: string): void {
    if (!anchor) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
