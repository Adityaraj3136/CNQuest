# CN Quest — Test Plan

This is the manual test plan required by the project specification, alongside the automated
self-checks. Run the automated suite first; it catches logic regressions far faster than clicking.

```bash
npm run typecheck     # TypeScript, strict mode
npm run test:units    # 156 self-checks, no framework
npm run build         # production build + service worker
npm run preview       # serve the build — REQUIRED for any PWA testing
```

The service worker is disabled on the dev server by design. **All PWA testing must use
`npm run build && npm run preview`.**

---

## 1. Automated coverage

| Suite | File | What it protects |
| --- | --- | --- |
| Level maths | `src/config/level.config.test.ts` | XP thresholds, level inversion, clamping |
| Guest storage | `src/state/guest.test.ts` | Sign-out keeps progress, corrupt data, schema drift |
| Seed integrity | `src/data/content.test.ts` | Every id, cross-reference and achievement target |
| Quiz engine | `src/games/quiz/quiz.engine.test.ts` | Scoring, streaks, timeout, XP, result shape |
| Gamification | `src/services/gamification.test.ts` | Streak dates, mastery formula, achievement awards |
| Insights | `src/services/insights.test.ts` | Course completion, unit breakdown, activity windows |
| Analytics | `src/services/analytics.test.ts` | Daily series continuity, weighted accuracy |
| Phase 7 engines | `src/games/phase7.test.ts` | Rapid Fire, Match, Riddles, Boss, Word Search |
| Sync queue | `src/services/sync-queue.test.ts` | Per-user isolation, retry exhaustion, storage cap |
| Adaptive | `src/services/adaptive/adaptive.test.ts` | Rule ladder priority, Q-learning update maths |

**Not covered automatically:** DOM event wiring, layout, and anything requiring a browser.
Those are the manual cases below.

---

## 2. Functional testing

### 2.1 Authentication *(needs `.env` and deployed rules)*

| # | Case | Expected |
| --- | --- | --- |
| A1 | Register with valid details | Auth user + `users/{uid}` doc with `level: 1`, `totalXP: 0`; lands on dashboard |
| A2 | Register with an existing email | "An account with this email already exists." — no raw Firebase code |
| A3 | Register with mismatched passwords | Inline field error, no network call |
| A4 | Login with correct credentials | Dashboard, navbar shows the name |
| A5 | Login with a wrong password | "Incorrect email or password." |
| A6 | Forgot password, registered address | "If that email has an account…" + email arrives |
| A7 | Forgot password, unknown address | **Identical** message (no account enumeration) |
| A8 | Reload while signed in | Still signed in |
| A9 | Uncheck "Keep me signed in", close tab, reopen | Signed out |
| A10 | Logout | Landing page; `#/dashboard` redirects to login |

### 2.2 Guest mode *(no `.env` needed)*

| # | Case | Expected |
| --- | --- | --- |
| G1 | "Try as guest" from the hero | Dashboard as Guest, Level 1, amber Guest chip |
| G2 | Reload | Still in guest mode |
| G3 | Exit guest, re-enter | Progress resumes — sign-out does not delete |
| G4 | Guest visits `#/register` | Reachable (guests must be able to upgrade) |
| G5 | Settings → Delete local guest data | Two presses required; then counters reset |

### 2.3 Games

