# CN Quest

**Reinforcement AI Based Gamified Learning Platform for Computer Networks**

CN Quest is an installable Progressive Web App that helps B.Tech / undergraduate Computer Science
students revise the Computer Networks syllabus through short learning topics, six game modes, XP,
levels, daily streaks, achievements and topic-wise mastery tracking.

It is designed as a **supplement to textbooks and classroom teaching**, not a replacement.

> **Status: Phase 12 — feature complete.** Every phase of the specification is built: six game
> modes, the gamification engine, dashboard, dictionary, analytics, an installable offline-capable
> PWA and a two-implementation adaptive engine. 156 automated self-checks pass, the security rules
> are hardened, and the manual test plan lives in [TESTING.md](TESTING.md). Deployment needs only
> your Firebase project.

---

## Technology stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript (strict) |
| Build tool | Vite 6 |
| Markup / styling | HTML5, CSS3 custom properties, Bootstrap 5 |
| Icons | Bootstrap Icons |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore (with a bundled offline fallback) |
| Hosting | Firebase Hosting |
| Adaptive | Rule-based engine, opt-in tabular Q-learning |
| Offline | Service worker (Workbox via vite-plugin-pwa) + localStorage sync queue |

No heavyweight frontend framework is used — screens are plain TypeScript modules rendered by a small
hash router.

---

## Features

Shipped in Phase 1:

- Responsive marketing landing page (hero, features, how it works, PWA callout)
- Design-token system (`src/styles/variables.css`) used by every component
- Hash router with lazy-loaded screens, layouts, auth-guard hook and friendly error states
- Login, Register and Forgot-password screens with full client-side validation, error messaging,
  loading states and accessible field errors
- Reusable components: navbar (with mobile toggle), footer, loader/skeleton, toast notifications
- Live online/offline connectivity indicator
- Environment-driven, lazily initialised Firebase module
- PWA manifest, icons (standard + maskable) and offline fallback page

Shipped in Phase 2:

- Email/password registration, login (with "keep me signed in"), logout and password reset
- Firestore profile document created at `users/{uid}` with default statistics on registration
- Session store wrapping `onAuthStateChanged`, with automatic profile repair via `ensureUserProfile`
- Route guards: protected routes redirect to `/login?next=…`; signed-in students are bounced off the
  auth screens
- Minimal live dashboard reading the Firestore profile (level, XP bar, streak, games, accuracy)
- Firebase-error-code → student-friendly message mapping (no stack traces or raw codes in the UI)
- **Guest mode** — "Try as guest" / "Continue as guest" opens a local session with no credentials,
  so the app is fully usable before Firebase is connected. The guest profile is a `UserProfile` in
  localStorage, so every screen reads one type either way. Exiting guest mode ends the session but
  keeps local progress; only Settings (Phase 10) deletes it.
- Firestore security rules for all planned collections
- Level maths (`src/config/level.config.ts`) with a Node test-runner self-check

Shipped in Phase 3:

- Full content model — units, topics, questions, riddles, dictionary terms, achievements, matching
  sets, word-search banks and bosses
- **207 seed documents**: 6 units, 17 topics with revision notes, 90 questions across three
  difficulties, 12 riddles, 60 dictionary terms, 10 achievements, 5 matching sets, 4 word banks,
  3 bosses
- `ContentService` — reads Firestore when configured and populated, otherwise the copy bundled with
  the app, so Learn and the games work offline and in guest mode
- Pure selection helpers: filtering, round picking with progressive widening, lenient riddle-answer
  matching, dictionary search
- **Learn** screen (unit → topic browser) and **Topic detail** (overview, key points, definitions,
  examples, related terminology, practice entry points)
- `scripts/seed.mjs` — uploads the same seed data to Firestore
- 32 self-checks including seed-data referential integrity

Shipped in Phase 4:

- **Quiz Blitz** — 10 questions, 20 seconds each, four options, instant feedback with explanations,
  live score and streak, per-question progress bar
- A timeout counts as a wrong answer, so the clock actually matters
- Results screen: score, accuracy, best streak, time, and a **transparent XP breakdown** showing
  answer XP plus accuracy, streak and perfect-round bonuses
