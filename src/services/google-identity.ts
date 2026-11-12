/**
 * Google sign-in without leaving the app, via Google Identity Services (GIS).
 *
 * GIS shows the browser's own account chooser over the page (FedCM in Chrome and Edge), listing
 * the Google accounts already signed in on this device. Picking one returns an ID token, which
 * Firebase exchanges for a session: no new tab, no popup window, no password typed. Browsers
 * without FedCM fall back to Google's own small account dialog.
 *
 * The client id is the project's public OAuth Web client (the one Firebase Auth already uses).
 * The page origin must be listed under "Authorised JavaScript origins" for that client in
 * Google Cloud Console, or GIS refuses to render.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const LOAD_TIMEOUT_MS = 8000;
/** GIS caps the button at 400px wide. */
const MAX_BUTTON_WIDTH = 400;

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

interface CredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin' | 'signup' | 'use';
    itp_support?: boolean;
    use_fedcm_for_prompt?: boolean;
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
  prompt(): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

export function isGoogleIdentityConfigured(): boolean {
  return CLIENT_ID.length > 0;
}

let loading: Promise<GoogleAccountsId> | null = null;

function loadGis(): Promise<GoogleAccountsId> {
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google.accounts.id);
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    const timer = window.setTimeout(() => reject(new Error('Google sign-in took too long to load')), LOAD_TIMEOUT_MS);
    script.onload = () => {
      window.clearTimeout(timer);
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error('Google sign-in loaded without its API'));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('Google sign-in could not be loaded (offline or blocked)'));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null; // let the next screen try again, e.g. after reconnecting
    throw error;
  });
  return loading;
}

/** The screen currently showing a Google button; GIS has one global callback, so it is swapped. */
let onCredential: ((idToken: string) => void) | null = null;
let initialised = false;

/**
 * Origins listed under "Authorised JavaScript origins" for the client in Google Cloud Console.
 * On any other origin GIS renders a button that cannot work (Google reports the rejection only
 * inside its own iframe, where the page cannot see it), so those origins use the redirect.
 * Override with VITE_GOOGLE_GIS_ORIGINS (comma-separated) after authorising a new origin.
 */
const DEFAULT_GIS_ORIGINS = ['https://cn-quest.firebaseapp.com', 'https://adityaraj3136.github.io'];

function gisOrigins(): string[] {
  const configured = (import.meta.env.VITE_GOOGLE_GIS_ORIGINS ?? '').trim();
  return configured ? configured.split(',').map((origin) => origin.trim()).filter(Boolean) : DEFAULT_GIS_ORIGINS;
}

/** True when GIS can run here: a client id is set and this origin is authorised for it. */
export function canUseGoogleIdentity(): boolean {
  return isGoogleIdentityConfigured() && gisOrigins().includes(window.location.origin);
}

/**
 * Renders Google's button into `container` and offers the account chooser straight away.
 * Resolves false when GIS is unavailable, so the caller can show its fallback instead.
 */
export async function mountGoogleButton(
  container: HTMLElement,
  onToken: (idToken: string) => void,
  text: 'signin_with' | 'signup_with' | 'continue_with' = 'continue_with',
): Promise<boolean> {
  if (!canUseGoogleIdentity()) return false;
  try {
    const id = await loadGis();
    onCredential = onToken;
    if (!initialised) {
      id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => onCredential?.(response.credential),
        auto_select: false, // shared lab machines: always let the student pick
        cancel_on_tap_outside: true,
        context: 'signin',
        itp_support: true,
        use_fedcm_for_prompt: true,
        use_fedcm_for_button: true,
      });
      initialised = true;
    }
    container.replaceChildren();
    id.renderButton(container, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text,
      shape: 'rectangular',
      logo_alignment: 'left',
      width: Math.min(MAX_BUTTON_WIDTH, Math.max(200, Math.round(container.clientWidth || 320))),
    });
    id.prompt(); // the in-page chooser of already signed-in accounts
    return true;
  } catch (error) {
    console.warn('[auth] Google Identity Services unavailable; using the redirect fallback', error);
    return false;
  }
}

/** Closes the account chooser, e.g. when leaving the sign-in screen. */
export function cancelGooglePrompt(): void {
  onCredential = null;
  window.google?.accounts?.id?.cancel();
}
