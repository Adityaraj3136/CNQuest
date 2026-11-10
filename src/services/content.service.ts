/**
 * Content access layer.
 *
 * Reads educational content from Firestore when it is configured and populated, and otherwise
 * from the seed data bundled with the app. Every collection is fetched at most once per session
 * and cached, so screens can call these freely.
 *
 * The bundled fallback is not a stopgap — it is what makes Learn, the games and the dictionary
 * work offline and in guest mode.
 */

import { getFirestoreDb, isFirebaseConfigured } from '@/config/firebase';
import {
  ACHIEVEMENTS,
  BOSSES,
  DICTIONARY,
  MATCHING_SETS,
  QUESTIONS,
  RIDDLES,
  TOPICS,
  UNITS,
  WORD_SEARCH_SETS,
} from '@/data/index';
import {
  filterQuestions,
  filterRiddles,
  pickQuestions,
  randomizeQuestionOptions,
  topicsForUnit,
} from '@/services/content.filters';
import type { QuestionFilter } from '@/services/content.filters';
import type {
  Achievement,
  Boss,
  DictionaryTerm,
  MatchingSet,
  Question,
  Riddle,
  Topic,
  Unit,
  WordSearchSet,
} from '@/models/content';

export type ContentSource = 'bundled' | 'firestore';

const cache = new Map<string, readonly unknown[]>();
let lastSource: ContentSource = 'bundled';

/** Which source answered the most recent load. Surfaced in the UI for transparency. */
export function contentSource(): ContentSource {
  return lastSource;
}

/** Clears the in-memory cache, e.g. after seeding Firestore during development. */
export function clearContentCache(): void {
  cache.clear();
}

/**
 * Loads a collection once, preferring Firestore.
 * An empty or failed remote read falls back to the bundled copy rather than showing nothing.
 */
async function load<T>(collectionName: string, bundled: readonly T[]): Promise<readonly T[]> {
  const cached = cache.get(collectionName);
  if (cached) return cached as readonly T[];

  let result: readonly T[] = bundled;

  if (isFirebaseConfigured()) {
    try {
      const db = await getFirestoreDb();
      const { collection, getDocs } = await import('firebase/firestore');
      const snapshot = await getDocs(collection(db, collectionName));

      if (snapshot.empty) {
        console.info(`[content] "${collectionName}" is empty in Firestore — using bundled seed data.`);
      } else {
        result = snapshot.docs.map((docSnapshot) => docSnapshot.data() as T);
        lastSource = 'firestore';
      }
    } catch (error) {
      // Offline, rules not deployed, or the collection is missing — the app still works.
      console.warn(`[content] falling back to bundled "${collectionName}"`, error);
    }
  }

  cache.set(collectionName, result);
  return result;
}

// ---------------- Units & topics ----------------

export async function getUnits(): Promise<Unit[]> {
  const units = await load<Unit>('units', UNITS);
  return [...units].sort((a, b) => a.order - b.order);
}

export async function getTopics(unitId?: string): Promise<Topic[]> {
  const topics = await load<Topic>('topics', TOPICS);
  if (unitId) return topicsForUnit(topics, unitId);
  return [...topics].sort((a, b) => a.order - b.order);
}

export async function getTopic(topicId: string): Promise<Topic | null> {
  const topics = await load<Topic>('topics', TOPICS);
  return topics.find((topic) => topic.id === topicId) ?? null;
}

export async function getUnit(unitId: string): Promise<Unit | null> {
  const units = await load<Unit>('units', UNITS);
  return units.find((unit) => unit.id === unitId) ?? null;
}

/** Units with their topics attached — what the Learn screen renders. */
export async function getSyllabus(): Promise<Array<{ unit: Unit; topics: Topic[] }>> {
  const [units, topics] = await Promise.all([getUnits(), getTopics()]);
  return units.map((unit) => ({ unit, topics: topicsForUnit(topics, unit.id) }));
}

// ---------------- Questions ----------------

export async function getQuestions(filter: QuestionFilter = {}): Promise<Question[]> {
  const questions = await load<Question>('questions', QUESTIONS);
  return filterQuestions(questions, filter).map((q) => randomizeQuestionOptions(q));
}

/** Picks a randomised round of questions, widening the filter rather than returning too few. */
export async function getQuestionRound(count: number, filter: QuestionFilter = {}): Promise<Question[]> {
  const questions = await load<Question>('questions', QUESTIONS);
  return pickQuestions(questions, count, filter);
}

export async function countQuestions(filter: QuestionFilter = {}): Promise<number> {
  return (await getQuestions(filter)).length;
}

// ---------------- Other content ----------------

export async function getRiddles(
  filter: { topicId?: string; unitId?: string } = {},
): Promise<Riddle[]> {
  const riddles = await load<Riddle>('riddles', RIDDLES);
  return filterRiddles(riddles, filter);
}

export async function getDictionary(): Promise<DictionaryTerm[]> {
  const terms = await load<DictionaryTerm>('dictionary', DICTIONARY);
  return [...terms].sort((a, b) => a.term.localeCompare(b.term));
}

export async function getAchievements(): Promise<Achievement[]> {
  return [...(await load<Achievement>('achievements', ACHIEVEMENTS))];
}

export async function getMatchingSets(topicId?: string): Promise<MatchingSet[]> {
  const sets = await load<MatchingSet>('matchingSets', MATCHING_SETS);
  return topicId ? sets.filter((set) => set.topicId === topicId) : [...sets];
}

export async function getWordSearchSets(topicId?: string): Promise<WordSearchSet[]> {
  const sets = await load<WordSearchSet>('wordSearchSets', WORD_SEARCH_SETS);
  return topicId ? sets.filter((set) => set.topicId === topicId) : [...sets];
}

export async function getBosses(unitId?: string): Promise<Boss[]> {
  const bosses = await load<Boss>('bosses', BOSSES);
  return unitId ? bosses.filter((boss) => boss.unitId === unitId) : [...bosses];
}
