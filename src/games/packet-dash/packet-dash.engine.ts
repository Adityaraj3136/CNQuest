/**
 * Packet Dash — an endless three-lane runner. The packet flies forward on its own; the
 * student switches lanes to fly through the gate that answers the prompt (a port, an OSI
 * layer, a subnet), dodges firewalls and collects data bits. It speeds up until it crashes.
 *
 * Pure simulation: distance in metres, lanes 0-2, time in seconds. step(dt) advances the world
 * and returns what happened, so the page can play sounds and the scene can flash — neither
 * of them decides anything.
 */

import type { AnsweredQuestion, GameResult, GameSummary } from '../../models/game.ts';
import { BASE_XP, calculateRoundXp } from '../../config/xp.config.ts';
import { mulberry32 } from '../word-search/word-search.generator.ts';
import {
  TIER_2_AT,
  TIER_3_AT,
  pick,
  questionFor,
  questionKey,
  shuffle,
  type Category,
  type Rng,
  type GateQuestion,
} from './packet-dash.questions.ts';

export { TIER_2_AT, TIER_3_AT, questionFor, type Category, type GateQuestion };

export const LANES = 3;
export const START_LIVES = 3;
export const SPEED_START = 14;
export const SPEED_MAX = 34;
/** m/s gained per second of running: top speed after about 90 seconds. */
export const ACCELERATION = 0.22;
export const READY_SPEED = 8;
/** One gate row plus two obstacle rows per segment. */
export const SEGMENT_LENGTH = 100;
const FIRST_GATE_AT = 70;
const SPAWN_AHEAD = 190;
const DESPAWN_BEHIND = 12;
const OBSTACLE_OFFSETS = [35, 65];
const INVULNERABLE_SECONDS = 1;

export const BIT_POINTS = 10;
export const GATE_POINTS = 100;
export const COMBO_PER_MULTIPLIER = 3;
export const MAX_MULTIPLIER = 5;
/** Round bonuses (accuracy, perfect, streak) need a real run, not one gate and a crash. */
export const MIN_GATES_FOR_BONUS = 5;
/** How many recent questions are kept out of the next pick. */
const RECENT_QUESTIONS = 8;

// ---------------------------------------------------------------- world

export type EntityKind = 'gate' | 'firewall' | 'bit' | 'shield';

export interface DashEntity {
  id: number;
  kind: EntityKind;
  lane: number;
  /** Distance along the track, in metres. */
  z: number;
  /** Gates only. */
  rowId?: number;
  label?: string;
  /** Set once the packet has passed it. A gate's 'correct' marks the right gate, picked or not. */
  outcome?: 'correct' | 'wrong' | 'missed' | 'hit' | 'collected';
}

export interface GateRow {
  id: number;
  z: number;
  question: GateQuestion;
  result?: { chosenLane: number; isCorrect: boolean };
}

export type DashEvent =
  | { type: 'gate'; row: GateRow; isCorrect: boolean; points: number; multiplier: number }
  | { type: 'firewall' }
  | { type: 'shield-saved' }
  | { type: 'shield-pickup' }
  | { type: 'bit' }
  | { type: 'unlock'; tier: 2 | 3 }
  | { type: 'over' };

export type DashStatus = 'ready' | 'running' | 'over';

export interface DashSnapshot {
  status: DashStatus;
  distance: number;
  speed: number;
  lane: number;
  lives: number;
  hasShield: boolean;
  invulnerable: boolean;
  points: number;
  combo: number;
  multiplier: number;
  bits: number;
  entities: readonly DashEntity[];
  rows: readonly GateRow[];
  /** The next gate row the packet has not reached yet — what the HUD should ask. */
  nextRow: GateRow | null;
}

export interface MissedGate {
  prompt: string;
  answer: string;
  chosen: string;
  explanation: string;
}

const DIFFICULTY_BY_CATEGORY: Record<Category, 'easy' | 'medium' | 'hard'> = {
  port: 'easy',
  transport: 'easy',
  device: 'easy',
  pdu: 'easy',
  layer: 'medium',
  size: 'medium',
  private: 'medium',
  subnet: 'hard',
  hosts: 'hard',
};

export function multiplierFor(combo: number): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(combo / COMBO_PER_MULTIPLIER));
}

export class PacketDashEngine {
  private readonly rng: Rng;
  private readonly now: () => number;
  private startedAt = 0;
  private finishedAt: number | null = null;

  private status: DashStatus = 'ready';
  private distance = 0;
  private speed = SPEED_START;
  private lane = 1;
  private lives = START_LIVES;
  private hasShield = false;
  private invulnerableFor = 0;
  private points = 0;
  private combo = 0;
  private bestCombo = 0;
  private bits = 0;

