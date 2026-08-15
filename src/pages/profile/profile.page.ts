/**
 * Profile — identity, headline statistics and the badges earned.
 *
 * Editing is limited to what a student owns: display name and avatar. XP, level and streaks
 * are earned, never typed, so they are read-only here by design.
 */

import type { Page } from '@/types/page';
import { getSession, refreshProfile } from '@/state/session';
import { activeStore } from '@/services/progress.store';
import { getAchievements } from '@/services/content.service';
import { levelProgress } from '@/config/level.config';
import { sendPasswordReset } from '@/services/auth.service';
import { showToast } from '@/components/toast';
import { loaderHtml, stateHtml } from '@/components/loader';
import { validateName } from '@/utils/validation';
import { escapeHtml, qs, qsa } from '@/utils/dom';
import type { Achievement } from '@/models/content';
import type { UserProfile } from '@/models/user';
import '@/styles/profile.css';

const ROOT_ID = 'cn-profile-root';

/** Preset avatars. Icon ids rather than uploads: no storage bucket, no moderation problem. */
const AVATARS = [
  'bi-person-circle',
  'bi-diagram-3',
  'bi-router',
  'bi-shield-shaded',
  'bi-globe2',
  'bi-cpu',
  'bi-ethernet',
  'bi-rocket-takeoff',
] as const;

const DEFAULT_AVATAR = AVATARS[0];

function avatarOf(profile: UserProfile): string {
  const stored = profile.photoURL ?? '';
  return (AVATARS as readonly string[]).includes(stored) ? stored : DEFAULT_AVATAR;
}

function statHtml(label: string, value: string, meta = ''): string {
  return `
    <div class="cn-stat">
      <span class="cn-stat__label">${escapeHtml(label)}</span>
      <span class="cn-stat__value">${escapeHtml(value)}</span>
      ${meta ? `<span class="cn-stat__meta">${escapeHtml(meta)}</span>` : ''}
    </div>
  `;
}

function bodyHtml(
  profile: UserProfile,
  isGuest: boolean,
  earned: Achievement[],
  totalAchievements: number,
): string {
  const level = levelProgress(profile.totalXP);
  const accuracy =
    profile.questionsAnswered === 0
      ? '—'
      : `${Math.round((profile.correctAnswers / profile.questionsAnswered) * 100)}%`;

  return `
    <header class="cn-profile__head cn-rise cn-rise-1">
      <div class="cn-profile__identity">
        <span class="cn-profile__avatar" aria-hidden="true">
          <i class="bi ${escapeHtml(avatarOf(profile))}"></i>
        </span>
        <div class="cn-profile__who">
          <h1 class="cn-profile__name">${escapeHtml(profile.name)}</h1>
          <p class="cn-profile__title">Level ${level.level} · ${escapeHtml(level.title)}</p>
          <p class="cn-profile__meta">
            ${escapeHtml(isGuest ? 'Guest — progress is stored on this device' : profile.email)}
          </p>
        </div>
      </div>

      <div class="cn-profile__xp">
        <div class="cn-profile__xpbar">
          <span style="width:${level.percent}%"></span>
        </div>
        <p class="cn-profile__xpmeta">
          ${level.xpIntoLevel.toLocaleString()} / ${level.xpForLevel.toLocaleString()} XP to level ${level.level + 1}
        </p>
      </div>
    </header>

    <div class="cn-dash__stats cn-rise cn-rise-2">
      ${statHtml('Total XP', String(profile.totalXP), `Level ${level.level}`)}
      ${statHtml('Current streak', `${profile.currentStreak}d`, `Longest ${profile.longestStreak}d`)}
      ${statHtml('Games played', String(profile.gamesPlayed), `${profile.questionsAnswered} questions`)}
      ${statHtml('Accuracy', accuracy, `${profile.correctAnswers} correct`)}
    </div>

    <section class="cn-profile__section cn-rise cn-rise-3">
      <span class="cn-label cn-label--marked">Badges · ${earned.length} of ${totalAchievements}</span>
      ${
        earned.length === 0
          ? '<p class="cn-ink-soft mt-3">No badges yet. Finishing your first round unlocks one.</p>'
          : `<div class="cn-badge-strip">
               ${earned
                 .map(
                   (achievement) => `
                     <span class="cn-badge-chip" title="${escapeHtml(achievement.description)}">
                       <i class="bi ${escapeHtml(achievement.icon)}" aria-hidden="true"></i>
                       ${escapeHtml(achievement.name)}
                     </span>`,
                 )
                 .join('')}
             </div>
             <a class="cn-label cn-label--accent mt-3 d-inline-block" href="#/achievements">View all achievements</a>`
      }
    </section>

    <details class="cn-profile__section cn-profile__edit cn-rise cn-rise-4">
      <summary>
        <i class="bi bi-pencil" aria-hidden="true"></i>
        Edit profile
      </summary>

      <form id="cn-profile-form" class="cn-profile__form" novalidate>
        <div class="cn-field">
          <label for="cn-profile-name">Display name</label>
          <input class="form-control" id="cn-profile-name" type="text" value="${escapeHtml(profile.name)}"
                 autocomplete="name" maxlength="40" />
          <p class="cn-field__error" id="cn-profile-name-error" role="alert"></p>
        </div>

        <fieldset class="cn-avatar-picker">
          <legend class="cn-label">Avatar</legend>
          <div class="cn-avatar-picker__grid">
            ${AVATARS.map(
              (icon) => `
                <button type="button" class="cn-avatar-option" data-avatar="${icon}"
                        aria-pressed="${avatarOf(profile) === icon}" aria-label="Avatar ${icon.replace('bi-', '')}">
                  <i class="bi ${icon}" aria-hidden="true"></i>
                </button>`,
            ).join('')}
          </div>
        </fieldset>

        <button class="btn btn-cn-primary" type="submit">Save changes</button>
      </form>
    </details>

    ${
      isGuest
        ? `<div class="cn-notice cn-notice--reward mt-5">
             <i class="bi bi-person-badge" aria-hidden="true"></i>
             <span>
               Guest profile — stored on this device only.
               <a href="#/register">Create an account</a> to keep it anywhere.
             </span>
           </div>`
        : `<section class="cn-profile__section cn-rise cn-rise-5">
             <span class="cn-label cn-label--marked">Account</span>
             <div class="cn-setting">
               <div class="cn-setting__text">
                 <span class="cn-setting__label">Password</span>
                 <p class="cn-setting__desc">We email you a reset link. Your progress is unaffected.</p>
               </div>
               <button type="button" class="btn btn-cn-ghost btn-sm" id="cn-profile-reset">Send reset link</button>
             </div>
           </section>`
    }
  `;
}

