/**
 * Keeps UserState (skill estimates, Packet Dash best, Q-table) on this device and, for
 * signed-in students, in `userState/{uid}` so it follows them to every device.
 *
 * - Reads are synchronous from a localStorage cache, so games never wait on the network.
 * - Writes land in the cache at once and reach Firestore a moment later, sending only the
 *   fields that changed. What still needs sending is never tracked as flags: it is always the
 *   difference between local state and the last copy known to be in the cloud, so a write
 *   that fails (offline, tab closed) is simply retried by the next push.
 * - Signing in pulls the cloud copy and merges it (newer estimate wins, higher best wins).
 * - Guests have no account, so their state stays on this device.
 */

import { getFirestoreDb } from '@/config/firebase';
import { getSession, onSessionChange } from '@/state/session';
import type { SkillState } from '@/services/adaptive/skill.engine';
import type { QTable } from '@/services/adaptive/q-learning.engine';
import {
  EMPTY_USER_STATE,
  applyPush,
  changesSince,
  hasChanges,
  mergeUserStates,
  parseUserState,
  type UserState,
} from '@/services/user-state.logic';

const CACHE_KEY = 'cn-quest.user-state';
/** Keys used before this store existed; folded into the first owner's state, then removed. */
const LEGACY_Q_TABLE_KEY = 'cn-quest.q-table';
const LEGACY_DASH_BEST_KEY = 'cn-quest.packet-dash.best';
const COLLECTION = 'userState';
/** Answers arrive seconds apart; batch them into one write. */
const PUSH_DELAY_MS = 3000;
/** How long a game waits for the first pull before playing with the local copy. */
const PULL_WAIT_MS = 2500;

interface CacheEntry {
  state: UserState;
  /** Last copy known to be in Firestore. */
  cloud: UserState;
}
type Cache = Record<string, CacheEntry>;

function ownerId(): string {
  const { user, isGuest } = getSession();
  return user?.uid ?? (isGuest ? 'guest' : 'anonymous');
}

function readCache(): Cache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, { state?: unknown; cloud?: unknown }>).map(([owner, entry]) => [
        owner,
        { state: parseUserState(entry?.state), cloud: parseUserState(entry?.cloud) },
      ]),
    );
  } catch (error) {
    console.error('[user-state] local copy unreadable, starting fresh', error);
    return {};
  }
}

function writeEntry(owner: string, entry: CacheEntry): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [owner]: entry }));
  } catch (error) {
    console.error('[user-state] could not save locally', error);
  }
}

/** Pre-existing Q-table and best score, so upgrading does not wipe them. */
function takeLegacyState(): UserState {
  try {
    const qRaw = localStorage.getItem(LEGACY_Q_TABLE_KEY);
    const best = Number(localStorage.getItem(LEGACY_DASH_BEST_KEY)) || 0;
    localStorage.removeItem(LEGACY_Q_TABLE_KEY);
    localStorage.removeItem(LEGACY_DASH_BEST_KEY);
    const qTable = parseUserState({ qTable: qRaw ? JSON.parse(qRaw) : {} }).qTable;
    return { ...EMPTY_USER_STATE, dashBest: best, qTable, qTableAt: Object.keys(qTable).length ? Date.now() : 0 };
  } catch (error) {
    console.error('[user-state] could not read older local data', error);
    return EMPTY_USER_STATE;
  }
}

function entryFor(owner: string): CacheEntry {
  // Nobody signed in yet (session still loading): never claim the legacy data for "nobody".
  if (owner === 'anonymous') return { state: EMPTY_USER_STATE, cloud: EMPTY_USER_STATE };
  const existing = readCache()[owner];
  if (existing) return existing;
  const entry = { state: takeLegacyState(), cloud: EMPTY_USER_STATE };
  writeEntry(owner, entry);
  return entry;
}

export function getUserState(): UserState {
  return entryFor(ownerId()).state;
}

function update(change: (state: UserState) => UserState): void {
  const owner = ownerId();
  if (owner === 'anonymous') return; // nothing to attach it to
  const entry = entryFor(owner);
  writeEntry(owner, { ...entry, state: change(entry.state) });
  schedulePush();
}

export function saveSkill(scope: string, skill: SkillState): void {
  update((state) => ({ ...state, skill: { ...state.skill, [scope]: { ...skill, at: Date.now() } } }));
}

export function resetSkills(): void {
  update((state) => ({ ...state, skill: {}, skillResetAt: Date.now() }));
}

export function saveDashBest(points: number): void {
  update((state) => ({ ...state, dashBest: Math.max(state.dashBest, points) }));
}