  private entities: DashEntity[] = [];
  private rows: GateRow[] = [];
  private nextId = 1;
  private nextSegmentAt = FIRST_GATE_AT;
  private gatesSpawned = 0;
  private lastCategory: Category | undefined;
  private readonly recentKeys: string[] = [];
  private gatesAttempted = 0;
  private gatesCorrect = 0;
  private readonly answers: AnsweredQuestion[] = [];
  private readonly missed: MissedGate[] = [];

  constructor(options: { seed?: number; now?: () => number } = {}) {
    this.rng = mulberry32(options.seed ?? Date.now());
    this.now = options.now ?? (() => Date.now());
  }

  start(): void {
    if (this.status !== 'ready') return;
    this.status = 'running';
    this.startedAt = this.now();
    // The attract loop moved the world; the first gate is always the same distance away.
    this.nextSegmentAt = this.distance + FIRST_GATE_AT;
    this.spawnAhead();
  }

  steer(direction: -1 | 1): void {
    if (this.status === 'over') return;
    this.lane = Math.max(0, Math.min(LANES - 1, this.lane + direction));
  }

  snapshot(): DashSnapshot {
    return {
      status: this.status,
      distance: this.distance,
      speed: this.status === 'running' ? this.speed : READY_SPEED,
      lane: this.lane,
      lives: this.lives,
      hasShield: this.hasShield,
      invulnerable: this.invulnerableFor > 0,
      points: Math.floor(this.points),
      combo: this.combo,
      multiplier: multiplierFor(this.combo),
      bits: this.bits,
      entities: this.entities,
      rows: this.rows,
      nextRow: this.rows.find((row) => !row.result) ?? null,
    };
  }

  step(dt: number): DashEvent[] {
    if (this.status === 'over' || dt <= 0) return [];
    if (this.status === 'ready') {
      this.distance += READY_SPEED * dt; // attract mode: the tunnel moves, nothing spawns
      return [];
    }

    const events: DashEvent[] = [];
    const from = this.distance;
    this.distance += this.speed * dt;
    this.points += this.speed * dt; // one point per metre
    this.speed = Math.min(SPEED_MAX, this.speed + ACCELERATION * dt);
    this.invulnerableFor = Math.max(0, this.invulnerableFor - dt);

    for (const row of this.rows) {
      if (!row.result && row.z > from && row.z <= this.distance) this.resolveRow(row, events);
    }
    for (const entity of this.entities) {
      if (entity.kind !== 'gate' && !entity.outcome && entity.z > from && entity.z <= this.distance) {
        this.resolveEntity(entity, events);
      }
    }

    if (this.lives <= 0) {
      this.status = 'over';
      this.finishedAt = this.now();
      events.push({ type: 'over' });
      return events;
    }

    const behind = this.distance - DESPAWN_BEHIND;
    this.entities = this.entities.filter((e) => e.z >= behind);
    this.rows = this.rows.filter((r) => r.z >= behind);
    this.spawnAhead();
    return events;
  }

  /** `cause` is reported when a life is lost; null when the caller already reported it. */
  private damage(events: DashEvent[], cause: DashEvent | null): void {
    this.combo = 0;
    if (this.invulnerableFor > 0) return;
    if (this.hasShield) {
      this.hasShield = false;
      events.push({ type: 'shield-saved' });
    } else {
      this.lives -= 1;
      if (cause) events.push(cause);
    }
    this.invulnerableFor = INVULNERABLE_SECONDS;
  }

  private resolveRow(row: GateRow, events: DashEvent[]): void {
    const isCorrect = this.lane === row.question.answerLane;
    row.result = { chosenLane: this.lane, isCorrect };
    for (const gate of this.entities) {
      if (gate.rowId !== row.id) continue;
      // The right gate always lights up as right, so a miss still shows the answer.
      if (gate.lane === row.question.answerLane) gate.outcome = 'correct';
      else gate.outcome = gate.lane === this.lane ? 'wrong' : 'missed';
    }

    this.gatesAttempted += 1;
    if (this.gatesAttempted === TIER_2_AT) events.push({ type: 'unlock', tier: 2 });
    if (this.gatesAttempted === TIER_3_AT) events.push({ type: 'unlock', tier: 3 });
    const { question } = row;
    this.answers.push({
      questionId: `packet-dash:${question.category}:${question.prompt}`,
      question: question.prompt,
      options: question.options,
      correctAnswer: question.answerLane,
      selectedAnswer: this.lane,
      isCorrect,
      explanation: question.explanation,
      difficulty: DIFFICULTY_BY_CATEGORY[question.category],
      timeTakenMs: 0,
      xpEarned: isCorrect ? BASE_XP.dashGateCorrect : 0,
    });

    if (isCorrect) {
      this.gatesCorrect += 1;
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const multiplier = multiplierFor(this.combo);
      const points = GATE_POINTS * multiplier;
      this.points += points;
      events.push({ type: 'gate', row, isCorrect, points, multiplier });
      return;
    }

    this.missed.push({
      prompt: question.prompt,
      answer: question.options[question.answerLane],
      chosen: question.options[this.lane],
      explanation: question.explanation,
    });
    events.push({ type: 'gate', row, isCorrect, points: 0, multiplier: 1 });
    this.damage(events, null);
  }

