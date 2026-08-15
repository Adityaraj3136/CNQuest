/**
 * Adaptive engine, Version 2 — tabular Q-learning. EXPERIMENTAL, opt-in from Settings.
 *
 * Deliberately kept off the default path. It is here to show the interface really does allow a
 * learned policy to replace the rules without touching a game module, and to be discussed as
 * the reinforcement-learning component of the project.
 *
 * Design notes:
 *  - The state space is bucketed hard (3 × 3 × 2 × 2 = 36 states). A tabular method needs to
 *    revisit states to learn anything, and a student produces very few episodes.
 *  - The objective is *learning gain*, not questions answered: the reward is dominated by
 *    mastery improvement on weak topics, so grinding easy questions scores poorly.
 *  - With an empty table every action ties, so it falls back to the rule-based choice. The
 *    student is never worse off than Version 1.
 */

import type {
  AdaptiveLearningEngine,
  LearningOutcome,
  Recommendation,
  StudentLearningState,
} from './adaptive.types.ts';
import { CONFIDENT_ACCURACY, STRUGGLE_ACCURACY } from './adaptive.types.ts';
import { ruleBasedEngine } from './rule-based.engine.ts';
import type { Difficulty } from '../../models/content.ts';

/** The actions the policy may choose between. */
export const ACTIONS = ['easy', 'medium', 'hard', 'repeat-concept'] as const;
export type QAction = (typeof ACTIONS)[number];

export const HYPERPARAMETERS = {
  /** Learning rate. */
  alpha: 0.3,
  /** Discount factor — future learning still matters, but this session matters more. */
  gamma: 0.7,
  /** Exploration probability. */
  epsilon: 0.15,
} as const;

/** Rewards, tuned so improving on a weak topic beats racking up easy correct answers. */
export const REWARDS = {
  correctEasy: 1,
  correctMedium: 2,
  correctHard: 3,
  improvedWeakTopic: 4,
  wrongAnswer: -1,
  repeatedFailure: -2,
} as const;

export type MasteryBucket = 'low' | 'mid' | 'high';
export type AccuracyBucket = 'struggling' | 'steady' | 'confident';

export interface QState {
  mastery: MasteryBucket;
  accuracy: AccuracyBucket;
  /** Whether the student is answering unusually fast. */
  rushed: boolean;
  /** Whether the last round was weak. */
  recentFailure: boolean;
}

export function bucketMastery(mastery: number): MasteryBucket {
  if (mastery < 40) return 'low';
  if (mastery < 80) return 'mid';
  return 'high';
}

export function bucketAccuracy(accuracy: number): AccuracyBucket {
  if (accuracy < STRUGGLE_ACCURACY) return 'struggling';
  if (accuracy <= CONFIDENT_ACCURACY) return 'steady';
  return 'confident';
}

export function stateKey(state: QState): string {
  return `${state.mastery}|${state.accuracy}|${state.rushed ? 'fast' : 'normal'}|${state.recentFailure ? 'fail' : 'ok'}`;
}

/** Projects the full student state onto the bucketed state the table is keyed by. */
export function toQState(state: StudentLearningState): QState {
  const masteries = Object.values(state.topicMastery);
  const weakest = masteries.length > 0 ? Math.min(...masteries) : 0;

  return {
    mastery: bucketMastery(weakest),
    accuracy: bucketAccuracy(state.recentAccuracy),
    rushed: state.recentResponseTime > 0 && state.recentResponseTime < 4,
    recentFailure: state.consecutiveWeakRounds > 0,
  };
}

export type QTable = Record<string, Partial<Record<QAction, number>>>;

/** Where the table is kept between sessions. Injected so tests can use a plain object. */
export interface QTableStore {
  load(): QTable;
  save(table: QTable): void;
}

/** Reward for one observed outcome, from the table above. */
export function rewardFor(outcome: LearningOutcome): number {
  const improved = outcome.masteryAfter > outcome.masteryBefore;
  const wasWeak = outcome.masteryBefore < 60;

  if (improved && wasWeak) return REWARDS.improvedWeakTopic;

  if (outcome.accuracy < STRUGGLE_ACCURACY) {
    return outcome.masteryAfter <= outcome.masteryBefore ? REWARDS.repeatedFailure : REWARDS.wrongAnswer;
  }

  if (outcome.difficulty === 'hard') return REWARDS.correctHard;
  if (outcome.difficulty === 'medium') return REWARDS.correctMedium;
  return REWARDS.correctEasy;
}