| # | Case | Expected |
| --- | --- | --- |
| Q1 | Quiz Blitz: answer correctly | Green ✓, explanation, XP shown |
| Q2 | Quiz Blitz: let the timer expire | Counts wrong, reveals the correct answer |
| Q3 | Quiz Blitz: keys `1`–`4` then `Enter` | Answers and advances without the mouse |
| Q4 | Quiz Blitz: 10/10 | Perfect-round bonus row + **Perfectionist** |
| R1 | Rapid Fire: answer fast | Advances immediately, flash confirms |
| R2 | Rapid Fire: wait for 0s | Round ends itself, every answer reviewable |
| R3 | Rapid Fire: click after the buzzer | Ignored, score unchanged |
| M1 | Match: correct pair | Both cards lock green |
| M2 | Match: wrong pair | Shake, mistake counter rises, selection clears |
| M3 | Match: tap a selected card again | Deselects |
| D1 | Riddles: correct answer, no hint | Full 15 XP |
| D2 | Riddles: use both hints | "Worth" drops 15 → 10 → 5 |
| D3 | Riddles: `dns` / `DNS` / `Domain Name System` | All accepted |
| D4 | Riddles: Skip | Counts wrong, moves on |
| B1 | Boss: correct hard answer | Boss loses 20 HP |
| B2 | Boss: wrong answer | You lose 10 HP |
| B3 | Boss: drain boss HP | VICTORY + **Boss Slayer** + 100 XP bonus |
| B4 | Boss: lose all HP | DEFEAT, no victory bonus |
| B5 | Boss: Flee | Counts as a defeat |
| W1 | Word Search: drag across a word | Found, struck through in the list |
| W2 | Word Search: tap first then last letter | Same result (no drag needed) |
| W3 | Word Search: drag nonsense | Miss counter rises, round continues |
| W4 | Word Search: find every word | Full reward + completion |

### 2.4 Gamification

| # | Case | Expected |
| --- | --- | --- |
| X1 | Finish any round | Dashboard XP rises by the amount shown |
| X2 | First round of the day | `+20 XP` "First activity today"; streak advances |
| X3 | Second round the same day | No daily bonus; streak **unchanged** |
| X4 | Cross an XP threshold | LEVEL UP panel + toast; dashboard level rises |
| X5 | Replay after unlocking a badge | Not re-awarded |
| X6 | Play the same topic twice | Topic mastery rises on the topic page |
| X7 | Play all six modes | **All-Rounder** unlocks |

### 2.5 Content & analytics

| # | Case | Expected |
| --- | --- | --- |
| C1 | `#/learn` | 6 units, 17 topics, question counts |
| C2 | Open a topic | Notes, definitions, examples, related terms, real mastery |
| C3 | `#/dictionary` search "subnet" | Filters live; definition text also matches |
| C4 | Dictionary category + A–Z filters | Narrow correctly; a search clears the letter |
| C5 | `#/dictionary?term=dns` pasted fresh | Opens that entry |
| C6 | Re-open the same term | "read" count does not rise |
| C7 | `#/progress` | Figures agree with the dashboard |
| C8 | A day not played | Gap in the accuracy line, stub bar in XP |

### 2.6 Error handling

| # | Case | Expected |
| --- | --- | --- |
| E1 | `#/nope` | Friendly not-found state |
| E2 | `#/learn/not-a-topic` | "Topic not found" |
| E3 | Quiz on a topic with no questions | Clear empty state, not a crash |
| E4 | Offline mid-round | Score shown, "Saved for later" |
| E5 | No `.env`, attempt login | Config notice; guest mode still offered |

---

## 3. UI & responsive testing

Widths: **320, 360, 375, 414, 768, 1024, 1366, 1920**.

A static audit of every stylesheet confirms **no width-forcing declaration exceeds the 288px of
content available on a 320px screen** — no fixed `width`, `min-width`, `flex-basis` or grid track
can push the layout sideways. `body { overflow-x: hidden }` is therefore a safety net, not a
crutch. What still needs a real device is how it *looks* and *feels*:

- [ ] No horizontal page scroll at any width
- [ ] Nav collapses to a drawer below 992px and closes after a tap
- [ ] Word Search grid fits without overflowing the page
- [ ] Progress tables scroll **inside themselves**, not the page
- [ ] Quiz options remain tappable (≥44px targets) on a phone
- [ ] Dashboard mode tiles reflow 2 → 3 → 6 across breakpoints
- [ ] Long topic titles and long emails wrap or truncate rather than overflow
- [ ] Topic-detail and dictionary side panels do **not** stick over the content on a phone
- [ ] Dictionary A–Z buttons are comfortably tappable (44px on touch devices)
- [ ] Settings rows stack, with full-width buttons, below 560px
- [ ] Word Search: letters stay ≥26px; a large grid scrolls inside its own box
- [ ] Toasts clear the home-indicator area on a notched phone