- Review Answers, Play Again and Dashboard actions
- Keyboard play: `1`-`4` answer, `Enter` advances
- `QuizEngine` — a pure, DOM-free state machine with an injectable clock, covered by 16 self-checks
  and reusable by Rapid Fire and Boss Battle in Phase 7
- `src/config/xp.config.ts` — every reward value in one place, no magic numbers in games
- `GameResult` / `GameSummary` models — the single hand-off shape all six modes will produce
- Games hub listing all six modes, honestly marking the five still to come

Shipped in Phase 5:

- **One result pipeline** every game feeds: `GameResult` → attempt record → XP → level → topic
  mastery → streak → achievements → profile. Games decide nothing; `processGameResult()` decides
  everything, once, for all six modes.
- **One storage interface, two implementations** — guest progress in localStorage, account progress
  in Firestore. The pipeline never branches on which.
- Streak logic on **local calendar dates**: twice in one evening is one day, 23:50 then 00:10 is two,
  and a backwards clock cannot inflate a run
- Transparent mastery: `0.7 × accuracy + 0.3 × completion`, banded Beginner → Mastered
- Achievement evaluation via a measure registry — duplicate awards are structurally impossible, and
  a seeded badge with no measure fails the test suite rather than silently never unlocking
- Quiz results now show level-ups, unlocked badges, streak movement and mastery change, with the
  achievement XP itemised in the ledger
- **Achievements screen** with live progress towards every badge, unlocked first
- 26 new self-checks covering the three places gamification usually breaks

Shipped in Phase 6:

- Full dashboard on live data: level and XP panel, four-stat ledger, **overall course completion**,
  continue-learning, recommended challenge, six mode tiles, weak topics and an achievement strip
- `loadDashboard()` gathers everything in **one parallel read** — no query per widget
- **Rule-based recommender** (`recommendNext`): a lapsing streak outranks everything, then weak
  topics get easy questions, mid-range topics get medium, strong students advance to a new topic or
  step up to hard. Every recommendation states its reason in plain English.
- Streak-at-risk detection in the header
- 15 more self-checks covering aggregation windows and every recommender branch

Shipped in Phase 7:

- **Rapid Fire** — one 60-second clock, immediate advance, no mid-round explanations; every answer
  is reviewable afterwards. Late clicks after the buzzer are rejected.
- **Match & Pair** — tap-to-match (works with mouse, finger and keyboard alike), independently
  shuffled columns, mistakes cost accuracy, partial boards pay pro rata
- **Network Riddles** — typed answers matched leniently for case, spacing and punctuation; each hint
  lowers that riddle's reward, and hint-free solves feed the Riddle Solver achievement
- **Boss Battle** — HP duel against three bosses. Damage scales with question difficulty; wrong
  answers and timeouts cost you HP. Running out of questions or fleeing is a defeat, so no XP
  farming by quitting.
- **Word Search** — a real generated grid: words placed in difficulty-dependent directions with
  overlap support, reversed words on hard, and pointer-based drag *or* tap-first-and-last selection
- `game-shell.ts` — one results screen shared by all six modes, so they can never drift apart
- 32 more self-checks, one suite per engine

Shipped in Phase 8:

- **Networking Dictionary** — live search across term, definition and category; nine category
  filters; an A–Z index built only from letters that have entries; and a sticky detail panel with
  examples and clickable related terms
- Deep links: `#/dictionary?term=dns` opens that entry, and selecting a term rewrites the URL with
  `replaceState` so the link stays shareable without re-running the router
- **View history stored as term ids, not a counter** — re-reading DNS ten times counts once, so the
  Dictionary Explorer achievement cannot be farmed
- `AchievementService.evaluateAndUnlock()` extracted so the game pipeline and the dictionary award
  badges through one code path
- A seed-data check that every achievement target is actually reachable (50 terms needed, 60 exist)

Shipped in Phase 9:

- **Progress screen** with all four levels the spec asks for: overall course, per unit, per topic
  and per game mode, plus recent activity
- Eight headline figures, expandable unit sections, and a mastery table per topic
  (attempted / correct / accuracy / mastery / band)
- **14-day trends** as inline SVG — daily XP bars and an accuracy line. No charting library: two
  chart types don't justify a dependency, and inline SVG inherits the design tokens
