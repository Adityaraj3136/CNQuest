/**
 * Pure selection helpers for educational content.
 *
 * Kept free of Firebase and Vite aliases so both the app and the Node test runner can use them.
 * ContentService handles the I/O; everything here is deterministic given its inputs.
 */

import type { Difficulty, GameType, Question, Riddle, Topic } from '../models/content.ts';

export interface QuestionFilter {
  topicId?: string;
  unitId?: string;
  difficulty?: Difficulty;
  gameType?: GameType;
  /** Question ids to leave out, e.g. ones already asked this round. */
  exclude?: readonly string[];
}

export function filterQuestions(
  questions: readonly Question[],
  filter: QuestionFilter = {},
): Question[] {
  const excluded = new Set(filter.exclude ?? []);

  return questions.filter((question) => {
    if (excluded.has(question.id)) return false;
    if (filter.topicId && question.topicId !== filter.topicId) return false;
    if (filter.unitId && question.unitId !== filter.unitId) return false;
    if (filter.difficulty && question.difficulty !== filter.difficulty) return false;
    if (filter.gameType && !question.gameTypes.includes(filter.gameType)) return false;
    return true;
  });
}

/** Fisher-Yates on a copy — never mutates the source array. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Randomises the order of options for a question, updating correctAnswer to match.
 * Prevents answer position bias (e.g. mostly B) and ensures every round is truly random.
 */
export function randomizeQuestionOptions(
  question: Question,
  random: () => number = Math.random,
): Question {
  const correctOptionText = question.options[question.correctAnswer];
  const shuffledOptions = shuffle(question.options, random);
  const newCorrectAnswer = shuffledOptions.indexOf(correctOptionText);

  return {
    ...question,
    options: shuffledOptions,
    correctAnswer: newCorrectAnswer,
  };
}

/**
 * Picks up to `count` questions matching the filter.
 *
 * Falls back progressively rather than returning an empty round: if the exact filter has too
 * few questions, the difficulty constraint is dropped, then the topic constraint widens to the
 * unit. A game always gets something to ask.
 */
export function pickQuestions(
  questions: readonly Question[],
  count: number,
  filter: QuestionFilter = {},
  random: () => number = Math.random,
): Question[] {
  const attempts: QuestionFilter[] = [
    filter,
    { ...filter, difficulty: undefined },
    { ...filter, difficulty: undefined, topicId: undefined },
    { gameType: filter.gameType, exclude: filter.exclude },
  ];

  for (const attempt of attempts) {
    const matches = filterQuestions(questions, attempt);
    if (matches.length >= count) {
      return shuffle(matches, random)
        .slice(0, count)
        .map((q) => randomizeQuestionOptions(q, random));
    }
  }

  // Nothing satisfied the count — return the widest match we found, however small.
  return shuffle(filterQuestions(questions, { gameType: filter.gameType }), random)
    .slice(0, count)
    .map((q) => randomizeQuestionOptions(q, random));
}

export function filterRiddles(
  riddles: readonly Riddle[],
  filter: { topicId?: string; unitId?: string; difficulty?: Difficulty } = {},
): Riddle[] {
  return riddles.filter((riddle) => {
    if (filter.topicId && riddle.topicId !== filter.topicId) return false;
    if (filter.unitId && riddle.unitId !== filter.unitId) return false;
    if (filter.difficulty && riddle.difficulty !== filter.difficulty) return false;
    return true;
  });
}

/** Normalises a typed riddle answer: trims, collapses spaces, strips punctuation, lowercases. */
export function normaliseAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function isRiddleAnswerCorrect(riddle: Riddle, attempt: string): boolean {
  const normalised = normaliseAnswer(attempt);
  if (!normalised) return false;
  return [riddle.answer, ...(riddle.acceptedAnswers ?? [])].some(
    (accepted) => normaliseAnswer(accepted) === normalised,
  );
}

export function topicsForUnit(topics: readonly Topic[], unitId: string): Topic[] {
  return topics.filter((topic) => topic.unitId === unitId).sort((a, b) => a.order - b.order);
}

/** Case-insensitive search across a term, its definition and its category. */
export function searchDictionary<T extends { term: string; definition: string; category: string }>(
  terms: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...terms];
  return terms.filter(
    (entry) =>
      entry.term.toLowerCase().includes(needle) ||
      entry.definition.toLowerCase().includes(needle) ||
      entry.category.toLowerCase().includes(needle),
  );
}
