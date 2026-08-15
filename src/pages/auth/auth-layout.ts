/** Shared chrome, field markup and validation wiring for the authentication screens. */

import { APP } from '@/config/app.config';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import '@/styles/auth.css';

export interface AuthShellOptions {
  title: string;
  subtitle: string;
  formHtml: string;
  footerHtml: string;
  perks: readonly string[];
  asideTitle: string;
  asideText: string;
}

export function authShellHtml(options: AuthShellOptions): string {
  return `
    <section class="cn-auth">
      <div class="cn-auth__form-side">
        <div class="cn-auth__card cn-rise cn-rise-1">
          <span class="cn-label cn-label--marked">${escapeHtml(APP.name)}</span>
          <h1 class="cn-auth__title">${escapeHtml(options.title)}</h1>
          <p class="cn-auth__subtitle">${escapeHtml(options.subtitle)}</p>
          ${options.formHtml}
          <div class="cn-auth__alt mt-4">${options.footerHtml}</div>
        </div>
      </div>

      <aside class="cn-auth__aside cn-on-field" aria-hidden="true">
        <span class="cn-label cn-label--marked">${escapeHtml(APP.subject)}</span>
        <h2>${escapeHtml(options.asideTitle)}</h2>
        <p>${escapeHtml(options.asideText)}</p>
        <ul class="cn-auth__perks">
          ${options.perks
            .map(
              (perk, index) =>
                `<li><span class="cn-index__num">${String(index + 1).padStart(2, '0')}</span><span>${escapeHtml(perk)}</span></li>`,
            )
            .join('')}
        </ul>
      </aside>
    </section>
  `;
}

export interface FieldOptions {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  autocomplete?: string;
  hint?: string;
}

export function fieldHtml({
  id,
  label,
  type = 'text',
  placeholder = '',
  autocomplete = 'off',
  hint,
}: FieldOptions): string {
  return `
    <div class="cn-field">
      <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
      <input
        class="form-control"
        id="${escapeHtml(id)}"
        name="${escapeHtml(id)}"
        type="${escapeHtml(type)}"
        placeholder="${escapeHtml(placeholder)}"
        autocomplete="${escapeHtml(autocomplete)}"
        aria-describedby="${escapeHtml(id)}-error"
      />
      ${hint ? `<p class="cn-field__hint">${escapeHtml(hint)}</p>` : ''}
      <p class="cn-field__error" id="${escapeHtml(id)}-error" role="alert"></p>
    </div>
  `;
}

/** Notice explaining that a phase's backend behaviour is not wired up yet. */
export function phaseNoticeHtml(message: string): string {
  return `
    <div class="cn-notice">
      <i class="bi bi-info-circle" aria-hidden="true"></i>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

export function setFieldError(form: HTMLFormElement, fieldId: string, message: string | null): void {
  const input = qs<HTMLInputElement>(`#${fieldId}`, form);
  const error = qs(`#${fieldId}-error`, form);
  if (!input || !error) return;
  error.textContent = message ?? '';
  input.setAttribute('aria-invalid', String(Boolean(message)));
}

export function clearFieldErrors(form: HTMLFormElement): void {
  qsa<HTMLInputElement>('input', form).forEach((input) => input.removeAttribute('aria-invalid'));
  qsa('.cn-field__error', form).forEach((el) => {
    el.textContent = '';
  });
}

/** Moves focus to the first invalid field so keyboard and screen-reader users land on the error. */
export function focusFirstInvalid(form: HTMLFormElement): void {
  qs<HTMLInputElement>('[aria-invalid="true"]', form)?.focus();
}

export function setSubmitting(button: HTMLButtonElement, busy: boolean, busyLabel: string): void {
  if (busy) {
    button.dataset.idleLabel ??= button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="bi bi-three-dots" aria-hidden="true"></i> ${escapeHtml(busyLabel)}`;
    return;
  }
  button.disabled = false;
  if (button.dataset.idleLabel) button.innerHTML = button.dataset.idleLabel;
}