- Days with no activity render as **gaps, not zeros** — an idle day is missing data, not 0% accuracy
- Mode accuracy is **weighted by questions**, so a one-question round can't skew the average
- Topic pages now show real mastery instead of a stubbed 0%
- 12 more self-checks covering series continuity, month boundaries and weighting

Shipped in Phase 10:

- **Service worker** via `vite-plugin-pwa` (Workbox): 56 precached entries covering the app shell,
  every route chunk, the icons and the bundled syllabus. Firebase endpoints are `NetworkOnly` so
  auth and Firestore are never served stale.
- Update prompt on a new build rather than a forced reload mid-quiz
- **Install** button in Settings, driven by the captured `beforeinstallprompt`, with honest
  guidance when the browser has not offered installation
- **Offline result queue** — a round that cannot be saved is stored locally and replayed through
  the *same* pipeline on reconnect, so offline play earns identical XP, mastery and achievements
- **Settings screen**: sound, reduced animation, install, pending-sync status, discard queue,
  delete local guest data (two-press confirm), sign out
- **Sound effects** synthesised with the Web Audio API — six cues, no audio files to download
- In-app reduced-motion toggle honoured alongside the OS `prefers-reduced-motion` setting
- 8 more self-checks on the queue: per-user isolation, retry exhaustion, the storage cap

Shipped in Phase 11:

- **`AdaptiveLearningEngine` interface** — screens and games depend on the contract, never on an
  implementation, which is what lets the policy be swapped without touching a game module
- **Version 1, rule-based** (default): an eight-rule priority ladder — lapsing streak → rushing →
  repeated weak rounds → weak topic → advance → push difficulty → keep practising. Every branch
  states its reason in plain English.
- Two new signals over the Phase 6 recommender: **response time** (fast *and* wrong is treated as
  guessing, not as difficulty) and **consecutive weak rounds**
- An evidence guard: 100% on two questions no longer promotes a student to hard questions
- **Version 2, Q-learning** (opt-in, experimental): 36-state bucketed table, four actions, rewards
  weighted so *improving a weak topic* beats farming easy questions. An untrained state falls back
  to the rules, so the student is never worse off than Version 1.
- The loop closes: finished rounds feed `observeOutcome()` back to the engine
- **Adaptive difficulty in play** — a topic quiz with no explicit difficulty asks the engine
- Settings exposes the engine choice, the learned state-action count and a policy reset
- 23 self-checks across both engines, including the Q-update maths

Shipped in Phase 12:

- **Hardened Firestore rules** — profiles must start at zero, cumulative counters can only grow,
  a single write may add at most 1000 XP, attempt records are immutable, and every document is
  scoped to its owner. Content collections are read-only for all clients.
- [TESTING.md](TESTING.md) — the full manual plan: 60+ functional cases, responsive and
  accessibility checklists, browser matrix, PWA procedure, a security-rules attack list, and the
  10-statement UAT form
- `npm run verify` (typecheck → tests → build) and one-command deploy scripts
- Audit clean: no `console.log`, no committed secrets, `.env` and service keys git-ignored
- **Profile screen** (§49): identity, level and XP, headline statistics, earned badges, editable
  display name and preset avatar, and a password-reset action for account holders
services, progress analytics, networking dictionary, leaderboard, service worker with offline sync,
and the adaptive learning engine.

---

## Design system — "Technical Editorial"

CN Quest commits to one visual direction: **a networking instrument that happens to be a game.**
Ink on paper, hairline rules, oversized display type, and monospace for anything that is *data*.

| Element | Decision |
| --- | --- |
| Canvas | Warm paper `#f5f4f1` under a faint blueprint grid — drafting paper, not a blank page |
| Ink | Near-black `#12151a`; an inverted "field" panel carries weight on hero, dashboard and results |
| Accent | One electric blue `#0b46ff` for every interactive signal |
| Reward | Amber `#ff8a00`, reserved **exclusively** for XP and streaks |
| Type | System sans for prose; monospace for all data (XP, timers, scores, ports, masks) |
| Radius | 2-4px. Editorial work does not round its corners |
| Depth | Rules and space, not shadows and floating cards |
| Motion | One staged rise on load, one packet-trace line that draws itself, a draining timer rule |

Three rules for anyone extending it (also stated at the top of `variables.css`):

