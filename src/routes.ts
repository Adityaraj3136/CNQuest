/**
 * Route table.
 *
 * Screens are lazily imported so each one becomes its own chunk.
 * `requiresAuth` routes are gated by the Router's auth guard (backed by the session store);
 * `redirectIfAuthed` bounces signed-in students away from the auth screens.
 */

import type { RouteDefinition } from '@/types/page';

export const routes: readonly RouteDefinition[] = [
  {
    path: '/',
    layout: 'public',
    load: () => import('@/pages/landing/landing.page').then((m) => m.default),
  },

  // --- Authentication ---
  {
    path: '/login',
    layout: 'public',
    redirectIfAuthed: '/dashboard',
    load: () => import('@/pages/auth/login.page').then((m) => m.default),
  },
  {
    path: '/register',
    layout: 'public',
    redirectIfAuthed: '/dashboard',
    load: () => import('@/pages/auth/register.page').then((m) => m.default),
  },
  {
    path: '/forgot-password',
    layout: 'public',
    redirectIfAuthed: '/dashboard',
    load: () => import('@/pages/auth/forgot-password.page').then((m) => m.default),
  },
  {
    path: '/logout',
    layout: 'bare',
    load: () => import('@/pages/auth/logout.page').then((m) => m.default),
  },

  // --- Protected app ---
  {
    path: '/dashboard',
    layout: 'app',
    requiresAuth: true,
    load: () => import('@/pages/dashboard/dashboard.page').then((m) => m.default),
  },
  {
    path: '/learn',
    layout: 'app',
    requiresAuth: true,
    load: () => import('@/pages/learn/learn.page').then((m) => m.default),
  },
  {
    path: '/learn/:topicId',
    layout: 'app',
    requiresAuth: true,
    load: () => import('@/pages/learn/topic.page').then((m) => m.default),
  },
  {
    path: '/games',
    layout: 'app',
    requiresAuth: true,
    load: () => import('@/pages/games/games.page').then((m) => m.default),
  },
  {
    path: '/achievements',
    layout: 'app',
    requiresAuth: true,
    load: () => import('@/pages/achievements/achievements.page').then((m) => m.default),
  },
  {
    path: '/dictionary',
    layout: 'app',
    requiresAuth: true,
    load: () => import('@/pages/dictionary/dictionary.page').then((m) => m.default),
  },
  {
    path: '/progress',
    layout: 'app',
    requiresAuth: true,
    load: () => import('@/pages/progress/progress.page').then((m) => m.default),
  },
  {
    path: '/profile',
    layout: 'app',
    requiresAuth: true,
    load: () => import('@/pages/profile/profile.page').then((m) => m.default),
  },
  {
    path: '/settings',
    layout: 'app',
    requiresAuth: true,
    load: () => import('@/pages/settings/settings.page').then((m) => m.default),
  },
  // --- Game session mode ---
  //
  // `bare` means no navbar, no footer, no tab bar: a game is a focused task, and the site
  // chrome around it was the main thing making the modes read as pages that happen to contain
  // a quiz. A mode may only move to `bare` once it renders the shared HUD, because the HUD
  // carries the exit. Without it a student is sealed inside the round with no way out, so the
  // four modes still to be converted deliberately stay on the `app` layout.
  {
    path: '/games/quiz',
    layout: 'bare',
    requiresAuth: true,
    load: () => import('@/games/quiz/quiz.page').then((m) => m.default),
  },
  {
    path: '/games/rapid-fire',
    layout: 'bare',
    requiresAuth: true,
    load: () => import('@/games/rapid-fire/rapid-fire.page').then((m) => m.default),
  },
  {
    path: '/games/matching',
    layout: 'bare',
    requiresAuth: true,
    load: () => import('@/games/matching/matching.page').then((m) => m.default),
  },
  {
    path: '/games/riddles',
    layout: 'bare',
    requiresAuth: true,
    load: () => import('@/games/riddles/riddle.page').then((m) => m.default),
  },
  {
    path: '/games/boss',
    layout: 'bare',
    requiresAuth: true,
    load: () => import('@/games/boss/boss.page').then((m) => m.default),
  },
  {
    path: '/games/word-search',
    layout: 'bare',
    requiresAuth: true,
    load: () => import('@/games/word-search/word-search.page').then((m) => m.default),
  },
  {
    path: '/leaderboard',
    layout: 'app',
    requiresAuth: true,
    load: () => import('@/pages/leaderboard/leaderboard.page').then((m) => m.default),
  },

  // Content management. `requiresAuth` only gets a student to the screen; the page itself
  // checks the admin identity, and the Firestore rules are what actually enforce it.
  {
    path: '/admin',
    layout: 'app',
    requiresAuth: true,
    load: () => import('@/pages/admin/admin.page').then((m) => m.default),
  },
];
