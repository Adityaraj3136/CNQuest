/** Shared chrome, field markup and validation wiring for the authentication screens. */

import { APP } from '@/config/app.config';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import { signInWithGoogle, warmUpGoogleSignIn } from '@/services/auth.service';
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

export const GOOGLE_BUTTON_ID = 'cn-google-btn';

/**
 * Google sign-in button. The mark is inlined rather than fetched: the app must work offline,
 * and Google's branding guidance requires the official four-colour "G".
 */
export function googleButtonHtml(label = 'Continue with Google'): string {
  return `
    <button class="btn btn-cn-ghost w-100 cn-auth__google" type="button" id="${GOOGLE_BUTTON_ID}">
      <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" focusable="false">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32z"/>
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/>
      </svg>
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

/**
 * Wires the Google button on either auth screen. Both screens do the same thing on success,
 * so the behaviour lives here rather than being written twice and drifting.
 */
export function bindGoogleButton(
  form: HTMLFormElement,
  options: { onSuccess: () => void; onError: (message: string) => void },
): void {
  const button = qs<HTMLButtonElement>(`#${GOOGLE_BUTTON_ID}`, form);
  if (!button) return;

  // Fetch the auth chunk now, not when the button is pressed: a popup opened after a network
  // round-trip is treated as unsolicited and blocked.
  void warmUpGoogleSignIn();

  button.addEventListener('click', () => {
    void (async () => {
      setSubmitting(button, true, 'Opening Google…');
      try {
        const remember = qs<HTMLInputElement>('#remember', form)?.checked ?? true;
        await signInWithGoogle(remember);
        options.onSuccess();
      } catch (error) {
        setSubmitting(button, false, '');
        options.onError(
          error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        );
      }
    })();
  });
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
