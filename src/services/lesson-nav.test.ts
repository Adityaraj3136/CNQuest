/**
 * Lesson navigation self-checks. Run with: npm run test:units
 *
 * The edge cases are the point: a student reaching the bottom of a lesson must always have
 * somewhere to go, including at both ends of the syllabus.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { lessonPosition } from './lesson-nav.logic.ts';
import type { NavTopic, NavUnit } from './lesson-nav.logic.ts';

const units: NavUnit[] = [
  { id: 'u1', number: 1, title: 'Foundations', order: 1 },
  { id: 'u2', number: 2, title: 'Physical Layer', order: 2 },
];

const topics: NavTopic[] = [
  { id: 't1', title: 'Introduction', unitId: 'u1', order: 1 },
  { id: 't2', title: 'Topologies', unitId: 'u1', order: 2 },
  { id: 't3', title: 'OSI Model', unitId: 'u1', order: 3 },
  { id: 't4', title: 'Transmission Media', unitId: 'u2', order: 1 },
  { id: 't5', title: 'Switching', unitId: 'u2', order: 2 },
];

test('a middle lesson links to the topics either side of it', () => {
  const position = lessonPosition('t2', units, topics)!;

  assert.equal(position.previous.label, 'Introduction');
  assert.equal(position.next.label, 'OSI Model');
  assert.equal(position.previous.kind, 'topic');
  assert.equal(position.next.kind, 'topic');
});

test('position is reported as one-based within its own unit', () => {
  const position = lessonPosition('t2', units, topics)!;

  assert.equal(position.index, 2);
  assert.equal(position.total, 3);
  assert.equal(position.unit.title, 'Foundations');
});

test('the last lesson of a unit leads into the next unit, not nowhere', () => {
  const position = lessonPosition('t3', units, topics)!;

  assert.equal(position.next.kind, 'unit');
  assert.equal(position.next.label, 'Physical Layer');
  assert.match(position.next.href, /t4/);
});

test('the first lesson of a later unit steps back into the previous unit', () => {
  const position = lessonPosition('t4', units, topics)!;

  assert.equal(position.previous.kind, 'unit');
  assert.equal(position.previous.label, 'OSI Model');
  assert.match(position.previous.caption, /Foundations/);
});

test('the very first lesson still offers a way out rather than a dead link', () => {
  const position = lessonPosition('t1', units, topics)!;

  assert.equal(position.previous.kind, 'syllabus-start');
  assert.equal(position.previous.href, '#/learn');
});

test('the very last lesson ends the syllabus somewhere useful', () => {
  const position = lessonPosition('t5', units, topics)!;

  assert.equal(position.next.kind, 'syllabus-end');
  assert.equal(position.next.href, '#/progress');
});

test('siblings come back in syllabus order for the quest strip', () => {
  const position = lessonPosition('t1', units, topics)!;

  assert.deepEqual(
    position.siblings.map((topic) => topic.id),
    ['t1', 't2', 't3'],
  );
});

test('ordering is respected even when the data arrives shuffled', () => {
  const shuffled = [topics[2], topics[0], topics[1]];
  const position = lessonPosition('t1', units, shuffled)!;

  assert.equal(position.next.label, 'Topologies');
  assert.equal(position.index, 1);
});

test('a unit with a single lesson bridges both ways', () => {
  const soloUnits: NavUnit[] = [
    { id: 'a', number: 1, title: 'One', order: 1 },
    { id: 'b', number: 2, title: 'Two', order: 2 },
  ];
  const soloTopics: NavTopic[] = [
    { id: 'x', title: 'Only', unitId: 'a', order: 1 },
    { id: 'y', title: 'Also only', unitId: 'b', order: 1 },
  ];

  const position = lessonPosition('y', soloUnits, soloTopics)!;
  assert.equal(position.previous.kind, 'unit');
  assert.equal(position.next.kind, 'syllabus-end');
});

test('an unknown topic reports nothing rather than half a navigation bar', () => {
  assert.equal(lessonPosition('missing', units, topics), null);
});

test('a topic whose unit does not exist is treated as missing', () => {
  const orphan: NavTopic[] = [{ id: 'z', title: 'Orphan', unitId: 'gone', order: 1 }];

  assert.equal(lessonPosition('z', units, orphan), null);
});
