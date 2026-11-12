/**
 * Settings — device preferences, install, offline sync and data management.
 */

import type { Page } from '@/types/page';
import { getPreferences, setPreference } from '@/state/preferences';
import { clearLearnedPolicy, clearSkillEstimates, learnedPolicySize } from '@/services/adaptive';
import { previewSound } from '@/services/sound';
import { canInstall, isInstalled, onInstallAvailabilityChange, promptInstall, syncNow } from '@/pwa/pwa';
import { clearQueue, pendingCount, pendingResults } from '@/services/sync-queue';
import { deleteGuestProgress, hasGuestProgress } from '@/state/guest';
import { getSession } from '@/state/session';
import { showToast } from '@/components/toast';
import { isAdmin } from '@/services/admin.service';
import { escapeHtml, qs } from '@/utils/dom';
import '@/styles/settings.css';

const ROOT_ID = 'cn-settings-root';

let unsubscribeInstall: (() => void) | null = null;
/** Set once "Delete local data" has been pressed; the second press actually deletes. */
let deleteArmed = false;

function toggleHtml(id: string, label: string, description: string, checked: boolean): string {
  return `
    <div class="cn-setting">
      <div class="cn-setting__text">
        <label class="cn-setting__label" for="${id}">${escapeHtml(label)}</label>
        <p class="cn-setting__desc">${escapeHtml(description)}</p>
      </div>
      <label class="cn-switch">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} />
        <span class="cn-switch__track" aria-hidden="true"></span>
      </label>
    </div>
  `;
}

function actionHtml(id: string, label: string, description: string, button: string, disabled = false): string {
  return `
    <div class="cn-setting">
      <div class="cn-setting__text">
        <span class="cn-setting__label">${escapeHtml(label)}</span>
        <p class="cn-setting__desc">${escapeHtml(description)}</p>
      </div>
      <button type="button" class="btn btn-cn-ghost btn-sm" id="${id}" ${disabled ? 'disabled' : ''}>
        ${escapeHtml(button)}
      </button>
    </div>
  `;
}

function installRowHtml(): string {
  if (isInstalled()) {
    return actionHtml('cn-install', 'Install CN Quest', 'Already installed on this device.', 'Installed', true);
  }
  if (canInstall()) {
    return actionHtml(
      'cn-install',
      'Install CN Quest',
      'Adds CN Quest to your home screen or desktop and enables full offline use.',
      'Install',
    );
  }
  return actionHtml(
    'cn-install',
    'Install CN Quest',
    'Your browser has not offered installation yet. On Chrome, use the install icon in the address bar; on iOS Safari, Share → Add to Home Screen.',
    'Unavailable',
    true,
  );
}

function bodyHtml(): string {
  const prefs = getPreferences();
  const { user, isGuest } = getSession();
  const queued = pendingCount();
  const oldest = pendingResults()[0];

  return `
    <header class="cn-dash__head cn-rise cn-rise-1">
      <div>
        <span class="cn-label cn-label--marked">Settings</span>
        <h1 class="cn-dash__greeting mt-2">Preferences</h1>
      </div>
      <span class="cn-label">${escapeHtml(user ? (user.email ?? 'Signed in') : isGuest ? 'Guest mode' : 'Signed out')}</span>
    </header>

    <section class="cn-settings__group cn-rise cn-rise-2">
      <span class="cn-label cn-label--marked">Experience</span>
      ${toggleHtml('cn-pref-sound', 'Sound effects', 'Short cues for correct answers, level-ups and boss victories.', prefs.soundEnabled)}
      ${toggleHtml('cn-pref-motion', 'Reduce animation', 'Removes transitions and reveals. Your system setting is always respected as well.', prefs.reduceMotion)}
    </section>

    ${
      isAdmin()
        ? `
      <section class="cn-settings__group cn-rise cn-rise-3">
        <span class="cn-label cn-label--marked">Course owner</span>
        ${toggleHtml(
          'cn-pref-admin-mode',
          'Admin editing mode',
          'Shows an "Edit this" button on the topic and dictionary entry you are reading, opening it straight in the dashboard. Off by default so you can read the app exactly as a student does.',
          prefs.adminMode,
        )}
      </section>`
        : ''
    }

    <section class="cn-settings__group cn-rise cn-rise-3">
      <span class="cn-label cn-label--marked">Adaptive learning</span>
      ${toggleHtml(
        'cn-pref-adaptive',
        'Experimental Q-learning recommender',
        `Off: transparent rules decide what to practise next. On: a reinforcement-learning policy chooses the difficulty, falling back to the rules until it has learned something. Currently ${learnedPolicySize()} learned state-action values.`,
        prefs.experimentalAdaptive,
      )}
      ${actionHtml(
        'cn-reset-policy',
        'Reset learned policy',
        'Clears the Q-table so the experimental recommender starts from scratch.',
        'Reset',
        learnedPolicySize() === 0,
      )}
      ${actionHtml(
        'cn-reset-skill',
        'Reset adaptive difficulty',
        'Quiz, Rapid Fire, Boss Battle, Packet Dash and Packet Runner adjust their difficulty to how you perform. This forgets that estimate and starts each one fresh.',
        'Reset',
        false,
      )}
    </section>

    <section class="cn-settings__group cn-rise cn-rise-4">
      <span class="cn-label cn-label--marked">Offline</span>
      ${installRowHtml()}
      ${actionHtml(
        'cn-sync',
        'Pending progress',
        queued === 0
          ? 'Everything you have played is saved. Rounds finished offline appear here until they sync.'
          : `${queued} round${queued === 1 ? '' : 's'} waiting to sync${oldest ? ` since ${oldest.queuedAt.slice(0, 10)}` : ''}.`,
        queued === 0 ? 'Nothing pending' : 'Sync now',
        queued === 0,
      )}
      ${actionHtml(
        'cn-clear-queue',
        'Discard pending rounds',
        'Throws away unsynced offline results. Only use this if syncing keeps failing.',
        'Discard',
        queued === 0,
      )}
    </section>

    <section class="cn-settings__group cn-rise cn-rise-4">
      <span class="cn-label cn-label--marked">Data</span>
      ${actionHtml(
        'cn-clear-local',
        'Delete local guest data',
        'Permanently removes guest XP, mastery, attempts and badges stored on this device. Account progress is not affected.',
        'Delete',
        !hasGuestProgress(),
      )}
      ${
        user || isGuest
          ? `<div class="cn-setting">
               <div class="cn-setting__text">
                 <span class="cn-setting__label">${isGuest ? 'Exit guest mode' : 'Sign out'}</span>
                 <p class="cn-setting__desc">
                   ${
                     isGuest
                       ? 'Ends the guest session. Local progress is kept and resumes next time.'
                       : 'Signs you out on this device. Your progress stays in your account.'
                   }
                 </p>
               </div>
               <a class="btn btn-cn-ghost btn-sm" href="#/logout">${isGuest ? 'Exit' : 'Sign out'}</a>
             </div>`
          : ''
      }
    </section>

    <p class="cn-label mt-5">Preferences are stored on this device, not in your account.</p>
  `;
}

