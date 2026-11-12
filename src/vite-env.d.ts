/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_USE_FIREBASE_EMULATORS?: string;
  /** Public OAuth Web client id for in-app Google sign-in (Google Identity Services). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Comma-separated origins authorised for that client; GIS is used only on these. */
  readonly VITE_GOOGLE_GIS_ORIGINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Build timestamp injected by vite.config.ts (UTC, "YYYY-MM-DD HH:MM"). */
declare const __APP_BUILD__: string;
