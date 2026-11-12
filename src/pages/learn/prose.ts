/**
 * Turns a long plain-text paragraph into something easier to read on a phone: short
 * paragraphs split at sentence boundaries, an optional lead sentence, and addresses, bit
 * strings and formulas set in monospace so the numbers in a worked example stand out.
 *
 * Content stays plain text (that is how the admin editor stores it); all formatting is
 * derived here, after escaping, so nothing an author types can inject markup.
 * Relative imports only, so the Node test runner can load it.
 */

import { escapeHtml } from '../../utils/dom.ts';

/** Paragraphs break after this many words, at the next sentence end. */
const WORDS_PER_PARAGRAPH = 55;

/** A sentence ends at . ! or ? followed by a space and a capital, digit or opening quote. */
export function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9'"‘“(])/)
    .filter(Boolean);
}

/** Groups sentences into paragraphs of roughly WORDS_PER_PARAGRAPH words. */
export function groupSentences(sentences: readonly string[], wordsPerParagraph = WORDS_PER_PARAGRAPH): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  let words = 0;
  for (const sentence of sentences) {
    current.push(sentence);
    words += sentence.split(/\s+/).length;
    if (words >= wordsPerParagraph) {
      groups.push(current);
      current = [];
      words = 0;
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

// Patterns are matched against already-escaped text, so they only ever wrap safe characters.
const CODE_PATTERNS: readonly RegExp[] = [
  /\b\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?\b/g, // 192.168.10.0/24, 255.255.255.224
  /(?<![\w.])\/\d{1,2}\b/g, // a bare prefix length: /26
  /\b[01]{4,}\b/g, // bit strings: 1101001
  /\b(?:[0-9A-F]{2}:){5}[0-9A-F]{2}\b/gi, // MAC addresses
  /\b(?:[0-9a-f]{1,4}:){2,7}(?::?[0-9a-f]{0,4})+\b/gi, // IPv6, including :: shorthand
  // formulas: C = 2B log2(L). Ends at a comma, semicolon or sentence end; decimals survive.
  /\b[A-Za-z_]\w*\s?=\s?[^,;:]{1,60}?(?=[,;]|\.\s|\.$|$)/g,
];

/** Wraps technical tokens in <code>, never inside a token already wrapped. Input must be escaped. */
export function highlightTokens(escaped: string): string {
  return CODE_PATTERNS.reduce(
    (html, pattern) =>
      html
        .split(/(<code>.*?<\/code>)/)
        .map((part) => (part.startsWith('<code>') ? part : part.replace(pattern, (match) => `<code>${match}</code>`)))
        .join(''),
    escaped,
  );
}

/**
 * Renders `text` as one or more <p> elements. With `lede`, the first sentence is its own
 * emphasised paragraph: the claim the rest of the section explains.
 */
export function proseHtml(text: string, options: { className: string; lede?: boolean }): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return '';
  const paragraph = (parts: readonly string[], extra = ''): string =>
    `<p class="${options.className}${extra}">${highlightTokens(escapeHtml(parts.join(' ')))}</p>`;

  const [first, ...rest] = sentences;
  if (options.lede && rest.length > 0) {
    return paragraph([first], ' is-lede') + groupSentences(rest).map((group) => paragraph(group)).join('');
  }
  return groupSentences(sentences).map((group) => paragraph(group)).join('');
}

/** Sections that walk through a calculation get a "Worked example" tag. */
export function isWorkedExample(heading: string): boolean {
  return /worked|step by step|with (real |small )?numbers|trace|numbers:/i.test(heading);
}
