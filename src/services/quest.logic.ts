/**
 * Turning the syllabus into a quest line.
 *
 * A topic is not just a page any more: it has a state the student can read at a glance, and
 * a position in a sequence. This module decides that state, and nothing else — no DOM, no
 * Firestore, so the rules can be tested directly.
 *
 * On "locked": the state exists so the interface can show a clear frontier, but it never
 * blocks navigation. CN Quest is revision software, and a student with an exam tomorrow must
 * be able to open Unit 5 tonight regardless of whether Unit 1 is finished. Locking the door
 * on them would be a game mechanic bought at the cost of the product's actual purpose.
 */

import { UNIT_MASTERED_THRESHOLD } from '../config/progress.config.ts';

export type QuestState = 'completed' | 'current' | 'available' | 'locked';

export interface QuestTopic {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  questionCount: number;
}

export interface RankedQuest extends QuestTopic {
  /** 1-based position within its unit, shown as "Quest 03". */
  number: number;
  state: QuestState;
  mastery: number;
  /** XP a full round on this topic is worth, used as the carrot on the card. */
  rewardXp: number;
}

/** A topic counts as done once its mastery reaches the same bar a unit is judged by. */
export function isTopicComplete(mastery: number): boolean {
  return mastery >= UNIT_MASTERED_THRESHOLD;
}

/** Roughly what a clean round on this topic pays. Ten XP a question, rounded to something readable. */
export function questReward(questionCount: number): number {
  const perQuestion = 10;
  const capped = Math.min(questionCount, 10);
  return Math.max(20, capped * perQuestion);
}

/**
 * Assigns a state to every topic in one unit.
 *
 * Exactly one topic is `current`: the first unfinished one, which is the single place the
 * student should look when they do not want to make a decision. Everything after it is
 * `available` while the unit has been started, and `locked` when it has not, so an untouched
 * unit reads as a closed chapter rather than a wall of equal choices.
 */
export function rankUnitQuests(
  topics: readonly QuestTopic[],
  masteryByTopic: Readonly<Record<string, number>>,
  options: { unitStarted: boolean } = { unitStarted: true },
): RankedQuest[] {
  let currentAssigned = false;

  return topics.map((topic, index) => {
    const mastery = masteryByTopic[topic.id] ?? 0;
    const complete = isTopicComplete(mastery);

    let state: QuestState;
    if (complete) {
      state = 'completed';
    } else if (!currentAssigned) {
      state = 'current';
      currentAssigned = true;
    } else {
      state = options.unitStarted ? 'available' : 'locked';
    }

    return {
      ...topic,
      number: index + 1,
      state,
      mastery: Math.round(mastery),
      rewardXp: questReward(topic.questionCount),
    };
  });
}

export interface UnitSummary {
  questCount: number;
  completedCount: number;
  questionCount: number;
  mastery: number;
  /** True once every quest in the unit is complete. */
  mastered: boolean;
  started: boolean;
}

/** Headline figures for a unit card: how far through it the student is. */
export function summariseUnit(
  topics: readonly QuestTopic[],
  masteryByTopic: Readonly<Record<string, number>>,
): UnitSummary {
  const questionCount = topics.reduce((sum, topic) => sum + topic.questionCount, 0);

  if (topics.length === 0) {
    return { questCount: 0, completedCount: 0, questionCount, mastery: 0, mastered: false, started: false };
  }

  const masteries = topics.map((topic) => masteryByTopic[topic.id] ?? 0);
  const completedCount = masteries.filter(isTopicComplete).length;
  const total = masteries.reduce((sum, value) => sum + value, 0);

  return {
    questCount: topics.length,
    completedCount,
    questionCount,
    mastery: Math.round(total / topics.length),
    mastered: completedCount === topics.length,
    started: masteries.some((value) => value > 0),
  };
}
