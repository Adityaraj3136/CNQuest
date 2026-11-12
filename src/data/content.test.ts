/**
 * Seed-data integrity and content-selection self-checks. Run with: npm run test:units
 *
 * These guard the references that silently break games: a question pointing at a topic that
 * was renamed, an out-of-range correct answer, or a duplicate id shadowing another entry.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { UNITS } from './units.ts';
import { TOPICS } from './topics.ts';
import { TOPIC_SECTIONS } from './topics.depth.ts';
import { QUESTIONS } from './questions.ts';
import { RIDDLES } from './riddles.ts';
import { DICTIONARY } from './dictionary.ts';
import { ACHIEVEMENTS } from './achievements.ts';
import { BOSSES, MATCHING_SETS, WORD_SEARCH_SETS } from './games.ts';
import {
  filterQuestions,
  isRiddleAnswerCorrect,
  normaliseAnswer,
  pickQuestions,
  randomizeQuestionOptions,
  searchDictionary,
  shuffle,
  topicsForUnit,
} from '../services/content.filters.ts';

const unitIds = new Set(UNITS.map((unit) => unit.id));
const topicIds = new Set(TOPICS.map((topic) => topic.id));
const dictionaryIds = new Set(DICTIONARY.map((entry) => entry.id));

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

// ---------------- Integrity ----------------

test('ids are unique within every collection', () => {
  for (const [name, ids] of [
    ['units', UNITS.map((x) => x.id)],
    ['topics', TOPICS.map((x) => x.id)],
    ['questions', QUESTIONS.map((x) => x.id)],
    ['riddles', RIDDLES.map((x) => x.id)],
    ['dictionary', DICTIONARY.map((x) => x.id)],
    ['achievements', ACHIEVEMENTS.map((x) => x.id)],
    ['matching sets', MATCHING_SETS.map((x) => x.id)],
    ['word search sets', WORD_SEARCH_SETS.map((x) => x.id)],
    ['bosses', BOSSES.map((x) => x.id)],
  ] as const) {
    assert.deepEqual(duplicates(ids), [], `duplicate ids in ${name}`);
  }
});

test('every topic belongs to a real unit', () => {
  for (const topic of TOPICS) {
    assert.ok(unitIds.has(topic.unitId), `topic ${topic.id} → unknown unit ${topic.unitId}`);
  }
});

test('every question points at a real unit and topic', () => {
  for (const question of QUESTIONS) {
    assert.ok(unitIds.has(question.unitId), `${question.id} → unknown unit ${question.unitId}`);
    assert.ok(topicIds.has(question.topicId), `${question.id} → unknown topic ${question.topicId}`);
  }
});

test("a question's topic belongs to the unit the question claims", () => {
  const topicUnit = new Map(TOPICS.map((topic) => [topic.id, topic.unitId]));
  for (const question of QUESTIONS) {
    assert.equal(topicUnit.get(question.topicId), question.unitId, `unit mismatch on ${question.id}`);
  }
});

test('every question has 4 distinct options and an in-range answer', () => {
  for (const question of QUESTIONS) {
    assert.equal(question.options.length, 4, `${question.id} does not have 4 options`);
    assert.equal(
      new Set(question.options).size,
      4,
      `${question.id} has duplicate options`,
    );
    assert.ok(
      question.correctAnswer >= 0 && question.correctAnswer < question.options.length,
      `${question.id} correctAnswer out of range`,
    );
    assert.ok(question.explanation.length > 15, `${question.id} needs a real explanation`);
    assert.ok(question.gameTypes.length > 0, `${question.id} is usable by no game`);
  }
});

test('every riddle and game set references real units and topics', () => {
  for (const item of [...RIDDLES, ...MATCHING_SETS, ...WORD_SEARCH_SETS]) {
    assert.ok(unitIds.has(item.unitId), `${item.id} → unknown unit ${item.unitId}`);
    assert.ok(topicIds.has(item.topicId), `${item.id} → unknown topic ${item.topicId}`);
  }
  for (const boss of BOSSES) {
    assert.ok(unitIds.has(boss.unitId), `${boss.id} → unknown unit ${boss.unitId}`);
  }
});

test('every topic has in-depth sections the admin editor can round-trip', () => {
  for (const id of Object.keys(TOPIC_SECTIONS)) assert.ok(topicIds.has(id), `sections for unknown topic "${id}"`);
  for (const topic of TOPICS) {
    const sections = topic.sections ?? [];
    assert.ok(sections.length >= 4, `${topic.id} has ${sections.length} in-depth sections`);
    for (const { heading, body } of sections) {
      // The editor stores one "Heading | Body" line per section, split on the first "|".
      assert.ok(heading.trim() && !heading.includes('|'), `${topic.id}: bad heading "${heading}"`);
      assert.ok(!/[\r\n]/.test(heading + body), `${topic.id}: "${heading}" contains a line break`);
      assert.ok(body.split(/\s+/).length >= 60, `${topic.id}: "${heading}" is too thin`);
    }
  }
});

test('topic relatedTerms resolve to dictionary entries', () => {
  for (const topic of TOPICS) {
    for (const termId of topic.relatedTerms ?? []) {
      assert.ok(dictionaryIds.has(termId), `topic ${topic.id} → unknown dictionary term ${termId}`);
    }
  }
});

test('dictionary relatedTerms resolve to dictionary entries', () => {
  for (const entry of DICTIONARY) {
    for (const termId of entry.relatedTerms ?? []) {
      assert.ok(dictionaryIds.has(termId), `${entry.id} → unknown related term ${termId}`);
    }
  }
});

test('every unit has topics, and every topic has questions', () => {
  for (const unit of UNITS) {
    assert.ok(topicsForUnit(TOPICS, unit.id).length > 0, `unit ${unit.id} has no topics`);
  }
  for (const topic of TOPICS) {
    const count = filterQuestions(QUESTIONS, { topicId: topic.id }).length;
    assert.ok(count >= 4, `topic ${topic.id} has only ${count} questions`);
  }
});

test('seed volume meets the Phase 3 targets', () => {
  assert.ok(QUESTIONS.length >= 60, `expected 60+ questions, found ${QUESTIONS.length}`);
  assert.ok(RIDDLES.length >= 10, `expected 10+ riddles, found ${RIDDLES.length}`);
  assert.ok(DICTIONARY.length >= 25, `expected 25+ dictionary terms, found ${DICTIONARY.length}`);
  assert.ok(ACHIEVEMENTS.length >= 8, `expected 8+ achievements, found ${ACHIEVEMENTS.length}`);
  assert.ok(BOSSES.length >= 2, `expected 2+ bosses, found ${BOSSES.length}`);
});

test('every achievement target is actually reachable from the seed data', () => {
  const explorer = ACHIEVEMENTS.find((a) => a.id === 'dictionary-explorer');
  assert.ok(
    explorer && DICTIONARY.length >= explorer.target,
    `Dictionary Explorer needs ${explorer?.target} terms but only ${DICTIONARY.length} exist`,
  );

  const riddleSolver = ACHIEVEMENTS.find((a) => a.id === 'riddle-solver');
  assert.ok(
    riddleSolver && RIDDLES.length >= riddleSolver.target,
    `Riddle Solver needs ${riddleSolver?.target} riddles but only ${RIDDLES.length} exist`,
  );

  const allRounder = ACHIEVEMENTS.find((a) => a.id === 'all-rounder');
  assert.equal(allRounder?.target, 6, 'All-Rounder must match the number of game modes');
});

test('all three difficulties are represented', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const count = filterQuestions(QUESTIONS, { difficulty }).length;
    assert.ok(count >= 10, `only ${count} ${difficulty} questions`);
  }
});

test('matching pairs are unambiguous', () => {
  for (const set of MATCHING_SETS) {
    assert.ok(set.pairs.length >= 4, `${set.id} needs at least 4 pairs`);
    assert.equal(new Set(set.pairs.map((p) => p.left)).size, set.pairs.length, `${set.id} duplicate left`);
    assert.equal(new Set(set.pairs.map((p) => p.right)).size, set.pairs.length, `${set.id} duplicate right`);
  }
});

test('word search words are upper case and grid-friendly', () => {
  for (const set of WORD_SEARCH_SETS) {
    for (const word of set.words) {
      assert.match(word, /^[A-Z]{3,12}$/, `${set.id}: "${word}" is not a usable grid word`);
    }
  }
});

// ---------------- Selection logic ----------------

test('filterQuestions honours every criterion', () => {
  const easyOsi = filterQuestions(QUESTIONS, { topicId: 'osi-model', difficulty: 'easy' });
  assert.ok(easyOsi.length > 0);
  assert.ok(easyOsi.every((q) => q.topicId === 'osi-model' && q.difficulty === 'easy'));

  const forRiddleGame = filterQuestions(QUESTIONS, { gameType: 'riddle' });
  assert.equal(forRiddleGame.length, 0, 'MCQs must not leak into the riddle game');
});

test('filterQuestions excludes already-asked ids', () => {
  const [first] = filterQuestions(QUESTIONS, { topicId: 'subnetting' });
  const rest = filterQuestions(QUESTIONS, { topicId: 'subnetting', exclude: [first.id] });
  assert.ok(!rest.some((q) => q.id === first.id));
});

test('pickQuestions returns the requested count without repeats', () => {
  const round = pickQuestions(QUESTIONS, 10, { gameType: 'quiz' });
  assert.equal(round.length, 10);
  assert.equal(new Set(round.map((q) => q.id)).size, 10);
});

test('randomizeQuestionOptions preserves correct answer text while shuffling options', () => {
  const sample = QUESTIONS[0];
  const originalCorrectText = sample.options[sample.correctAnswer];

  const randomized = randomizeQuestionOptions(sample);
  assert.equal(randomized.options.length, 4);
  assert.equal(randomized.options[randomized.correctAnswer], originalCorrectText);
  assert.deepEqual([...randomized.options].sort(), [...sample.options].sort());
});

test('questions seed answers are balanced across all 4 options', () => {
  const counts = [0, 0, 0, 0];
  for (const q of QUESTIONS) {
    counts[q.correctAnswer]++;
  }
  // Every option A, B, C, D should have at least 15% of the total questions
  const minExpected = Math.floor(QUESTIONS.length * 0.15);
  for (let i = 0; i < 4; i++) {
    assert.ok(counts[i] >= minExpected, `Option ${i} only has ${counts[i]} answers out of ${QUESTIONS.length}`);
  }
});

test('shuffle does not mutate its input or lose items', () => {
  const source = QUESTIONS.slice(0, 8);
  const before = source.map((q) => q.id);
  const shuffled = shuffle(source);

  assert.deepEqual(source.map((q) => q.id), before, 'source array was mutated');
  assert.deepEqual([...shuffled.map((q) => q.id)].sort(), [...before].sort());
});

test('riddle answers are matched leniently but not loosely', () => {
  const dns = RIDDLES.find((r) => r.id === 'r-dns');
  assert.ok(dns);

  assert.equal(isRiddleAnswerCorrect(dns, 'dns'), true);
  assert.equal(isRiddleAnswerCorrect(dns, '  DNS  '), true);
  assert.equal(isRiddleAnswerCorrect(dns, 'Domain   Name System'), true);
  assert.equal(isRiddleAnswerCorrect(dns, 'D.N.S.'), true);
  assert.equal(isRiddleAnswerCorrect(dns, 'DHCP'), false);
  assert.equal(isRiddleAnswerCorrect(dns, ''), false);
  assert.equal(normaliseAnswer('  Optical   Fibre! '), 'optical fibre');
});

test('dictionary search matches term, definition and category', () => {
  assert.ok(searchDictionary(DICTIONARY, 'subnet').length > 0);
  assert.ok(searchDictionary(DICTIONARY, 'ROUTING').length > 0);
  assert.ok(searchDictionary(DICTIONARY, 'encrypt').length > 0);
  assert.equal(searchDictionary(DICTIONARY, '').length, DICTIONARY.length);
  assert.equal(searchDictionary(DICTIONARY, 'zzzznope').length, 0);
});
