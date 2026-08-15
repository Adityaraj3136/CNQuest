/**
 * Renders a field schema as a form, and reads it back.
 *
 * Only the DOM lives here — every value conversion is in `admin.form.logic.ts`, which is
 * pure and tested. This module's job is markup and `querySelector`, nothing more.
 */

import type { FieldSpec } from '@/services/admin.schema';
import { mediaFieldValue, toFieldValue } from '@/services/admin.form.logic';
import type { RawValue } from '@/services/admin.form.logic';
import { escapeHtml, qs, qsa } from '@/utils/dom';

/** Options for a `reference` field, loaded from the content the admin already has. */
export interface ReferenceOptions {
  units: readonly { id: string; title: string }[];
  topics: readonly { id: string; title: string }[];
}

function fieldId(key: string): string {
  return `cn-admin-field-${key}`;
}

function labelHtml(spec: FieldSpec): string {
  return `
    <label for="${fieldId(spec.key)}">
      ${escapeHtml(spec.label)}
      ${spec.required ? '<span class="cn-admin__req" aria-hidden="true">required</span>' : ''}
    </label>
  `;
}

function helpHtml(spec: FieldSpec): string {
  return spec.help ? `<p class="cn-field__hint">${escapeHtml(spec.help)}</p>` : '';
}

function controlHtml(spec: FieldSpec, value: RawValue, refs: ReferenceOptions): string {
  const id = fieldId(spec.key);
  const name = escapeHtml(spec.key);

  switch (spec.kind) {
    case 'textarea':
    case 'list':
    case 'pairs':
      return `<textarea class="form-control" id="${id}" name="${name}" rows="${spec.rows ?? (spec.kind === 'textarea' ? 4 : 6)}" spellcheck="${spec.kind === 'textarea'}">${escapeHtml(String(value))}</textarea>`;

    case 'number':
      return `<input class="form-control" type="number" id="${id}" name="${name}" value="${escapeHtml(String(value))}" />`;

    case 'select':
      return `
        <select class="form-select" id="${id}" name="${name}">
          <option value="">Choose…</option>
          ${(spec.options ?? [])
            .map(
              (option) =>
                `<option value="${escapeHtml(option)}"${option === value ? ' selected' : ''}>${escapeHtml(option)}</option>`,
            )
            .join('')}
        </select>
      `;

    case 'reference': {
      const list = spec.reference === 'units' ? refs.units : refs.topics;
      // An empty list means the collection has not been loaded — better to say so than to
      // render a dropdown with no options and let the admin think the content is missing.
      if (list.length === 0) {
        return `<input class="form-control" id="${id}" name="${name}" value="${escapeHtml(String(value))}" placeholder="e.g. unit-1" />`;
      }
      return `
        <select class="form-select" id="${id}" name="${name}">
          <option value="">Choose…</option>
          ${list
            .map(
              (entry) =>
                `<option value="${escapeHtml(entry.id)}"${entry.id === value ? ' selected' : ''}>${escapeHtml(entry.title)} — ${escapeHtml(entry.id)}</option>`,
            )
            .join('')}
        </select>
      `;
    }

    case 'checkboxes': {
      const chosen = Array.isArray(value) ? value : [];
      return `
        <div class="cn-admin__checks" id="${id}" role="group" aria-labelledby="${id}-label">
          ${(spec.options ?? [])
            .map(
              (option, index) => `
                <label class="cn-admin__check" for="${id}-${index}">
                  <input
                    type="checkbox"
                    id="${id}-${index}"
                    name="${name}"
                    value="${escapeHtml(option)}"
                    ${chosen.includes(option) ? 'checked' : ''}
                  />
                  <span>${escapeHtml(option)}</span>
                </label>
              `,
            )
            .join('')}
        </div>
      `;
    }

    default:
      return `<input class="form-control" id="${id}" name="${name}" value="${escapeHtml(String(value))}" />`;
  }
}

/** The whole form for one document. `document` is empty when creating a new one. */
export function formHtml(
  specs: readonly FieldSpec[],
  document: Record<string, unknown>,
  refs: ReferenceOptions,
): string {
  return specs
    .map((spec) => {
      const value =
        spec.key === 'mediaUrl' || spec.key === 'mediaCaption'
          ? mediaFieldValue(spec.key, document)
          : toFieldValue(spec, document[spec.key]);
      const hint = spec.kind === 'pairs' ? pairHintHtml(spec) : helpHtml(spec);

      return `
        <div class="cn-admin__field" data-field="${escapeHtml(spec.key)}">
          ${labelHtml(spec)}
          ${controlHtml(spec, value, refs)}
          ${hint}
          <p class="cn-field__error" data-error-for="${escapeHtml(spec.key)}" role="alert"></p>
        </div>
      `;
    })
    .join('');
}

function pairHintHtml(spec: FieldSpec): string {
  const [left, right] = spec.pairLabels ?? ['Left', 'Right'];
  return `<p class="cn-field__hint">One per line, as <code>${escapeHtml(left)} | ${escapeHtml(right)}</code>.</p>`;
}

/** Reads every field back out of the DOM as raw strings for `buildDocument`. */
export function readForm(
  specs: readonly FieldSpec[],
  root: HTMLElement,
): Record<string, RawValue> {
  const raw: Record<string, RawValue> = {};

  for (const spec of specs) {
    if (spec.kind === 'checkboxes') {
      raw[spec.key] = qsa<HTMLInputElement>(`input[name="${spec.key}"]:checked`, root).map(
        (input) => input.value,
      );
      continue;
    }

    const control = qs<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[name="${spec.key}"]`,
      root,
    );
    raw[spec.key] = control?.value ?? '';
  }

  return raw;
}

/** Paints validation messages next to the fields they belong to. */
export function showFieldErrors(root: HTMLElement, errors: Record<string, string>): void {
  qsa('[data-error-for]', root).forEach((element) => {
    const key = element.getAttribute('data-error-for') ?? '';
    element.textContent = errors[key] ?? '';
  });

  const firstKey = Object.keys(errors)[0];
  if (!firstKey) return;
  qs<HTMLElement>(`[name="${firstKey}"]`, root)?.focus();
}