  private resolveEntity(entity: DashEntity, events: DashEvent[]): void {
    if (entity.lane !== this.lane) return;
    if (entity.kind === 'bit') {
      entity.outcome = 'collected';
      this.bits += 1;
      this.points += BIT_POINTS;
      events.push({ type: 'bit' });
    } else if (entity.kind === 'shield') {
      entity.outcome = 'collected';
      this.hasShield = true;
      events.push({ type: 'shield-pickup' });
    } else {
      entity.outcome = 'hit';
      this.damage(events, { type: 'firewall' });
    }
  }

  private add(entity: Omit<DashEntity, 'id'>): void {
    this.entities.push({ ...entity, id: this.nextId++ });
  }

  private spawnAhead(): void {
    while (this.nextSegmentAt < this.distance + SPAWN_AHEAD) {
      this.spawnSegment(this.nextSegmentAt);
      this.nextSegmentAt += SEGMENT_LENGTH;
    }
  }

  private spawnSegment(z: number): void {
    const gateIndex = this.gatesSpawned;
    const question = questionFor(gateIndex, this.rng, {
      lastCategory: this.lastCategory,
      recent: new Set(this.recentKeys),
    });
    this.lastCategory = question.category;
    this.recentKeys.push(questionKey(question));
    if (this.recentKeys.length > RECENT_QUESTIONS) this.recentKeys.shift();
    const row: GateRow = { id: this.nextId++, z, question };
    this.rows.push(row);
    question.options.forEach((label, lane) => this.add({ kind: 'gate', lane, z, rowId: row.id, label }));
    this.gatesSpawned += 1;

    // Obstacles: one blocked lane early, sometimes two later — never all three.
    for (const offset of OBSTACLE_OFFSETS) {
      const blocked = gateIndex >= 8 && this.rng() < 0.4 ? 2 : 1;
      const lanes = shuffle([0, 1, 2], this.rng);
      lanes.slice(0, blocked).forEach((lane) => this.add({ kind: 'firewall', lane, z: z + offset }));

      const free = lanes.slice(blocked);
      if (this.rng() < 0.7) {
        const lane = pick(free, this.rng);
        for (let i = 0; i < 4; i += 1) this.add({ kind: 'bit', lane, z: z + offset - 12 + i * 4 });
      }
    }

    if (gateIndex > 2 && this.rng() < 0.15) {
      this.add({ kind: 'shield', lane: Math.floor(this.rng() * LANES), z: z + 50 });
    }
  }

  // ---------------------------------------------------------------- results

  missedGates(): readonly MissedGate[] {
    return this.missed;
  }

  stats(): { points: number; gatesAttempted: number; gatesCorrect: number; bestCombo: number; bits: number; distance: number } {
    return {
      points: Math.floor(this.points),
      gatesAttempted: this.gatesAttempted,
      gatesCorrect: this.gatesCorrect,
      bestCombo: this.bestCombo,
      bits: this.bits,
      distance: Math.floor(this.distance),
    };
  }

  xpBreakdown(): ReturnType<typeof calculateRoundXp> {
    const answerXp =
      this.gatesCorrect * BASE_XP.dashGateCorrect +
      Math.floor(this.points / 1000) * BASE_XP.dashPer1000Points;
    const full = calculateRoundXp({
      answerXp,
      attempted: this.gatesAttempted,
      correct: this.gatesCorrect,
      bestStreak: this.bestCombo,
    });
    if (this.gatesAttempted >= MIN_GATES_FOR_BONUS) return full;
    return { answerXp, accuracyBonus: 0, streakBonus: 0, perfectBonus: 0, total: answerXp };
  }

  summary(): GameSummary {
    const attempted = this.gatesAttempted;
    const correct = this.gatesCorrect;
    const endedAt = this.finishedAt ?? this.now();
    const result: GameResult = {
      gameType: 'packet-dash',
      topicId: 'mixed',
      attempted,
      correct,
      wrong: attempted - correct,
      score: correct,
      accuracy: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
      xpEarned: this.xpBreakdown().total,
      durationSeconds: Math.max(0, Math.round((endedAt - this.startedAt) / 1000)),
      difficulty: 'mixed',
      bestStreak: this.bestCombo,
    };
    return { result, answers: [...this.answers] };
  }
}