## 4. Accessibility testing

- [ ] Whole quiz playable with keyboard only
- [ ] Visible focus ring on every interactive element
- [ ] Correct/incorrect conveyed by **icon and word**, not colour alone
- [ ] Form errors announced (`role="alert"`) and linked via `aria-describedby`
- [ ] Charts carry a text `aria-label` summary
- [ ] Settings → Reduce animation stops the hero trace and page reveals
- [ ] OS-level "reduce motion" does the same with no app setting changed
- [ ] Screen-reader pass over dashboard and one game (NVDA or VoiceOver)
- [ ] Text contrast ≥ 4.5:1 (ink `#12151a` on paper `#f5f4f1` ≈ 15:1)

## 5. Browser testing

| Browser | Pages | Games | PWA install |
| --- | --- | --- | --- |
| Chrome (desktop) | | | |
| Edge | | | |
| Firefox | | | n/a — no install prompt |
| Chrome (Android) | | | |
| Safari (iOS) | | | Share → Add to Home Screen |

## 6. PWA testing *(build + preview only)*

- [ ] Application → Service Workers shows `sw.js` **activated**
- [ ] Application → Manifest lists icons and reports installable
- [ ] Install from Settings; the app opens in its own window
- [ ] DevTools → Network → Offline, reload: app shell loads
- [ ] Offline: Learn, dictionary and all six games still work
- [ ] Offline: finish a round → "Saved for later"; Settings shows it pending
- [ ] Back online → round syncs, XP lands, pending count returns to zero
- [ ] Rebuild + reload → "Update available" toast

## 7. Security review

- [ ] Rules deployed: `npx firebase-tools deploy --only firestore:rules`
- [ ] Signed in as user A, attempt to read `users/{B}` → **denied**
- [ ] Attempt to write `questions/{id}` from the client → **denied**
- [ ] Attempt to set `totalXP` to 999999 in one write → **denied** (cap 1000/write)
- [ ] Attempt to lower `gamesPlayed` → **denied** (counters only grow)
- [ ] Attempt to edit a `gameAttempts` doc → **denied** (immutable)
- [ ] Attempt to create `userAchievements` for another uid → **denied**
- [ ] `.env` and `serviceAccountKey.json` are git-ignored and uncommitted
- [ ] No `console.log` of user data (`grep -rn "console.log" src/` → 0)

## 8. Performance

- [ ] Lighthouse on the built preview: Performance, Accessibility, Best Practices, SEO, PWA
- [ ] Landing JS ≤ 150 kB gzipped *(currently ~22 kB)*
- [ ] Firestore reads: one parallel batch per screen, not one query per widget

---

## 9. User Acceptance Testing form

Give this to 8–10 students after 15 minutes of unsupervised use.
Scale: **1 = strongly disagree, 5 = strongly agree.**

| # | Statement | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | The app was easy to start using without instructions | | | | | |
| 2 | I could find what I wanted without getting lost | | | | | |
| 3 | The interface looks clear and professional | | | | | |
| 4 | The games made revising Computer Networks more engaging | | | | | |
| 5 | XP, levels and streaks motivated me to keep going | | | | | |
| 6 | The explanations after each answer helped me understand | | | | | |
| 7 | The recommended challenge suggested something useful | | | | | |
| 8 | The progress screen showed me what I actually need to work on | | | | | |
| 9 | I would use this alongside my textbook before an exam | | | | | |
| 10 | I would recommend it to a classmate | | | | | |

**Open questions**

1. Which game mode was most useful for learning, and why?
2. Which part was confusing or annoying?
3. What is missing that you would want before an exam?
4. Did anything break or behave unexpectedly?

**Tester details:** year of study · CN topics already covered · device and browser used

**Reporting:** mean and range per statement, plus a themed summary of the open answers.
Any statement averaging below 3.5 is a finding that needs an action, not a footnote.
