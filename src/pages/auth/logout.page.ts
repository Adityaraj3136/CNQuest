/** Signs the student out, then returns them to the landing page. */

import type { Page } from '@/types/page';
import { signOut } from '@/services/auth.service';
import { clearGuestSession } from '@/state/session';
import { showToast } from '@/components/toast';
import { navigate } from '@/router';
import { loaderHtml } from '@/components/loader';

const logoutPage: Page = {
  title: 'Signing out',

  render() {
    return `<section class="cn-section">${loaderHtml('Signing you out…')}</section>`;
  },

  async mount() {
    try {
      // Guest data is deliberately discarded on an explicit sign-out.
      clearGuestSession();
      await signOut();
      showToast('You have been signed out. Your progress is saved.', { variant: 'success' });
    } catch (error) {
      console.error('[logout]', error);
      showToast('We could not sign you out. Please try again.', { variant: 'error' });
    } finally {
      navigate('/', true);
    }
  },
};

export default logoutPage;
