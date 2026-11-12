/**
 * Per-student state that is not progress: adaptive skill estimates, the Packet Dash best and
 * the experimental Q-learning table. Synced through `userState/{uid}` so it follows the
 * student across devices.
 *
 * This file is the pure half: the shape, validation of what comes back from Firestore, and
 * how two copies (this device, the cloud) are merged. Relative imports only, so the Node test
 * runner can load it.
 */

import type { SkillState } from './adaptive/skill.engine.ts';
import type { QTable } from './adaptive/q-learning.engine.ts';

/** A skill estimate plus when it last changed (epoch ms), so the newer copy wins a merge. */
export interface StampedSkill extends SkillState {
  at: number;
}

export interface UserState {
  /** Adaptive scope ("questions:dns", "packet-dash", …) → estimate. */
  skill: Record<string, StampedSkill>;
  /** Estimates older than this were reset from Settings on some device. */
  skillResetAt: number;
  dashBest: number;
  qTable: QTable;
  qTableAt: number;
}

export const EMPTY_USER_STATE: UserState = { skill: {}, skillResetAt: 0, dashBest: 0, qTable: {}, qTableAt: 0 };

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseSkill(raw: unknown): StampedSkill | null {
  if (!isRecord(raw) || !isNumber(raw.theta) || !isNumber(raw.answered) || !isNumber(raw.at)) return null;
  return { theta: raw.theta, answered: Math.max(0, raw.answered), at: raw.at };
}

function parseQTable(raw: unknown): QTable {
  if (!isRecord(raw)) return {};
  const table: QTable = {};
  for (const [state, row] of Object.entries(raw)) {
    if (!isRecord(row)) continue;
    table[state] = Object.fromEntries(Object.entries(row).filter(([, value]) => isNumber(value)));
  }
  return table;
}

/** Whatever Firestore or localStorage hands back, reduced to a valid UserState. */
export function parseUserState(raw: unknown): UserState {
  if (!isRecord(raw)) return EMPTY_USER_STATE;
  const skill: Record<string, StampedSkill> = {};
  if (isRecord(raw.skill)) {
    for (const [scope, value] of Object.entries(raw.skill)) {
      const parsed = parseSkill(value);
      if (parsed) skill[scope] = parsed;
    }
  }
  return {
    skill,
    skillResetAt: isNumber(raw.skillResetAt) ? raw.skillResetAt : 0,
    dashBest: isNumber(raw.dashBest) ? Math.max(0, raw.dashBest) : 0,
    qTable: parseQTable(raw.qTable),
    qTableAt: isNumber(raw.qTableAt) ? raw.qTableAt : 0,
  };
}

function newer(a: StampedSkill | undefined, b: StampedSkill | undefined): StampedSkill | undefined {
  if (!a || !b) return a ?? b;
  if (a.at !== b.at) return a.at > b.at ? a : b;
  return a.answered >= b.answered ? a : b;
}

/**
 * Combines two copies without losing either side's progress:
 * each skill scope keeps its newer estimate, a reset on either side clears anything older,
 * the best score keeps the higher value, and the Q-table keeps the newer table.
 */
export function mergeUserStates(a: UserState, b: UserState): UserState {
  const skillResetAt = Math.max(a.skillResetAt, b.skillResetAt);
  const skill: Record<string, StampedSkill> = {};
  for (const scope of new Set([...Object.keys(a.skill), ...Object.keys(b.skill)])) {
    const winner = newer(a.skill[scope], b.skill[scope]);
    if (winner && winner.at > skillResetAt) skill[scope] = winner;
  }
  const qFromA = a.qTableAt >= b.qTableAt;
  return {
    skill,
    skillResetAt,
    dashBest: Math.max(a.dashBest, b.dashBest),
    qTable: qFromA ? a.qTable : b.qTable,
    qTableAt: qFromA ? a.qTableAt : b.qTableAt,
  };
}

/** What this device holds that the cloud copy lacks: the fields a push has to send. */
export interface PendingChanges {
  skillScopes: string[];
  skillReset: boolean;
  dashBest: boolean;
  qTable: boolean;
}

export function changesSince(cloud: UserState, merged: UserState): PendingChanges {
  return {
    skillScopes: Object.keys(merged.skill).filter((scope) => (cloud.skill[scope]?.at ?? -1) < merged.skill[scope].at),
    skillReset: merged.skillResetAt > cloud.skillResetAt,
    dashBest: merged.dashBest > cloud.dashBest,
    qTable: merged.qTableAt > cloud.qTableAt,
  };
}

export function hasChanges(changes: PendingChanges): boolean {
  return changes.skillScopes.length > 0 || changes.skillReset || changes.dashBest || changes.qTable;
}

/** The cloud copy after a successful push of `changes` taken from `local`. */
export function applyPush(cloud: UserState, local: UserState, changes: PendingChanges): UserState {
  const pushedSkill = Object.fromEntries(changes.skillScopes.map((scope) => [scope, local.skill[scope]]));
  return {
    // A reset replaces the whole map; otherwise only the pushed scopes change.
    skill: changes.skillReset ? { ...local.skill } : { ...cloud.skill, ...pushedSkill },
    skillResetAt: changes.skillReset ? local.skillResetAt : cloud.skillResetAt,
    dashBest: changes.dashBest ? local.dashBest : cloud.dashBest,
    qTable: changes.qTable ? local.qTable : cloud.qTable,
    qTableAt: changes.qTable ? local.qTableAt : cloud.qTableAt,
  };
}
