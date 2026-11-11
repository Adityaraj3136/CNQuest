/**
 * Achievement catalogue.
 *
 * `target` is the value the tracked counter must reach; Phase 5's AchievementService owns
 * the counters and the unlock check, so nothing here encodes UI behaviour.
 */

import type { Achievement } from '../models/content.ts';

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Complete your first challenge.',
    icon: 'bi-flag',
    category: 'progress',
    target: 1,
    rewardXP: 25,
  },
  {
    id: 'quiz-master',
    name: 'Quiz Master',
    description: 'Answer 100 questions correctly.',
    icon: 'bi-mortarboard',
    category: 'progress',
    target: 100,
    rewardXP: 100,
  },
  {
    id: 'on-fire',
    name: 'On Fire',
    description: 'Maintain a seven-day learning streak.',
    icon: 'bi-fire',
    category: 'streak',
    target: 7,
    rewardXP: 75,
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Score 90% or higher in a Rapid Fire round.',
    icon: 'bi-stopwatch',
    category: 'accuracy',
    target: 90,
    rewardXP: 60,
  },
  {
    id: 'boss-slayer',
    name: 'Boss Slayer',
    description: 'Win your first Boss Battle.',
    icon: 'bi-shield-check',
    category: 'games',
    target: 1,
    rewardXP: 80,
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Score 100% in a Quiz Blitz round.',
    icon: 'bi-patch-check',
    category: 'accuracy',
    target: 100,
    rewardXP: 70,
  },
  {
    id: 'dictionary-explorer',
    name: 'Dictionary Explorer',
    description: 'View 50 networking dictionary terms.',
    icon: 'bi-journal-text',
    category: 'exploration',
    target: 50,
    rewardXP: 40,
  },
  {
    id: 'riddle-solver',
    name: 'Riddle Solver',
    description: 'Solve 10 network riddles without using a hint.',
    icon: 'bi-question-diamond',
    category: 'games',
    target: 10,
    rewardXP: 60,
  },
  {
    id: 'all-rounder',
    name: 'All-Rounder',
    description: 'Play six different game modes at least once.',
    icon: 'bi-controller',
    category: 'games',
    target: 6,
    rewardXP: 90,
  },
  {
    id: 'network-expert',
    name: 'Network Expert',
    description: 'Reach 80% mastery in every unit.',
    icon: 'bi-trophy',
    category: 'progress',
    target: 6,
    rewardXP: 250,
  },
];
