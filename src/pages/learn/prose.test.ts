/**
 * Prose formatter self-checks. Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { groupSentences, highlightTokens, isWorkedExample, proseHtml, splitSentences } from './prose.ts';
import { TOPICS } from '../../data/topics.ts';

test('splits at sentence ends but not inside decimals or addresses', () => {
  assert.deepEqual(splitSentences('A 2.4 GHz band. Then 192.168.1.0 follows. Done!'), [
    'A 2.4 GHz band.',
    'Then 192.168.1.0 follows.',
    'Done!',
  ]);
});

test('groups sentences into paragraphs by word count', () => {
  const groups = groupSentences(['one two three.', 'four five.', 'six.'], 4);
  assert.deepEqual(groups, [['one two three.', 'four five.'], ['six.']]);
});

test('highlights addresses, bit strings and formulas without nesting', () => {
  const html = highlightTokens('Send 1101001 to 192.168.10.0/24, where C = 2B log2(L), and a /26 block.');
  assert.match(html, /<code>1101001<\/code>/);
  assert.match(html, /<code>192\.168\.10\.0\/24<\/code>/);
  assert.match(html, /<code>C = 2B log2\(L\)<\/code>/);
  assert.match(html, /<code>\/26<\/code>/);
  assert.doesNotMatch(html, /<code>[^<]*<code>/);
});

test('escapes before formatting, so authored text cannot inject markup', () => {
  const html = proseHtml('A <script>x</script> test. Second sentence here.', { className: 'p', lede: true });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /class="p is-lede"/);
});

test('every in-depth section renders without broken or nested code tags', () => {
  for (const topic of TOPICS) {
    for (const section of topic.sections ?? []) {
      const html = proseHtml(section.body, { className: 'b', lede: true });
      const opens = html.match(/<code>/g)?.length ?? 0;
      const closes = html.match(/<\/code>/g)?.length ?? 0;
      assert.equal(opens, closes, `${topic.id}: ${section.heading}`);
      assert.doesNotMatch(html, /<code>[^<]*<code>/, `${topic.id}: ${section.heading}`);
    }
  }
});

test('worked-example headings are recognised', () => {
  assert.equal(isWorkedExample('CRC worked step by step'), true);
  assert.equal(isWorkedExample('A full congestion window trace'), true);
  assert.equal(isWorkedExample('Who writes the rules: standards bodies'), false);
});
