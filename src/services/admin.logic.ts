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

export type SourceFilter = 'all' | 'firestore' | 'bundled';

interface FilterableDocument {
  id: string;
  data: Record<string, unknown>;
  source: 'firestore' | 'bundled';
}

/**
 * The document list after search and source filter. Search matches the id, the summary and
 * every value in the document, so a question can be found by any word in it or by its topic id.
 */
export function filterDocuments<T extends FilterableDocument>(
  documents: readonly T[],
  query: string,
  source: SourceFilter,
): T[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return documents.filter((doc) => {
    if (source !== 'all' && doc.source !== source) return false;
    if (terms.length === 0) return true;
    const haystack = `${doc.id} ${JSON.stringify(doc.data)}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/** Where a document can be seen in the app, for "View in app"; null when it has no page. */
export function previewHref(collection: string, id: string): string | null {
  const encoded = encodeURIComponent(id);
  if (collection === 'topics') return `#/learn/${encoded}`;
  if (collection === 'units') return `#/learn#unit-${encoded}`;
  if (collection === 'dictionary') return `#/dictionary?term=${encoded}`;
  return null;
}

/** An unused id for a copy of `id`: "osi-model-copy", then "osi-model-copy-2", and so on. */
export function copyId(id: string, taken: ReadonlySet<string>): string {
  const base = `${id}-copy`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
