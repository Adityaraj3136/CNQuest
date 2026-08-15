/**
 * What the player should do next, decided from real progress alone.
 *
 * The Progress page's job is not to report numbers back at a student; it is to answer "what
 * now". That answer has to come from actual state, because a recommendation the app cannot
 * back up is worse than no recommendation: it sends someone to a topic that was not close,
 * or promises a level that is not near.
 *
 * Pure: no DOM, no Firestore, so every branch is testable.
 */

import { UNIT_MASTERED_THRESHOLD } from '../config/progress.config.ts';

export type GoalKind = 'first-quest' | 'finish-topic' | 'next-level' | 'keep-streak' | 'all-clear';

export interface GoalInput {
  questionsAnswered: number;
  /** XP still needed for the next level, and what that level is called. */
  xpToNextLevel: number;
  nextLevelTitle: string;
  currentStreak: number;
  /** Whether the streak has lapsed and today has not been played. */
  streakAtRisk: boolean;
  /** Topics with any progress at all, highest mastery first is not required. */
  topics: ReadonlyArray<{ id: string; title: string; mastery: number }>;
}

export interface Goal {
  kind: GoalKind;
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
}

/** One Quiz Blitz is worth roughly this much, used to say whether a level is one round away. */
const TYPICAL_ROUND_XP = 120;

/**
 * Picks a single next goal.
 *
 * Ordered by what would most change the student's position, not by what is easiest to
 * render: a lapsing streak is time-critical, an almost-mastered topic is the cheapest real
 * win, and a level within one round is the most motivating thing to say when neither applies.
 */
export function nextGoal(input: GoalInput): Goal {
  const { questionsAnswered, xpToNextLevel, nextLevelTitle, streakAtRisk, currentStreak } = input;

  if (questionsAnswered === 0) {
    return {
      kind: 'first-quest',
      title: 'Play your first round',
      detail: 'Answer a few questions and your mastery starts building here.',
      actionLabel: 'Start first quest',
      actionHref: '#/learn',
    };
  }

  if (streakAtRisk && currentStreak > 0) {
    return {
      kind: 'keep-streak',
      title: 'Keep your streak alive',
      detail: `Your ${currentStreak} day streak lapses unless you play today.`,
      actionLabel: 'Play a round',
      actionHref: '#/games/quiz',
    };
  }

  // The cheapest genuine win: a topic already close to the mastery bar.
  const nearest = [...input.topics]
    .filter((topic) => topic.mastery > 0 && topic.mastery < UNIT_MASTERED_THRESHOLD)
    .sort((a, b) => b.mastery - a.mastery)[0];

  if (nearest) {
    const gap = Math.max(1, Math.round(UNIT_MASTERED_THRESHOLD - nearest.mastery));
    return {
      kind: 'finish-topic',
      title: `Master ${nearest.title}`,
      detail: `${Math.round(nearest.mastery)}% mastered. About ${gap}% to go.`,
      actionLabel: 'Continue practice',
      actionHref: `#/games/quiz?topic=${encodeURIComponent(nearest.id)}`,
    };
  }

  if (xpToNextLevel > 0) {
    return {
      kind: 'next-level',
      title: `Reach ${nextLevelTitle}`,
      detail:
        xpToNextLevel <= TYPICAL_ROUND_XP
          ? `${xpToNextLevel} XP to go. One good round could do it.`
          : `${xpToNextLevel} XP to go.`,
      actionLabel: 'Play Quiz Blitz',
      actionHref: '#/games/quiz',
    };
  }

  return {
    kind: 'all-clear',
    title: 'Every topic mastered',
    detail: 'Nothing left to master. Replay anything you want to keep sharp.',
    actionLabel: 'Pick a challenge',
    actionHref: '#/games',
  };
}

// ---------------------------------------------------------------- unit states

export type UnitState = 'mastered' | 'current' | 'started' | 'locked';

/**
 * A state per unit for the journey path.
 *
 * Exactly one unit is `current`: the first that is started but not finished, or failing that
 * the first untouched one. Without that single marker the path is six equal dots and the
 * student has to work out where they are.
 */
export function unitStates(masteries: readonly number[]): UnitState[] {
  let currentAssigned = false;

  return masteries.map((mastery) => {
    if (mastery >= UNIT_MASTERED_THRESHOLD) return 'mastered';

    if (!currentAssigned) {
      currentAssigned = true;
      return 'current';
    }

    return mastery > 0 ? 'started' : 'locked';
  });
}

/**
 * How far along the host → switch → router → server metaphor the student is.
 *
 * Four stages across the whole syllabus, so each one is earned rather than handed over for
 * opening the app.
 */
export function networkStage(overallMastery: number): number {
  if (overallMastery >= 75) return 4;
  if (overallMastery >= 50) return 3;
  if (overallMastery >= 25) return 2;
  if (overallMastery > 0) return 1;
  return 0;
}
