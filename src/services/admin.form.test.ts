/**
 * Admin form self-checks — a form that silently drops or mangles a field is worse than none.
 * Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDocument, suggestId, toFieldValue } from './admin.form.logic.ts';
import { fieldsFor } from './admin.schema.ts';
import type { FieldSpec } from './admin.schema.ts';

const TEXT: FieldSpec = { key: 'title', label: 'Title', kind: 'text', required: true };
const LIST: FieldSpec = { key: 'keyPoints', label: 'Key points', kind: 'list' };
const PAIRS: FieldSpec = {
  key: 'definitions',
  label: 'Definitions',
  kind: 'pairs',
  pairKeys: ['term', 'meaning'],
};

// ---------------------------------------------------------------- document → form

test('a list renders one entry per line', () => {
  assert.equal(toFieldValue(LIST, ['alpha', 'beta']), 'alpha\nbeta');
});

test('pairs render as "left | right"', () => {
  const value = toFieldValue(PAIRS, [{ term: 'MTU', meaning: 'Largest frame' }]);
  assert.equal(value, 'MTU | Largest frame');
});

test('a missing optional field renders blank, not "undefined"', () => {
  assert.equal(toFieldValue(LIST, undefined), '');
  assert.equal(toFieldValue(TEXT, null), '');
});

test('the correct answer is shown counting from 1', () => {
  const spec: FieldSpec = { key: 'correctAnswer', label: 'Correct', kind: 'number' };
  assert.equal(toFieldValue(spec, 0), '1');
  assert.equal(toFieldValue(spec, 2), '3');
});

// ---------------------------------------------------------------- form → document

test('a filled form becomes the document', () => {
  const { data, errors } = buildDocument([TEXT, LIST], 'topic-osi', {
    title: 'The OSI Model',
    keyPoints: 'Seven layers\nEncapsulation',
  });

  assert.deepEqual(errors, {});
  assert.deepEqual(data, {
    id: 'topic-osi',
    title: 'The OSI Model',
    keyPoints: ['Seven layers', 'Encapsulation'],
  });
});

test('a blank optional field is omitted rather than written as an empty array', () => {
  const { data } = buildDocument([TEXT, LIST], 'topic-osi', { title: 'X', keyPoints: '  \n ' });

  assert.equal('keyPoints' in data, false);
});

test('a missing required field is reported against that field', () => {
  const { errors } = buildDocument([TEXT], 'topic-osi', { title: '   ' });

  assert.match(errors.title, /required/);
});

test('an id is always required', () => {
  const { errors } = buildDocument([TEXT], '  ', { title: 'X' });

  assert.match(errors.id, /id is required/);
});

test('the correct answer round-trips to a zero-based index', () => {
  const specs = fieldsFor('questions');
  const { data, errors } = buildDocument(specs, 'q1', {
    unitId: 'unit-1',
    topicId: 'topic-1',
    question: 'Which layer?',
    options: 'Physical\nData link\nNetwork',
    correctAnswer: '3',
    explanation: 'Because.',
    difficulty: 'easy',
    gameTypes: ['quiz'],
  });

  assert.deepEqual(errors, {});
  assert.equal(data.correctAnswer, 2);
});

test('a correct answer past the end of the options is rejected', () => {
  // Saves cleanly otherwise, then shows students a question with no right answer.
  const specs = fieldsFor('questions');
  const { errors } = buildDocument(specs, 'q1', {
    unitId: 'unit-1',
    topicId: 'topic-1',
    question: 'Which layer?',
    options: 'Physical\nData link',
    correctAnswer: '4',
    explanation: 'Because.',
    difficulty: 'easy',
    gameTypes: ['quiz'],
  });

  assert.match(errors.correctAnswer, /between 1 and 2/);
});

test('a pair line with no separator is rejected', () => {
  const { errors } = buildDocument([PAIRS], 'topic-osi', { definitions: 'MTU means something' });

  assert.match(errors.definitions, /needs a "\|"/);
});

test('a pair line missing one half is rejected', () => {
  const { errors } = buildDocument([PAIRS], 'topic-osi', { definitions: 'MTU |' });

  assert.match(errors.definitions, /Both halves/);
});

test('pairs build the object keys the model expects', () => {
  const { data } = buildDocument([PAIRS], 'topic-osi', { definitions: 'MTU | Largest frame' });

  assert.deepEqual(data.definitions, [{ term: 'MTU', meaning: 'Largest frame' }]);
});

test('a non-numeric number is reported rather than saved as NaN', () => {
  const spec: FieldSpec = { key: 'order', label: 'Sort order', kind: 'number', required: true };
  const { errors } = buildDocument([spec], 'unit-1', { order: 'first' });

  assert.match(errors.order, /must be a number/);
});

test('required checkboxes need at least one choice', () => {
  const spec: FieldSpec = {
    key: 'gameTypes',
    label: 'Game modes',
    kind: 'checkboxes',
    options: ['quiz'],
    required: true,
  };
  const { errors } = buildDocument([spec], 'q1', { gameTypes: [] });

  assert.match(errors.gameTypes, /at least one/);
});

// ---------------------------------------------------------------- id suggestion

test('an id is suggested from the title', () => {
  assert.equal(suggestId('topics', 'The OSI Model'), 'topic-the-osi-model');
  assert.equal(suggestId('dictionary', 'Subnet Mask'), 'dictionary-subnet-mask');
});

test('punctuation and repeated spaces collapse to single hyphens', () => {
  assert.equal(suggestId('units', '  Unit 4 — Network  Layer! '), 'unit-unit-4-network-layer');
});

test('a title with no usable characters suggests nothing rather than a bare prefix', () => {
  assert.equal(suggestId('topics', '!!!'), '');
});

// ---------------------------------------------------------------- schema coverage

test('every editable collection has a field schema', () => {
  const collections = [
    'units',
    'topics',
    'questions',
    'riddles',
    'dictionary',
    'achievements',
    'matchingSets',
    'wordSearchSets',
    'bosses',
  ];

  for (const id of collections) {
    assert.ok(fieldsFor(id).length > 0, `${id} has no form fields`);
  }
});