1. **Data is monospace, prose is sans.** Never mix them up.
2. **Separation comes from hairline rules and space**, not from boxes and shadows.
3. **One accent.** If something must stand out, use scale or a rule — not a new colour.

No web fonts: the app must install and run offline, and the artifact CSP would block a CDN anyway.
Character comes from scale, weight, tracking and case instead.

Bootstrap 5 is still the base layer (reset, grid, form controls, spacing utilities) as the project
brief requires; the palette, type and every component surface above it are bespoke.

## Architecture

Every game feeds one shared result pipeline. Games never touch XP, levels, streaks or achievements
directly.

```
Quiz · Rapid Fire · Boss Battle · Match & Pair · Riddles · Word Search
                          |
                      GameResult
                          |
                Game Result Processor
                          |
        +-----------------+-----------------+
        |                 |                 |
       XP             Progress           Streak
        |                 |                 |
        +-----------------+-----------------+
                          |
                  Achievement check
                          |
                  Adaptive engine
                          |
                       Firebase
```

### Source layout

```
CN Quest/
├── public/
│   ├── manifest.webmanifest      # PWA manifest
│   ├── offline.html              # Offline fallback page
│   └── icons/                    # App icons (standard + maskable)
├── src/
│   ├── components/               # navbar, footer, loader, toast
│   ├── config/                   # app.config.ts, firebase.ts, level.config.ts
│   ├── data/                     # Bundled seed content (units, topics, questions, …)
│   ├── games/
│   │   └── quiz/                 # quiz.engine.ts (pure rules) + quiz.page.ts (UI)
│   ├── models/                   # user.ts, content.ts (document shapes)
│   ├── services/                 # auth, user, content service + pure content filters
│   ├── state/                    # session.ts (single source of truth for auth)
│   ├── pages/
│   │   ├── landing/
│   │   ├── auth/                 # login, register, forgot-password, logout, shared shell
│   │   ├── dashboard/
│   │   ├── learn/                # unit browser + topic detail
│   │   └── leaderboard/          # all-time XP ranking
│   ├── styles/                   # variables, global, components, landing, auth, dashboard
│   ├── types/                    # Page / route contracts
│   ├── utils/                    # dom + validation helpers
│   ├── router.ts                 # Hash router
│   ├── routes.ts                 # Route table
│   └── main.ts                   # Entry point
├── scripts/
│   └── seed.mjs                  # Uploads src/data to Firestore
├── index.html
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

Directories for `src/games/`, `src/services/` and `src/models/` are introduced in the phases that
first need them, so the tree stays free of empty folders.

---

## Getting started

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- A Firebase project (only needed from Phase 2 onwards)

### Install and run

```bash
npm install
npm run dev
```

The dev server starts on <http://localhost:5173>.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run typecheck` | Run the TypeScript compiler with no emit |
| `npm run build` | Type-check, then produce an optimised build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test:units` | Run the Node test-runner self-checks (no framework) |
| `npm run seed:dry` | List the seed documents without writing anything |
| `npm run seed` | Upload the seed content to Firestore (needs a service-account key) |

---

## Firebase setup

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Add a **Web app** to the project and copy the SDK configuration values.
3. Enable **Authentication → Sign-in method → Email/Password**.
4. Create a **Cloud Firestore** database (start in production mode; rules land in Phase 3).
5. Copy the environment template and fill it in:

   ```bash
   cp .env.example .env
   ```

   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

6. Restart `npm run dev` so Vite picks up the new variables.
7. Deploy the security rules before registering a student — the default locked database rejects the
   profile write:

   ```bash
   npx firebase-tools login
   npx firebase-tools use --add
   npx firebase-tools deploy --only firestore:rules
   ```

`.env` is git-ignored. The `VITE_FIREBASE_*` values are **public client keys** and are safe to ship in
the bundle — access is controlled by Firestore security rules, not by hiding these values. Never
commit an admin/service-account key.

### Local emulators (optional)

Set `VITE_USE_FIREBASE_EMULATORS=true` in `.env` and run `firebase emulators:start` to point Auth and
Firestore at `127.0.0.1:9099` / `127.0.0.1:8080`.

---

## Security

The client is untrusted. XP and mastery are computed in the browser in this build (no Cloud
Functions), so `firestore.rules` is the enforcement layer. It provides defence in depth:

| Control | Effect |
| --- | --- |
| Ownership checks | A student can only read or write documents keyed to their own `uid` |
| Read-only content | `questions`, `topics`, `dictionary` and the rest reject all client writes |
| Clean start | A new profile must be created with `level: 1` and every counter at zero |
| Monotonic counters | `totalXP`, `gamesPlayed`, `questionsAnswered`, `correctAnswers` and
  `longestStreak` can never decrease — you cannot reset a counter to re-earn a badge |
| XP rate limit | One write may add at most **1000 XP** — no jumping to level 40 in a single call |
| Coherence | `correctAnswers <= questionsAnswered`, `currentStreak <= longestStreak`, percentages
  bounded 0-100 |
| Immutable audit trail | `gameAttempts` and `userAchievements` are create-only |
| Leaderboard field allow-list | `leaderboard/{uid}` accepts *only* `uid`, `name`, `level`,
  `totalXP`, `updatedAt` — no profile field can be smuggled into a world-readable document,
  and its XP is monotonic and rate-limited exactly like the profile it mirrors |
| Default deny | Any path not explicitly matched is refused |

**Stated honestly:** these rules stop tampering and implausible values, but a client can still
submit a *plausible* result it did not earn. Closing that gap means moving scoring into a Cloud
Function — which the architecture already allows, since games only produce a `GameResult` and one
service processes it.

Other measures: `.env` and `serviceAccountKey.json` are git-ignored; the client Firebase keys are
public by design and protected by these rules; password reset returns an identical message for
registered and unregistered addresses (no account enumeration); no `console.log` of user data.

The attack cases to run against a live project are in [TESTING.md](TESTING.md#7-security-review).

---

## Deployment

```bash
npm run verify                 # typecheck + 156 tests + production build
npx firebase-tools login
npx firebase-tools use --add   # select your Firebase project
npm run deploy                 # verify, then deploy hosting + rules
```

Targeted deploys:

```bash
npm run deploy:hosting         # app only
npm run deploy:rules           # security rules only — do this before students register
```

`firebase.json` serves `dist/`, rewrites all paths to `index.html`, applies immutable caching to
hashed assets, and leaves `index.html` and the manifest uncached so updates are picked up.

### Deployment checklist

- [ ] `.env` filled in with the production Firebase project
- [ ] Authentication → Email/Password enabled
- [ ] Firestore database created
- [ ] `npm run deploy:rules` run **before** any student signs up
- [ ] `npm run seed` run if you want content editable from the Console
- [ ] `npm run verify` passes
- [ ] Post-deploy: register a throwaway account and complete one full round
- [ ] Post-deploy: confirm the PWA installs from the hosted URL

---

## Firestore collections

Content (read-only for students): `units` · `topics` · `questions` · `riddles` · `dictionary` ·
`achievements` · `matchingSets` · `wordSearchSets` · `bosses`

Per-student: `users` · `gameAttempts` · `userProgress` · `userAchievements`

Shared, readable by any signed-in student: `leaderboard` — one document per student holding
`uid`, `name`, `level`, `totalXP` and `updatedAt`, and nothing else. It is a mirror of the
public-safe slice of `users/{uid}`, written by the owner on every profile save.

---

## Testing

```bash
npm run verify        # typecheck + 156 self-checks + production build
npm run test:units    # self-checks only
```

**156 automated self-checks** run on Node's built-in test runner with no framework — see the
coverage table in [TESTING.md](TESTING.md#1-automated-coverage). They cover the logic that
silently breaks a gamified app: streak dates across DST and year boundaries, mastery that must
never exceed 100, achievements that must never award twice, seed-data cross-references, the
word-search generator, the offline queue, and the Q-learning update.

Everything a browser is needed for — layout, event wiring, PWA behaviour, accessibility — is in
the **manual plan**: [TESTING.md](TESTING.md). It contains 60+ functional cases, responsive and
accessibility checklists, a browser matrix, the PWA procedure, security-rule attack cases, and the
10-statement UAT form for student evaluation.

> PWA features are disabled on the dev server by design. Test them with
> `npm run build && npm run preview`.

---

## Development phases

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: scaffold, design system, routing, landing, auth layouts, PWA manifest | ✅ Done |
| 2 | Firebase Authentication + Firestore profile creation | ✅ Done |
| 3 | Data model: units, topics, questions, achievements, dictionary, seed data | ✅ Done |
| 4 | Quiz Blitz | ✅ Done |
| 5 | Gamification engine: XP, level, streak, achievement, progress, result services | ✅ Done |
| 6 | Dashboard on live Firestore data | ✅ Done |
| 7 | Rapid Fire, Match & Pair, Riddles, Boss Battle, Word Search | ✅ Done |
| 8 | Networking dictionary | ✅ Done |
| 9 | Progress analytics | ✅ Done |
| 10 | Service worker, offline content, sync queue | ✅ Done |
| 11 | Adaptive learning engine | ✅ Done |
| 12 | Testing, security review, deployment | ✅ Done |

---

## Troubleshooting

**Icons show as blank boxes**
- *In development:* Vite's dependency optimiser had cached `bootstrap-icons` and lost the entry
  after a long session. `bootstrap-icons` is now in `optimizeDeps.exclude`. If it recurs, stop the
  dev server, delete `node_modules/.vite`, and start it again.
- *In the built app, offline:* the icon font is requested with a `?hash` query that did not match
  the precached filename. Fixed with `ignoreURLParametersMatching` in the Workbox config — rebuild
  and let the new service worker activate.

**"We couldn't load this screen"**

Screens are lazily imported chunks. If the page has been open across a rebuild or a dev-server
restart, it holds filenames that no longer exist and the import 404s. The router now detects a
chunk-load failure and reloads once automatically; the error state's button forces a hard reload.

If it persists, a stale service worker is serving an old build:

> DevTools → Application → Service Workers → **Unregister**, then Storage → **Clear site data**,
> then reload.

**Stale service worker during development**

The service worker is only registered in production builds, but one registered from an earlier
`npm run preview` on the same origin keeps controlling that origin. Unregister it before going
back to dev work on the same port.

---

## Known limitations

Stated plainly rather than discovered in a viva:

1. **Scoring is client-side.** Mitigated by the rules above, not eliminated. Cloud Functions are
   the fix and the architecture is ready for them.
2. **Guest progress does not merge into a new account.** Signing up starts a fresh account; the
   guest data stays on the device. Merging needs a conflict policy (which streak survives? do
   attempts double-count?) that has not been designed.
3. **The syllabus is generated seed content**, not university-approved. Topic ids are referenced by
   90 questions, 12 riddles and 9 game sets, so remapping is a find-and-replace plus a test run.
4. **The offline queue uses localStorage**, not IndexedDB. Fine for a handful of small results;
   revisit if offline data grows.
5. **Q-learning is experimental and off by default.** A student produces too few episodes to train
   a tabular policy properly; it is included to demonstrate the interface and the RL component.
6. **Bootstrap ships in full** (~48 kB gzipped CSS) although the design uses only its reset, grid
   and form base. Importing only the used partials would recover most of that.
7. **No admin dashboard.** Content is managed through the Firebase Console or the seed script.
8. **The leaderboard ranks all-time XP only, and no weekly board.** Weekly ranking needs a
   per-week XP counter that resets, which is a second write path and a second monotonicity story;
   all-time XP is already on the profile and needed neither.
9. **A leaderboard row is written by the student it describes**, not by a Cloud Function. The rules
   restrict it to a five-field allow-list with monotonic, rate-limited XP, so it is exactly as
   trustworthy as the profile it mirrors — no more, no less. It inherits limitation 1 and is fixed
   by the same change.
10. **Students outside the top 50 see their own row without a rank.** Computing "you are 137th"
    means an aggregate count query per page load for a number nobody asked for.

---

## Future enhancements

- Admin dashboard for managing topics, questions, riddles and achievements
- Cloud Functions for server-side XP validation and anti-cheating
- Contextual-bandit / Q-learning replacement for the rule-based adaptive engine
- Weekly leaderboard (needs a resetting per-week XP counter) and class/cohort filtering
- Dark mode
- Google Sign-In

---

## Academic note

Sample educational content shipped with this repository is generated for development and demo
purposes. It must be reviewed and replaced with the official university Computer Networks syllabus
content before academic use.
