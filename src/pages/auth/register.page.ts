/**
 * Registration screen.
 * Creates the Firebase Auth user and its Firestore profile with default statistics,
 * then drops the student straight onto the dashboard.
 */

import type { Page } from '@/types/page';
import {
  authShellHtml,
  bindGoogleButton,
  clearFieldErrors,
  fieldHtml,
  focusFirstInvalid,
  googleButtonHtml,
  phaseNoticeHtml,
  setFieldError,
  setSubmitting,
} from './auth-layout';
import {
  MIN_PASSWORD_LENGTH,
  validateConfirmPassword,
  validateEmail,
  validateName,
  validatePassword,
} from '@/utils/validation';
import { isFirebaseConfigured } from '@/config/firebase';
import { register } from '@/services/auth.service';
import { showToast } from '@/components/toast';
import { navigate } from '@/router';
import { qs, requireEl } from '@/utils/dom';

const FORM_ID = 'cn-register-form';

const registerPage: Page = {
  title: 'Create your account',

  render() {
    const form = `
      <form id="${FORM_ID}" novalidate>
        ${fieldHtml({
          id: 'name',
          label: 'Full name',
          placeholder: 'Aditya Sharma',
          autocomplete: 'name',
        })}
        ${fieldHtml({
          id: 'email',
          label: 'Email',
          type: 'email',
          placeholder: 'you@college.edu',
          autocomplete: 'email',
        })}
        ${fieldHtml({
          id: 'password',
          label: 'Password',
          type: 'password',
          placeholder: 'Create a password',
          autocomplete: 'new-password',
          hint: `At least ${MIN_PASSWORD_LENGTH} characters.`,
        })}
        ${fieldHtml({
          id: 'confirmPassword',
          label: 'Confirm password',
          type: 'password',
          placeholder: 'Re-enter your password',
          autocomplete: 'new-password',
        })}

        <button class="btn btn-cn-primary w-100" type="submit">
          <i class="bi bi-rocket-takeoff" aria-hidden="true"></i> Start Learning
        </button>

        <div class="cn-auth__divider"><span>or</span></div>

        ${googleButtonHtml('Sign up with Google')}

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
      title: 'Create your account',
      subtitle: 'Start at Level 1 with 0 XP and climb from there.',
      formHtml: form,
      footerHtml: 'Already registered? <a href="#/login">Log in</a>',
      asideTitle: 'Turn revision into a quest',
      asideText:
        'Every quiz, riddle and boss battle feeds one progress engine, so you always know which Computer Networks topic needs work next.',
      perks: [
        'Six game modes across the whole syllabus',
        'XP, levels, streaks and achievement badges',
        'Works offline once installed',
      ],
    });
  },

  mount() {
    const form = requireEl<HTMLFormElement>(`#${FORM_ID}`);
    const submit = requireEl<HTMLButtonElement>('button[type="submit"]', form);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void handleSubmit();
    });

    bindGoogleButton(form, {
      onSuccess: () => {
        showToast('Signed in with Google. Loading your dashboard…', {
          title: 'Welcome to CN Quest',
          variant: 'success',
        });
        navigate('/dashboard', true);
      },
      onError: (message) =>
        showToast(message, { title: 'Could not create account', variant: 'error' }),
    });

    async function handleSubmit(): Promise<void> {
      clearFieldErrors(form);

      const name = qs<HTMLInputElement>('#name', form)?.value ?? '';
      const email = qs<HTMLInputElement>('#email', form)?.value ?? '';
      const password = qs<HTMLInputElement>('#password', form)?.value ?? '';
      const confirmPassword = qs<HTMLInputElement>('#confirmPassword', form)?.value ?? '';

      const errors = {
        name: validateName(name),
        email: validateEmail(email),
        password: validatePassword(password),
        confirmPassword: validateConfirmPassword(password, confirmPassword),
      };

      (Object.keys(errors) as Array<keyof typeof errors>).forEach((field) => {
        setFieldError(form, field, errors[field]);
      });

      if (Object.values(errors).some(Boolean)) {
        focusFirstInvalid(form);
        return;
      }

      setSubmitting(submit, true, 'Creating account…');
      try {
        await register({ name, email, password });
        showToast('Account created. You start at Level 1 with 0 XP. Good luck!', {
          title: 'Welcome to CN Quest',
          variant: 'success',
        });
        navigate('/dashboard', true);
      } catch (error) {
        setSubmitting(submit, false, '');
        const message =
          error instanceof Error ? error.message : 'Something went wrong. Please try again.';
        setFieldError(form, 'email', message);
        focusFirstInvalid(form);
        showToast(message, { title: 'Could not create account', variant: 'error' });
      }
    }
  },
};

export default registerPage;
