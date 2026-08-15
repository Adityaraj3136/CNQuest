/**
 * Static application configuration.
 * Content shown on marketing/navigation surfaces lives here so pages stay free of magic strings.
 */

export const APP = {
  name: 'CN Quest',
  tagline: 'Master Computer Networks Through Interactive Challenges',
  subject: 'Computer Networks',
  version: '0.1.0',
  /** Current development phase, surfaced in the footer for the academic demo. */
  phase: 'Phase 11 - Adaptive Learning',
} as const;

/**
 * The course owner's account. Mirrors `adminEmail()` in firestore.rules; change both together.
 *
 * This only decides what the *interface* offers. Firestore rules are what actually enforce it,
 * so editing this value in devtools reveals a dashboard whose every write is then refused.
 */
export const ADMIN_EMAIL = 'adityaraj3136@gmail.com';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

/** Navigation shown before sign-in. */
export const PUBLIC_NAV: readonly NavItem[] = [
  { label: 'How it works', href: '#/#how-it-works', icon: 'bi-diagram-3' },
  { label: 'Games', href: '#/#games', icon: 'bi-controller' },
  { label: 'Syllabus', href: '#/#syllabus', icon: 'bi-book' },
];

/**
 * Primary navigation after sign-in. Five destinations, not ten.
 *
 * Ten equal-weight items forced a student to re-read the whole bar every visit and made
 * nothing look important. These five answer "where am I going", and everything personal
 * (profile, settings, sign out) moved into the account menu, where it is looked for
 * deliberately rather than scanned past constantly.
 */
export const APP_NAV: readonly NavItem[] = [
  { label: 'Home', href: '#/dashboard', icon: 'bi-house' },
  { label: 'Learn', href: '#/learn', icon: 'bi-book' },
  { label: 'Play', href: '#/games', icon: 'bi-controller' },
  { label: 'Progress', href: '#/progress', icon: 'bi-graph-up-arrow' },
  { label: 'Library', href: '#/dictionary', icon: 'bi-journal-text' },
];

/**
 * Everything that used to sit in the main bar. Reachable from the account menu, and on
 * mobile from "More", so no destination was lost in the simplification.
 */
export const ACCOUNT_NAV: readonly NavItem[] = [
  { label: 'Achievements', href: '#/achievements', icon: 'bi-trophy' },
  { label: 'Leaderboard', href: '#/leaderboard', icon: 'bi-bar-chart-steps' },
  { label: 'Profile', href: '#/profile', icon: 'bi-person-circle' },
  { label: 'Settings', href: '#/settings', icon: 'bi-gear' },
];

/** Bottom bar on phones. Library and the account items live behind "More". */
export const MOBILE_NAV: readonly NavItem[] = [
  { label: 'Home', href: '#/dashboard', icon: 'bi-house' },
  { label: 'Learn', href: '#/learn', icon: 'bi-book' },
  { label: 'Play', href: '#/games', icon: 'bi-controller' },
  { label: 'Progress', href: '#/progress', icon: 'bi-graph-up-arrow' },
];

/** Appended to APP_NAV for the admin account only. */
export const ADMIN_NAV_ITEM: NavItem = {
  label: 'Admin',
  href: '#/admin',
  icon: 'bi-sliders',
};

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
  /** Which cluster this belongs to on the landing page. Ten equal rows read as a data dump. */
  group: 'Study' | 'Play' | 'Progress';
}

export const LANDING_FEATURES: readonly FeatureItem[] = [
  {
    icon: 'bi-book-half',
    title: 'Learn Computer Networks',
    description: 'Unit-wise revision notes from the OSI model to network security, written for quick recall.',
    group: 'Study',
  },
  {
    icon: 'bi-lightning-charge',
    title: 'Quiz Blitz',
    description: 'Ten timed multiple-choice questions with instant feedback and explanations.',
    group: 'Play',
  },
  {
    icon: 'bi-stopwatch',
    title: 'Rapid Fire',
    description: 'Sixty seconds, as many correct answers as you can chain together.',
    group: 'Play',
  },
  {
    icon: 'bi-shield-shaded',
    title: 'Boss Battles',
    description: 'Defeat the Firewall Guardian and Subnet Overlord by answering unit questions correctly.',
    group: 'Play',
  },
  {
    icon: 'bi-puzzle',
    title: 'Match & Pair',
    description: 'Pair protocols with ports, devices with layers, and terms with definitions.',
    group: 'Play',
  },
  {
    icon: 'bi-question-diamond',
    title: 'Network Riddles',
    description: 'Guess the protocol or device from a clue. Hints cost you XP.',
    group: 'Play',
  },
  {
    icon: 'bi-grid-3x3',
    title: 'Word Search',
    description: 'Hunt networking vocabulary across generated grids in three difficulty modes.',
    group: 'Play',
  },
  {
    icon: 'bi-star',
    title: 'XP, Levels & Streaks',
    description: 'Earn XP for every activity, climb the level ladder, and keep your daily streak alive.',
    group: 'Progress',
  },
  {
    icon: 'bi-graph-up-arrow',
    title: 'Progress Tracking',
    description: 'Topic mastery, unit completion and accuracy trends in one analytics dashboard.',
    group: 'Progress',
  },
  {
    icon: 'bi-wifi-off',
    title: 'Offline Learning',
    description: 'Install CN Quest, study offline, and let your results sync when you reconnect.',
    group: 'Study',
  },
];

export interface StepItem {
  title: string;
  description: string;
}

export const HOW_IT_WORKS: readonly StepItem[] = [
  { title: 'Learn', description: 'Read the topic notes and key definitions for a unit.' },
  { title: 'Practice', description: 'Pick a game mode and answer questions from that topic.' },
  { title: 'Earn XP', description: 'Correct answers, speed and streaks all add to your XP.' },
  { title: 'Level Up', description: 'Cross XP thresholds to unlock new titles and badges.' },
  { title: 'Master Networking', description: 'Track mastery per topic and clear your weak areas.' },
];
