/**
 * Bundled seed content.
 *
 * This is the offline-first source of truth: CN Quest ships with the whole syllabus in the
 * bundle, so Learn, the games and the dictionary work with no network and no Firebase.
 * When Firestore is configured, ContentService prefers the remote copy so content can be
 * updated without redeploying the app.
 *
 * The same modules feed `scripts/seed.mjs`, which uploads them to Firestore.
 */

export { UNITS } from './units.ts';
export { TOPICS } from './topics.ts';
export { QUESTIONS } from './questions.ts';
export { RIDDLES } from './riddles.ts';
export { DICTIONARY } from './dictionary.ts';
export { ACHIEVEMENTS } from './achievements.ts';
export { MATCHING_SETS, WORD_SEARCH_SETS, BOSSES } from './games.ts';
