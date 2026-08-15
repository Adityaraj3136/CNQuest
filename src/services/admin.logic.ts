/**
 * Pure helpers for the admin editor — no Firestore, no DOM, so they can be tested directly.
 */

/** A short human label for a document row — the first field that reads like a title. */
export function summarise(data: Record<string, unknown>): string {
  for (const key of ['title', 'name', 'term', 'question', 'prompt', 'text', 'clue']) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '—';
}

export type ParseResult = { data: Record<string, unknown> } | { error: string };

/**
 * Parses editor input. The trust boundary for the whole screen: everything downstream assumes
 * a JSON object whose `id` matches the document it is being written to. Without the id check,
 * editing the id field in the textarea silently writes to a *different* document.
 */
export function parseDocumentInput(raw: string, expectedId: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { error: error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { error: 'A document must be a JSON object.' };
  }

  const data = parsed as Record<string, unknown>;
  const id = data.id;

  if (typeof id !== 'string' || !id.trim()) {
    return { error: 'The document needs a non-empty string "id" field.' };
  }
  if (id !== expectedId) {
    return { error: `The "id" field is "${id}" but this document is saved as "${expectedId}".` };
  }

  return { data };
}
