/**
 * Offline result queue.
 *
 * When the gamification pipeline cannot persist a finished round — no network, Firestore
 * unreachable — the result is queued locally instead of being lost. On reconnect the queue is
 * replayed through the *same* pipeline, so offline rounds award identical XP, mastery, streaks
 * and achievements to online ones.
 *
 * localStorage is deliberate: the queue holds a handful of small objects, and the spec only
 * calls for IndexedDB once the offline data outgrows it. Revisit if that changes.
 */

import type { GameResult } from '@/models/game';
import type { ResultExtras } from '@/services/game-result.service';

const QUEUE_KEY = 'cn-quest.pending-results';
/** Beyond this the oldest entries are dropped — a runaway queue must not fill storage. */
const MAX_QUEUED = 50;

export interface PendingResult {
  id: string;
  /** The account (or guest) the round belongs to; a queue entry never crosses users. */
  userId: string;
  result: GameResult;
  extras: ResultExtras;
  queuedAt: string;
  /** How many replay attempts have already failed. */
  attempts: number;
}

function read(): PendingResult[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingResult[]) : [];
  } catch (error) {
    console.error('[sync] queue is unreadable, clearing it', error);
    localStorage.removeItem(QUEUE_KEY);
    return [];
  }
}

function write(entries: readonly PendingResult[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entries.slice(-MAX_QUEUED)));
  } catch (error) {
    console.error('[sync] could not persist the queue', error);
  }
}

export function pendingResults(userId?: string): PendingResult[] {
  const entries = read();
  return userId ? entries.filter((entry) => entry.userId === userId) : entries;
}

export function pendingCount(userId?: string): number {
  return pendingResults(userId).length;
}

/** Adds a result that failed to save. Returns the queued entry. */
export function enqueueResult(
  userId: string,
  result: GameResult,
  extras: ResultExtras = {},
): PendingResult {
  const entry: PendingResult = {
    id: `${userId}__${Date.now()}__${Math.random().toString(36).slice(2, 8)}`,
    userId,
    result,
    extras,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };

  write([...read(), entry]);
  return entry;
}

export function removeQueued(id: string): void {
  write(read().filter((entry) => entry.id !== id));
}

/** Records a failed replay so a permanently broken entry can be given up on. */
export function markAttempted(id: string): void {
  write(read().map((entry) => (entry.id === id ? { ...entry, attempts: entry.attempts + 1 } : entry)));
}

export function clearQueue(userId?: string): void {
  write(userId ? read().filter((entry) => entry.userId !== userId) : []);
}

/** Entries that have failed too often to be worth retrying automatically. */
export const MAX_REPLAY_ATTEMPTS = 5;

export function isExhausted(entry: PendingResult): boolean {
  return entry.attempts >= MAX_REPLAY_ATTEMPTS;
}
