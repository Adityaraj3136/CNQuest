/**
 * Educational content types.
 *
 * These shapes are shared by the bundled seed data, the Firestore documents and the
 * seed-upload script, so all three can never drift apart.
 *
 * This module intentionally has no imports — the Node test runner and the seed script
 * load it directly, without Vite's `@/` path alias.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export type GameType =
  | 'quiz'
  | 'rapid-fire'
  | 'boss'
  | 'matching'
  | 'riddle'
  | 'word-search'
  | 'packet-runner';

export const GAME_TYPES: readonly GameType[] = [
  'quiz',
  'rapid-fire',
  'boss',
  'matching',
  'riddle',
  'word-search',
  'packet-runner',
];

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** A syllabus unit, e.g. "Unit 4 — Network Layer". */
export interface Unit {
  id: string;
  number: number;
  title: string;
  description: string;
  /** Bootstrap Icons class, e.g. `bi-diagram-3`. */
  icon: string;
  order: number;
}

export interface TopicDefinition {
  term: string;
  meaning: string;
}

/** A single studyable topic with its revision notes. */
export interface Topic {
  id: string;
  unitId: string;
  title: string;
  description: string;
  order: number;
  estimatedMinutes: number;

  /**
   * One line naming the problem this topic solves, shown before the notes.
   * Revision reads better when the student knows what the fight is about first.
   */
  hook?: string;

  overview: string;
  keyPoints: string[];
  definitions: TopicDefinition[];
  examples?: string[];

  /**
   * The mistakes that cost marks in exams and break real networks. Kept separate from
   * keyPoints because "what is true" and "what people get wrong" are different questions.
   */
  pitfalls?: string[];

  /**
   * An optional diagram or photograph for the lesson.
   *
   * Networking is a visual subject and a topology is far easier to see than to read. The
   * caption doubles as the alt text, so an image can never ship without one.
   */
  media?: { url: string; caption: string };
  /** Ids of related entries in the networking dictionary. */
  relatedTerms?: string[];
}

export interface Question {
  id: string;
  unitId: string;
  topicId: string;

  question: string;
  options: string[];
  /** Zero-based index into `options`. */
  correctAnswer: number;
  explanation: string;

  difficulty: Difficulty;
  gameTypes: GameType[];
  tags?: string[];
}

export interface Riddle {
  id: string;
  unitId: string;
  topicId: string;
  question: string;
  answer: string;
  /** Extra spellings/abbreviations accepted as correct, compared case-insensitively. */
  acceptedAnswers?: string[];
  hints: string[];
  difficulty: Difficulty;
}

export interface DictionaryTerm {
  id: string;
  term: string;
  definition: string;
  category: DictionaryCategory;
  examples?: string[];
  relatedTerms?: string[];
}

export type DictionaryCategory =
  | 'Protocols'
  | 'Devices'
  | 'OSI'
  | 'Addressing'
  | 'Routing'
  | 'Transport'
  | 'Security'
  | 'Application Layer'
  | 'General';

export const DICTIONARY_CATEGORIES: readonly DictionaryCategory[] = [
  'Protocols',
  'Devices',
  'OSI',
  'Addressing',
  'Routing',
  'Transport',
  'Security',
  'Application Layer',
  'General',
];

export type AchievementCategory = 'progress' | 'accuracy' | 'streak' | 'games' | 'exploration';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** Bootstrap Icons class. */
  icon: string;
  category: AchievementCategory;
  /** Value the tracked counter must reach. */
  target: number;
  rewardXP: number;
}

/** One pairing challenge used by Match & Pair. */
export interface MatchingSet {
  id: string;
  unitId: string;
  topicId: string;
  title: string;
  /** Label for the left column, e.g. "Protocol". */
  leftLabel: string;
  rightLabel: string;
  pairs: Array<{ left: string; right: string }>;
  difficulty: Difficulty;
}

/** A word bank for the Word Search generator. */
export interface WordSearchSet {
  id: string;
  unitId: string;
  topicId: string;
  title: string;
  words: string[];
  difficulty: Difficulty;
}

export interface Boss {
  id: string;
  unitId: string;
  name: string;
  title: string;
  icon: string;
  intro: string;
  defeatLine: string;
  victoryLine: string;
  hp: number;
  playerHp: number;
  /** Difficulty mix the boss draws its questions from. */
  difficulties: Difficulty[];
}
