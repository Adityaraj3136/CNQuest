import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * Where the app will be served from. Firebase Hosting serves it at the domain root; GitHub
 * Pages serves a project site under `/<repo>/`, and every built asset URL has to carry that
 * prefix or the page loads and then 404s its own JavaScript.
 */
const base = process.env.BASE_PATH ?? '/';

/** When this build was made (UTC), shown in Settings so a phone can confirm it has the latest. */
const buildId = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  base,
  define: {
    __APP_BUILD__: JSON.stringify(buildId),
  },
  plugins: [
    VitePWA({
      // A new build takes effect on the next visit rather than nagging mid-quiz.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/icon.svg', 'icons/icon-maskable.svg', 'offline.html'],
      manifest: false, // public/manifest.webmanifest is maintained by hand
      devOptions: {
        // Keep the dev server free of a service worker; test the PWA against `npm run preview`.
        enabled: false,
      },
      workbox: {
        // The whole app shell and every bundled lesson is precached, which is what makes
        // Learn, the dictionary and all six games work with no network at all.
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/offline\.html$/],
        cleanupOutdatedCaches: true,
        // Bootstrap Icons' CSS requests its font as `bootstrap-icons.woff2?<hash>`, but the
        // precache stores the bare filename. Workbox only strips utm_/fbclid by default, so
        // the request missed the cache and icons vanished offline. Every asset filename is
        // already content-hashed, so query strings carry no meaning for precache matching.
        ignoreURLParametersMatching: [/.*/],
        // Bootstrap Icons' woff2 pushes past the default 2 MiB ceiling on some builds.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Lesson diagrams are admin-supplied and live on arbitrary hosts, so the precache
            // never sees them. Cached after first view so a lesson read once still shows its
            // diagram offline.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cn-lesson-media',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Firestore/Auth must never be served from a stale cache.
            urlPattern: /^https:\/\/(firestore|identitytoolkit|securetoken)\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // bootstrap-icons is a stylesheet plus font files — there is nothing to pre-bundle, and
    // letting the dep optimizer take it caused "file does not exist in the optimize deps
    // directory" after a long dev session, which silently killed every icon on the page.
    exclude: ['bootstrap-icons'],
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
});
