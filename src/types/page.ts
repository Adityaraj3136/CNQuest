/** Contract every routed screen implements. */

export interface PageContext {
  /** Route params parsed from the hash, e.g. `#/topics/:topicId`. */
  params: Record<string, string>;
  /** Query parameters from the hash, e.g. `#/login?next=/dashboard`. */
  query: URLSearchParams;
}

export interface Page {
  /** Document title suffix for this screen. */
  title: string;
  /** Returns the HTML for the main content region. */
  render(ctx: PageContext): string;
  /** Runs after the HTML is inserted — bind events here. */
  mount?(ctx: PageContext): void | Promise<void>;
  /** Runs before the screen is replaced — detach listeners/timers here. */
  unmount?(): void;
}

/** Chrome shown around a page. */
export type Layout = 'public' | 'app' | 'bare';

export interface RouteDefinition {
  /** Hash path pattern, e.g. `/`, `/login`, `/topics/:topicId`. */
  path: string;
  layout: Layout;
  /** Lazily imported so each screen becomes its own bundle chunk. */
  load: () => Promise<Page>;
  /** Requires an authenticated user. Unauthenticated visitors are sent to /login. */
  requiresAuth?: boolean;
  /** Signed-in students are bounced away from this route (login, register, landing). */
  redirectIfAuthed?: string;
}
