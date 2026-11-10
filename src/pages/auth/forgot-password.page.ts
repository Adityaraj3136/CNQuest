/** Forgot-password screen, backed by Firebase `sendPasswordResetEmail`. */

import type { Page } from '@/types/page';
import {
  authShellHtml,
  clearFieldErrors,
  fieldHtml,
  focusFirstInvalid,
  phaseNoticeHtml,
  setFieldError,
  setSubmitting,
} from './auth-layout';
import { validateEmail } from '@/utils/validation';
import { isFirebaseConfigured } from '@/config/firebase';
import { sendPasswordReset } from '@/services/auth.service';
import { showToast } from '@/components/toast';
import { qs, requireEl } from '@/utils/dom';

const FORM_ID = 'cn-forgot-form';

const forgotPasswordPage: Page = {
  title: 'Reset your password',

  render() {
    const form = `
      <form id="${FORM_ID}" novalidate>
        ${fieldHtml({
          id: 'email',
          label: 'Email',
          type: 'email',
          placeholder: 'you@college.edu',
          autocomplete: 'email',
          hint: 'We will send a password reset link to this address.',
        })}

        <button class="btn btn-cn-primary w-100" type="submit">
          <i class="bi bi-envelope-arrow-up" aria-hidden="true"></i> Send reset link
        </button>

        ${
          isFirebaseConfigured()
            ? ''
            : phaseNoticeHtml(
                'Firebase is not configured. Copy .env.example to .env, add your keys, and restart the dev server.',
              )
        }
      </form>
    `;

    return authShellHtml({
      title: 'Forgot your password?',
      subtitle: 'Enter your email and we will send you a reset link.',
      formHtml: form,
      footerHtml: 'Remembered it? <a href="#/login">Back to login</a>',
      asideTitle: 'Your progress is safe',
      asideText:
        'XP, streaks, achievements and topic mastery live in your account. Resetting your password never touches them.',
      perks: ['Secure Firebase Authentication', 'Nothing is lost on reset', 'Back to studying in a minute'],
    });
  },

  mount() {
    const form = requireEl<HTMLFormElement>(`#${FORM_ID}`);
    const submit = requireEl<HTMLButtonElement>('button[type="submit"]', form);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void handleSubmit();
    });

    async function handleSubmit(): Promise<void> {
      clearFieldErrors(form);

      const email = qs<HTMLInputElement>('#email', form)?.value ?? '';
      const emailError = validateEmail(email);
      setFieldError(form, 'email', emailError);

      if (emailError) {
        focusFirstInvalid(form);
        return;
      }

      setSubmitting(submit, true, 'Sending…');
      try {
        await sendPasswordReset(email);
        setSubmitting(submit, false, '');
        // Deliberately identical whether or not the address is registered.
        showToast('If that email has an account, a reset link is on its way.', {
          title: 'Check your inbox',
          variant: 'success',
        });
        form.reset();
      } catch (error) {
        setSubmitting(submit, false, '');
        const message =
          error instanceof Error ? error.message : 'Something went wrong. Please try again.';
        setFieldError(form, 'email', message);
        focusFirstInvalid(form);
        showToast(message, { title: 'Could not send reset link', variant: 'error' });
      }
    }
  },
};

export default forgotPasswordPage;
