/** Login screen backed by Firebase Authentication. */

import type { Page, PageContext } from '@/types/page';
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
import { validateEmail, validatePassword } from '@/utils/validation';
import { isFirebaseConfigured } from '@/config/firebase';
import { signIn } from '@/services/auth.service';
import { beginGuestSession } from '@/state/session';
import { showToast } from '@/components/toast';
import { navigate } from '@/router';
import { qs, requireEl } from '@/utils/dom';

const FORM_ID = 'cn-login-form';

const loginPage: Page = {
  title: 'Login',

  render() {
    const form = `
      <form id="${FORM_ID}" novalidate>
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
          placeholder: 'Your password',
          autocomplete: 'current-password',
        })}

        <div class="cn-auth__meta">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="remember" checked />
            <label class="form-check-label" for="remember">Keep me signed in</label>
          </div>
          <a href="#/forgot-password">Forgot password?</a>
        </div>

        <button class="btn btn-cn-primary w-100" type="submit">
          <i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> Log in
        </button>

        <div class="cn-auth__divider"><span>or</span></div>

        ${googleButtonHtml('Continue with Google')}

        <button class="btn btn-cn-ghost w-100" type="button" id="cn-guest-btn">
          <i class="bi bi-person-badge" aria-hidden="true"></i> Continue as guest
        </button>
        <p class="cn-field__hint text-center mb-0">
          No account needed. Guest progress is saved on this device only.
        </p>

        ${
          isFirebaseConfigured()
            ? ''
            : phaseNoticeHtml(
                'Firebase is not connected yet, so email sign-in is unavailable. Use “Continue as guest” to explore CN Quest.',
              )
        }
      </form>
    `;

    return authShellHtml({
      title: 'Welcome back',
      subtitle: 'Log in to continue your networking quest.',
      formHtml: form,
      footerHtml: 'New to CN Quest? <a href="#/register">Create an account</a>',
      asideTitle: 'Your streak is waiting',
      asideText:
        'Pick up your XP, streak and topic mastery exactly where you left them, on any device you sign in from.',
      perks: [
        'Progress synced to your account',
        'Daily streaks and level titles',
        'Weak-topic recommendations',
      ],
    });
  },

  mount(ctx: PageContext) {
    const form = requireEl<HTMLFormElement>(`#${FORM_ID}`);
    const submit = requireEl<HTMLButtonElement>('button[type="submit"]', form);
    // Return the student to the page that bounced them to login, defaulting to the dashboard.
    const next = ctx.query.get('next') || '/dashboard';

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void handleSubmit();
    });

    bindGoogleButton(form, {
      onSuccess: () => {
        showToast('Welcome back! Loading your dashboard…', { variant: 'success' });
        navigate(next, true);
      },
      onError: (message) => showToast(message, { title: 'Could not sign in', variant: 'error' }),
    });

    qs<HTMLButtonElement>('#cn-guest-btn', form)?.addEventListener('click', () => {
      beginGuestSession();
      showToast('Playing as a guest. Progress is saved on this device only.', {
        title: 'Guest mode',
        variant: 'info',
      });
      navigate(next, true);
    });

    async function handleSubmit(): Promise<void> {
      clearFieldErrors(form);

      const email = qs<HTMLInputElement>('#email', form)?.value ?? '';
      const password = qs<HTMLInputElement>('#password', form)?.value ?? '';
      const remember = qs<HTMLInputElement>('#remember', form)?.checked ?? true;

      const emailError = validateEmail(email);
      const passwordError = validatePassword(password);
      setFieldError(form, 'email', emailError);
      setFieldError(form, 'password', passwordError);

      if (emailError || passwordError) {
        focusFirstInvalid(form);
        return;
      }

      setSubmitting(submit, true, 'Signing in…');
      try {
        await signIn(email, password, remember);
        showToast('Welcome back! Loading your dashboard…', { variant: 'success' });
        navigate(next, true);
      } catch (error) {
        setSubmitting(submit, false, '');
        const message =
          error instanceof Error ? error.message : 'Something went wrong. Please try again.';
        setFieldError(form, 'password', message);
        focusFirstInvalid(form);
        showToast(message, { title: 'Could not sign in', variant: 'error' });
      }
    }
  },
};

export default loginPage;