/** Standard Q-learning update: Q(s,a) ← Q(s,a) + α[r + γ·maxQ(s') − Q(s,a)]. */
export function updateQ(
  table: QTable,
  fromKey: string,
  action: QAction,
  reward: number,
  toKey: string,
): QTable {
  const current = table[fromKey]?.[action] ?? 0;
  const nextValues = Object.values(table[toKey] ?? {});
  const maxNext = nextValues.length > 0 ? Math.max(...nextValues) : 0;

  const updated =
    current + HYPERPARAMETERS.alpha * (reward + HYPERPARAMETERS.gamma * maxNext - current);

  return {
    ...table,
    [fromKey]: { ...(table[fromKey] ?? {}), [action]: Number(updated.toFixed(4)) },
  };
}

/** Greedy pick, or null when every action is equally unknown. */
export function bestAction(table: QTable, key: string): QAction | null {
  const row = table[key];
  if (!row) return null;

  let best: QAction | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  let distinct = false;

  for (const action of ACTIONS) {
    const value = row[action];
    if (value === undefined) continue;
    if (best !== null && value !== bestValue) distinct = true;
    if (value > bestValue) {
      bestValue = value;
      best = action;
    }
  }

  // A row where everything ties carries no information — defer to the rules.
  return distinct ? best : null;
}

export class QLearningAdaptiveEngine implements AdaptiveLearningEngine {
  readonly id = 'q-learning' as const;
  readonly label = 'Q-learning (experimental)';

  private lastKey: string | null = null;
  private lastAction: QAction | null = null;

  // Declared as fields rather than constructor parameter properties: Node's type-stripping
  // test runner cannot erase those, and this module is covered by the test suite.
  private readonly store: QTableStore;
  private readonly random: () => number;

  constructor(store: QTableStore, random: () => number = Math.random) {
    this.store = store;
    this.random = random;
  }

  recommendNextActivity(state: StudentLearningState): Recommendation {
    // The rules provide the topic, the wording and the safety net; the policy only chooses
    // the difficulty (or to repeat the concept). That keeps a half-trained table from
    // producing nonsense.
    const fallback = ruleBasedEngine.recommendNextActivity(state);

    const key = stateKey(toQState(state));
    const explore = this.random() < HYPERPARAMETERS.epsilon;
    const action = explore
      ? ACTIONS[Math.floor(this.random() * ACTIONS.length)]
      : bestAction(this.store.load(), key);

    this.lastKey = key;

    if (!action) {
      // Nothing learned for this state yet — Version 1's answer stands.
      this.lastAction = fallback.difficulty as QAction;
      return { ...fallback, source: 'q-learning' };
    }

    this.lastAction = action;

    if (action === 'repeat-concept') {
      return {
        ...fallback,
        action: 'revise-weak-topic',
        difficulty: 'easy',
        source: 'q-learning',
        reason: `${fallback.reason} (Policy: revisit the concept${explore ? ', exploring' : ''}.)`,
      };
    }

    return {
      ...fallback,
      difficulty: action as Difficulty,
      source: 'q-learning',
      reason: `${fallback.reason} (Policy chose ${action}${explore ? ', exploring' : ''}.)`,
    };
  }

  /** Learns from what the recommendation actually produced. */
  observeOutcome(outcome: LearningOutcome): void {
    if (!this.lastKey || !this.lastAction) return;

    const reward = rewardFor(outcome);
    const nextKey = stateKey({
      mastery: bucketMastery(outcome.masteryAfter),
      accuracy: bucketAccuracy(outcome.accuracy),
      rushed: false,
      recentFailure: outcome.accuracy < STRUGGLE_ACCURACY,
    });

    this.store.save(updateQ(this.store.load(), this.lastKey, this.lastAction, reward, nextKey));
    this.lastKey = null;
    this.lastAction = null;
  }
}
