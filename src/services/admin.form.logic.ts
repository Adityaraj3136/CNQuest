/**
 * Converting between a document and the strings a form holds. Pure, so both directions are
 * tested — a form that silently drops a field is worse than no form at all.
 *
 * No imports beyond the field specs: the Node test runner loads this directly.
 */

import type { FieldSpec } from './admin.schema.ts';

/** One raw form value: a text input's string, or a checkbox group's selected values. */
export type RawValue = string | string[];

// ------------------------------------------------------------------ document → form

/**
 * Media is stored nested but edited as two flat fields, because a form is a flat thing and
 * asking an author to type JSON for two strings would be worse.
 */
export function mediaFieldValue(key: string, document: Record<string, unknown>): string {
  const media = document.media;
  if (typeof media !== 'object' || media === null) return '';

  const entry = media as Record<string, unknown>;
  const value = key === 'mediaUrl' ? entry.url : entry.caption;
  return typeof value === 'string' ? value : '';
}

/** Renders one stored value as the text the field should show. */
export function toFieldValue(spec: FieldSpec, value: unknown): RawValue {
  if (value === undefined || value === null) return spec.kind === 'checkboxes' ? [] : '';

  switch (spec.kind) {
    case 'list':
      return Array.isArray(value) ? value.map(String).join('\n') : String(value);

    case 'pairs': {
      if (!Array.isArray(value)) return '';
      const [leftKey, rightKey] = spec.pairKeys ?? ['left', 'right'];
      return value
        .map((row) => {
          const entry = row as Record<string, unknown>;
          return `${String(entry[leftKey] ?? '')} | ${String(entry[rightKey] ?? '')}`;
        })
        .join('\n');
    }

    case 'checkboxes':
      return Array.isArray(value) ? value.map(String) : [String(value)];

    case 'number':
      // `correctAnswer` is stored zero-based but shown counting from 1, so the author is not
      // asked to think like an array index.
      return String(spec.key === 'correctAnswer' ? Number(value) + 1 : value);

    default:
      return String(value);
  }
}

// ------------------------------------------------------------------ form → document

function splitLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export interface BuildResult {
  data: Record<string, unknown>;
  /** Field key → message. Empty when the document is ready to save. */
  errors: Record<string, string>;
}

/**
 * Assembles a document from raw form values.
 *
 * Optional fields left blank are omitted rather than written as empty strings or arrays —
 * Firestore would otherwise fill up with `examples: []` on every topic that has none.
 */
export function buildDocument(
  specs: readonly FieldSpec[],
  id: string,
  raw: Readonly<Record<string, RawValue>>,
): BuildResult {
  const data: Record<string, unknown> = { id };
  const errors: Record<string, string> = {};

  // Two flat fields become one nested object, and an image without a caption is refused:
  // an uncaptioned diagram is invisible to anyone using a screen reader.
  const mediaUrl = String(raw.mediaUrl ?? '').trim();
  const mediaCaption = String(raw.mediaCaption ?? '').trim();

  if (mediaUrl && !mediaCaption) {
    errors.mediaCaption = 'A caption is required whenever an image is set.';
  } else if (mediaUrl) {
    if (!/^https?:\/\//i.test(mediaUrl)) {
      errors.mediaUrl = 'The URL must start with http:// or https://';
    } else {
      data.media = { url: mediaUrl, caption: mediaCaption };
    }
  }

  if (!id.trim()) errors.id = 'An id is required.';

  for (const spec of specs) {
    // Handled above, and neither belongs in the document as a top-level field.
    if (spec.key === 'mediaUrl' || spec.key === 'mediaCaption') continue;

    const value = raw[spec.key] ?? (spec.kind === 'checkboxes' ? [] : '');

    switch (spec.kind) {
      case 'number': {
        const text = String(value).trim();
        if (!text) {
          if (spec.required) errors[spec.key] = `${spec.label} is required.`;
          break;
        }
        const parsed = Number(text);
        if (!Number.isFinite(parsed)) {
          errors[spec.key] = `${spec.label} must be a number.`;
          break;
        }
        data[spec.key] = spec.key === 'correctAnswer' ? parsed - 1 : parsed;
        break;
      }

      case 'list': {
        const items = splitLines(String(value));
        if (items.length === 0) {
          if (spec.required) errors[spec.key] = `${spec.label} needs at least one entry.`;
          break;
        }
        data[spec.key] = items;
        break;
      }

      case 'pairs': {
        const [leftKey, rightKey] = spec.pairKeys ?? ['left', 'right'];
        const rows: Record<string, string>[] = [];

        for (const line of splitLines(String(value))) {
          const separator = line.indexOf('|');
          if (separator === -1) {
            errors[spec.key] = `Each line needs a "|" between the two halves — check: ${line}`;
            break;
          }
          const left = line.slice(0, separator).trim();
          const right = line.slice(separator + 1).trim();
          if (!left || !right) {
            errors[spec.key] = `Both halves are required — check: ${line}`;
            break;
          }
          rows.push({ [leftKey]: left, [rightKey]: right });
        }

        if (errors[spec.key]) break;
        if (rows.length === 0) {
          if (spec.required) errors[spec.key] = `${spec.label} needs at least one row.`;
          break;
        }
        data[spec.key] = rows;
        break;
      }

      case 'checkboxes': {
        const chosen = Array.isArray(value) ? value : [value].filter(Boolean);
        if (chosen.length === 0) {
          if (spec.required) errors[spec.key] = `Choose at least one ${spec.label.toLowerCase()}.`;
          break;
        }
        data[spec.key] = chosen;
        break;
      }

      default: {
        const text = String(value).trim();
        if (!text) {
          if (spec.required) errors[spec.key] = `${spec.label} is required.`;
          break;
        }
        data[spec.key] = text;
      }
    }
  }

  // A correct-answer number that points past the options list is the mistake this form exists
  // to catch: it saves cleanly and then shows students a question with no right answer.
  const options = data.options;
  const answer = data.correctAnswer;
  if (Array.isArray(options) && typeof answer === 'number') {
    if (answer < 0 || answer >= options.length) {
      errors.correctAnswer = `Pick a number between 1 and ${options.length}.`;
    }
  }

  return { data, errors };
}

/**
 * Turns a title into a document id: `topics` + "The OSI Model" → `topic-the-osi-model`.
 * Ids are permanent once students' progress references them, so this only ever suggests.
 */
export function suggestId(collectionId: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  if (!slug) return '';

  // "topics" → "topic-", "dictionary" → "dictionary-"
  const prefix = collectionId.endsWith('s') ? collectionId.slice(0, -1) : collectionId;
  return `${prefix.toLowerCase()}-${slug}`;
}