/** Draft avatar selection, applied on save rather than on every click. */
let selectedAvatar: string = DEFAULT_AVATAR;

async function paint(): Promise<void> {
  const root = qs(`#${ROOT_ID}`);
  if (!root) return;

  const store = activeStore();
  const { isGuest, user } = getSession();

  if (!store) {
    root.innerHTML = stateHtml({
      icon: 'bi-person-circle',
      title: 'Sign in to see your profile',
      message: 'Your profile is tied to your account or guest session.',
      actionLabel: 'Login',
      actionHref: '#/login',
    });
    return;
  }

  try {
    const [profile, catalogue, held] = await Promise.all([
      store.loadProfile(),
      getAchievements(),
      store.loadUnlockedAchievements(),
    ]);

    if (!profile) {
      root.innerHTML = stateHtml({
        icon: 'bi-person-exclamation',
        title: 'Profile unavailable',
        message: 'We could not load your profile. Check your connection and try again.',
        actionLabel: 'Back to dashboard',
        actionHref: '#/dashboard',
      });
      return;
    }

    const heldSet = new Set(held);
    const earned = catalogue.filter((achievement) => heldSet.has(achievement.id));
    selectedAvatar = avatarOf(profile);

    root.innerHTML = bodyHtml(profile, isGuest, earned, catalogue.length);
    bindHandlers(profile, user?.email ?? profile.email);
  } catch (error) {
    console.error('[profile] failed to load', error);
    root.innerHTML = stateHtml({
      icon: 'bi-exclamation-triangle',
      title: "We couldn't load your profile",
      message: 'Check your connection and try again. Your progress is safe.',
      actionLabel: 'Back to dashboard',
      actionHref: '#/dashboard',
    });
  }
}

function bindHandlers(profile: UserProfile, email: string): void {
  qsa<HTMLButtonElement>('.cn-avatar-option').forEach((button) => {
    button.addEventListener('click', () => {
      selectedAvatar = button.dataset.avatar ?? DEFAULT_AVATAR;
      qsa('.cn-avatar-option').forEach((entry) =>
        entry.setAttribute('aria-pressed', String(entry === button)),
      );
    });
  });

  qs<HTMLFormElement>('#cn-profile-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void save(profile);
  });

  qs<HTMLButtonElement>('#cn-profile-reset')?.addEventListener('click', () => {
    void (async () => {
      try {
        await sendPasswordReset(email);
        showToast('If that email has an account, a reset link is on its way.', {
          title: 'Check your inbox',
          variant: 'success',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Please try again.';
        showToast(message, { title: 'Could not send reset link', variant: 'error' });
      }
    })();
  });
}

async function save(profile: UserProfile): Promise<void> {
  const input = qs<HTMLInputElement>('#cn-profile-name');
  const errorEl = qs('#cn-profile-name-error');
  const name = input?.value ?? '';

  const error = validateName(name);
  if (errorEl) errorEl.textContent = error ?? '';
  input?.setAttribute('aria-invalid', String(Boolean(error)));

  if (error) {
    input?.focus();
    return;
  }

  const store = activeStore();
  if (!store) return;

  try {
    await store.saveProfile({ ...profile, name: name.trim(), photoURL: selectedAvatar });
    await refreshProfile();
    showToast('Profile updated.', { variant: 'success' });
    void paint();
  } catch (err) {
    console.error('[profile] could not save', err);
    showToast('We could not save your changes. Check your connection and try again.', {
      title: 'Not saved',
      variant: 'error',
    });
  }
}

const profilePage: Page = {
  title: 'Profile',

  render() {
    return `
      <section class="cn-profile">
        <div class="cn-container" id="${ROOT_ID}">${loaderHtml('Loading your profile')}</div>
      </section>
    `;
  },

  async mount() {
    await paint();
  },
};

export default profilePage;