export function saveQTable(table: QTable): void {
  update((state) => ({ ...state, qTable: table, qTableAt: Date.now() }));
}

// ------------------------------------------------------------------ cloud

let pushTimer: number | undefined;
let pushing: Promise<void> | null = null;
let pulling: Promise<void> | null = null;
let pulledFor: string | null = null;

function schedulePush(): void {
  if (!getSession().user) return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void pushNow(), PUSH_DELAY_MS);
}

async function pushOnce(uid: string): Promise<void> {
  const entry = entryFor(uid);
  const local = entry.state;
  const changes = changesSince(entry.cloud, local);
  if (!hasChanges(changes)) return;

  const db = await getFirestoreDb();
  const { FieldPath, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
  const ref = doc(db, COLLECTION, uid);

  // mergeFields says exactly what each write replaces: a whole map where the cloud copy must
  // match ours (a skill reset, the Q-table), a single entry where other devices may have
  // added their own (one skill scope).
  const data: Record<string, unknown> = { uid, updatedAt: serverTimestamp() };
  const paths: Array<string | InstanceType<typeof FieldPath>> = ['uid', 'updatedAt'];
  if (changes.skillReset) {
    Object.assign(data, { skill: local.skill, skillResetAt: local.skillResetAt });
    paths.push('skill', 'skillResetAt');
  } else if (changes.skillScopes.length) {
    data.skill = Object.fromEntries(changes.skillScopes.map((scope) => [scope, local.skill[scope]]));
    paths.push(...changes.skillScopes.map((scope) => new FieldPath('skill', scope)));
  }
  if (changes.qTable) {
    Object.assign(data, { qTable: local.qTable, qTableAt: local.qTableAt });
    paths.push('qTable', 'qTableAt');
  }
  if (paths.length > 2) await setDoc(ref, data, { mergeFields: paths });

  // Its own write: the rules refuse a best lower than the cloud's, and that refusal must not
  // take the skill estimates down with it.
  if (changes.dashBest) {
    try {
      await setDoc(ref, { uid, dashBest: local.dashBest, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.warn('[user-state] cloud best score is higher; pulling it', error);
      pulledFor = null;
      await pullUserState();
      return;
    }
  }

  // Record what reached the cloud, re-reading in case the student played on during the push.
  const latest = entryFor(uid);
  writeEntry(uid, { ...latest, cloud: applyPush(latest.cloud, local, changes) });
}

/** Sends local changes now. Safe to call often; concurrent calls share one push. */
export function pushNow(): Promise<void> {
  const uid = getSession().user?.uid;
  if (!uid) return Promise.resolve();
  window.clearTimeout(pushTimer);
  pushing ??= pushOnce(uid)
    .catch((error) => console.error('[user-state] sync failed; will retry when back online', error))
    .finally(() => {
      pushing = null;
    });
  return pushing;
}

/** Fetches the cloud copy and merges it in. Runs once per sign-in unless forced by a reset of `pulledFor`. */
export function pullUserState(): Promise<void> {
  const uid = getSession().user?.uid;
  if (!uid || pulledFor === uid) return pulling ?? Promise.resolve();
  pulledFor = uid;
  pulling = (async () => {
    try {
      const db = await getFirestoreDb();
      const { doc, getDoc } = await import('firebase/firestore');
      const snapshot = await getDoc(doc(db, COLLECTION, uid));
      const cloud = parseUserState(snapshot.exists() ? snapshot.data() : null);
      const entry = entryFor(uid);
      writeEntry(uid, { state: mergeUserStates(entry.state, cloud), cloud });
      void pushNow(); // anything this device had that the cloud lacked goes up now
    } catch (error) {
      pulledFor = null; // try again on the next sign-in, reconnect or game start
      console.error('[user-state] could not load synced data; using this device’s copy', error);
    }
  })();
  return pulling;
}

/** Resolves once the cloud copy is merged, or after a short wait so play never blocks on the network. */
export function userStateReady(): Promise<void> {
  return Promise.race([pullUserState(), new Promise<void>((resolve) => window.setTimeout(resolve, PULL_WAIT_MS))]);
}

/** Call once at startup: pulls on sign-in, retries on reconnect, flushes when the tab is hidden. */
export function startUserStateSync(): void {
  onSessionChange((session) => {
    if (session.user && pulledFor !== session.user.uid) void pullUserState();
  });
  window.addEventListener('online', () => {
    void pullUserState().then(pushNow);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void pushNow();
  });
}