function paint(): void {
  const root = qs(`#${ROOT_ID}`);
  if (!root) return;

  deleteArmed = false;
  root.innerHTML = bodyHtml();

  qs<HTMLInputElement>('#cn-pref-sound', root)?.addEventListener('change', (event) => {
    const enabled = (event.target as HTMLInputElement).checked;
    setPreference('soundEnabled', enabled);
    if (enabled) previewSound();
  });

  qs<HTMLInputElement>('#cn-pref-motion', root)?.addEventListener('change', (event) => {
    setPreference('reduceMotion', (event.target as HTMLInputElement).checked);
    showToast('Animation preference updated.', { variant: 'info' });
  });

  qs<HTMLInputElement>('#cn-pref-admin-mode', root)?.addEventListener('change', (event) => {
    const on = (event.target as HTMLInputElement).checked;
    setPreference('adminMode', on);
    showToast(
      on
        ? 'Admin editing on. Open a topic or dictionary term to edit it in place.'
        : 'Admin editing off. You are seeing the app as a student does.',
      { title: 'Admin mode', variant: 'info' },
    );
  });

  qs<HTMLInputElement>('#cn-pref-adaptive', root)?.addEventListener('change', (event) => {
    const on = (event.target as HTMLInputElement).checked;
    setPreference('experimentalAdaptive', on);
    showToast(
      on
        ? 'Experimental recommender enabled. It falls back to the rules until it learns.'
        : 'Back to the transparent rule-based recommender.',
      { title: 'Adaptive engine', variant: 'info' },
    );
    paint();
  });

  qs<HTMLButtonElement>('#cn-reset-policy', root)?.addEventListener('click', () => {
    clearLearnedPolicy();
    showToast('Learned policy cleared.', { variant: 'warning' });
    paint();
  });

  qs<HTMLButtonElement>('#cn-reset-skill', root)?.addEventListener('click', () => {
    clearSkillEstimates();
    showToast('Adaptive difficulty reset.', { variant: 'warning' });
  });

  qs<HTMLButtonElement>('#cn-install', root)?.addEventListener('click', () => {
    void promptInstall().then((accepted) => {
      if (!accepted) showToast('Installation cancelled.', { variant: 'info' });
    });
  });

  qs<HTMLButtonElement>('#cn-sync', root)?.addEventListener('click', () => {
    void syncNow().then(paint);
  });

  qs<HTMLButtonElement>('#cn-clear-queue', root)?.addEventListener('click', () => {
    clearQueue();
    showToast('Pending offline rounds discarded.', { variant: 'warning' });
    paint();
  });

  const deleteButton = qs<HTMLButtonElement>('#cn-clear-local', root);
  deleteButton?.addEventListener('click', () => {
    // Two-step: deleting progress is irreversible, so the first press only arms it.
    if (!deleteArmed) {
      deleteArmed = true;
      deleteButton.textContent = 'Confirm delete';
      deleteButton.classList.add('cn-danger');
      showToast('Press again to permanently delete local guest data.', {
        title: 'Are you sure?',
        variant: 'warning',
      });
      return;
    }

    deleteGuestProgress();
    showToast('Local guest data deleted.', { variant: 'success' });
    paint();
  });
}

const settingsPage: Page = {
  title: 'Settings',

  render() {
    return `
      <section class="cn-settings">
        <div class="cn-container cn-container--narrow" id="${ROOT_ID}"></div>
      </section>
    `;
  },

  mount() {
    paint();
    // The install prompt can arrive after the page renders.
    unsubscribeInstall = onInstallAvailabilityChange(() => paint());
  },

  unmount() {
    unsubscribeInstall?.();
    unsubscribeInstall = null;
  },
};

export default settingsPage;
