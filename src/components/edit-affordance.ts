/**
 * The "Edit this" control the course owner sees while reading the app.
 *
 * The admin dashboard answers "what content exists?". This answers the question that actually
 * comes up: "this paragraph is wrong, where do I fix it?" — from the page where the mistake
 * was noticed, rather than hunting for the document by id in a list.
 *
 * It renders only when the signed-in account is the admin AND admin mode is switched on in
 * Settings. Students never receive this markup at all.
 */

import { isAdmin } from '@/services/admin.service';
import { getPreferences } from '@/state/preferences';
import { escapeHtml } from '@/utils/dom';
import '@/styles/edit-affordance.css';

export function isEditingEnabled(): boolean {
  return isAdmin() && getPreferences().adminMode;
}

export interface EditTarget {
  /** Firestore collection, e.g. `topics`. */
  collection: string;
  /** Document id being displayed. */
  id: string;
  /** What the button says it edits, e.g. "topic" or "dictionary term". */
  label: string;
}

/**
 * A floating control anchored to the viewport corner. Returns an empty string for everyone
 * except the admin in editing mode, so callers can drop it into any page unconditionally.
 */
export function editAffordanceHtml(target: EditTarget): string {
  if (!isEditingEnabled()) return '';

  const href = `#/admin?collection=${encodeURIComponent(target.collection)}&id=${encodeURIComponent(target.id)}`;

  return `
    <a class="cn-edit-fab" href="${escapeHtml(href)}">
      <i class="bi bi-pencil-square" aria-hidden="true"></i>
      <span>Edit this ${escapeHtml(target.label)}</span>
    </a>
  `;
}
