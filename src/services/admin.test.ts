/**
 * Admin editor input self-checks — the boundary between a textarea and Firestore.
 * Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDocumentInput, summarise } from './admin.logic.ts';

test('a well-formed document parses', () => {
  const result = parseDocumentInput('{"id":"t1","title":"Routing"}', 't1');

  assert.ok('data' in result);
  assert.deepEqual(result.data, { id: 't1', title: 'Routing' });
});

test('malformed JSON is rejected with the parser message', () => {
  const result = parseDocumentInput('{"id":', 't1');

  assert.ok('error' in result);
  assert.match(result.error, /Invalid JSON/);
});

test('a JSON array is rejected — a document is an object', () => {
  const result = parseDocumentInput('[{"id":"t1"}]', 't1');

  assert.ok('error' in result);
  assert.match(result.error, /must be a JSON object/);
});

test('null is rejected rather than treated as an empty document', () => {
  const result = parseDocumentInput('null', 't1');

  assert.ok('error' in result);
  assert.match(result.error, /must be a JSON object/);
});

test('a document with no id is rejected', () => {
  const result = parseDocumentInput('{"title":"Routing"}', 't1');

  assert.ok('error' in result);
  assert.match(result.error, /non-empty string "id"/);
});

test('a blank id is rejected', () => {
  const result = parseDocumentInput('{"id":"   "}', 't1');

  assert.ok('error' in result);
  assert.match(result.error, /non-empty string "id"/);
});

test('an id that disagrees with the document being saved is rejected', () => {
  // Otherwise renaming the id in the editor silently writes to a different document.
  const result = parseDocumentInput('{"id":"other"}', 't1');

  assert.ok('error' in result);
  assert.match(result.error, /"other".*"t1"/);
});

test('summarise prefers the first title-like field', () => {
  assert.equal(summarise({ title: 'Routing', name: 'ignored' }), 'Routing');
  assert.equal(summarise({ term: 'Subnet mask' }), 'Subnet mask');
  assert.equal(summarise({ question: 'Which layer?' }), 'Which layer?');
});

test('summarise falls back rather than showing "undefined"', () => {
  assert.equal(summarise({ id: 'x', order: 3 }), '—');
  assert.equal(summarise({ title: '   ' }), '—');
});
