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
import { cidrToString, ipFromString, ipToString, networkOf } from '../packet-runner/packet-runner.engine.ts';

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
const COMBO_PER_MULTIPLIER = 3;
const MAX_MULTIPLIER = 5;
/** Round bonuses (accuracy, perfect, streak) need a real run, not one gate and a crash. */
export const MIN_GATES_FOR_BONUS = 5;

/** Gate counts at which a new question family joins the mix. */
export const UNLOCK_LAYERS_AT = 4;
export const UNLOCK_SUBNETS_AT = 10;

// ---------------------------------------------------------------- questions

export type Category = 'port' | 'layer' | 'subnet';

export interface GateQuestion {
  category: Category;
  /** The thing being asked about, e.g. "HTTPS". */
  prompt: string;
  /** One label per lane. */
  options: string[];
  answerLane: number;
  explanation: string;
}

const PORTS: readonly [string, string][] = [
  ['HTTP', '80'], ['HTTPS', '443'], ['DNS', '53'], ['SSH', '22'], ['SMTP', '25'],
  ['FTP', '21'], ['Telnet', '23'], ['DHCP server', '67'], ['POP3', '110'], ['IMAP', '143'],
  ['SNMP', '161'], ['NTP', '123'], ['RDP', '3389'], ['BGP', '179'], ['LDAP', '389'],
];

const LAYER_NAMES = ['Physical', 'Data Link', 'Network', 'Transport', 'Session', 'Presentation', 'Application'];

const LAYERS: readonly [string, number][] = [
  ['Router', 3], ['Switch', 2], ['Hub', 1], ['Repeater', 1], ['HTTP', 7], ['DNS', 7],
  ['TCP', 4], ['UDP', 4], ['IP', 3], ['ICMP', 3], ['MAC address', 2], ['Ethernet frame', 2],
  ['Segment', 4], ['Packet', 3], ['Bits on the wire', 1],
];

type Rng = () => number;

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Answer plus two distinct decoys from the same family, shuffled across the lanes. */
function laneOptions(answer: string, decoyPool: readonly string[], rng: Rng): { options: string[]; answerLane: number } {
  const decoys = shuffle(decoyPool.filter((d) => d !== answer), rng).slice(0, LANES - 1);
  const options = shuffle([answer, ...decoys], rng);
  return { options, answerLane: options.indexOf(answer) };
}

function portQuestion(rng: Rng): GateQuestion {
  const [protocol, port] = pick(PORTS, rng);
  return {
    category: 'port',
    prompt: protocol,
    ...laneOptions(port, PORTS.map(([, p]) => p), rng),
    explanation: `${protocol} uses port ${port}.`,
  };
}

function layerQuestion(rng: Rng): GateQuestion {
  const [thing, layer] = pick(LAYERS, rng);
  return {
    category: 'layer',
    prompt: thing,
    ...laneOptions(`L${layer}`, LAYER_NAMES.map((_, i) => `L${i + 1}`), rng),
    explanation: `${thing} belongs to Layer ${layer} (${LAYER_NAMES[layer - 1]}).`,
  };
}

function subnetQuestion(rng: Rng, prefixLen: number): GateQuestion {
  const third = 1 + Math.floor(rng() * 254);
  const base = ipFromString(`192.168.${third}.0`);
  const blockSize = 2 ** (32 - prefixLen);
  const blocks = Array.from({ length: 256 / blockSize }, (_, i) => (base + i * blockSize) >>> 0);
  const answerBlock = pick(blocks, rng);
  // A usable host: never the network or broadcast address of its block.
  const host = (answerBlock + 1 + Math.floor(rng() * (blockSize - 2))) >>> 0;
  const label = (network: number): string => cidrToString({ network, prefixLen });
  const answer = label(networkOf(host, prefixLen));
  return {
    category: 'subnet',
    prompt: ipToString(host),
    ...laneOptions(answer, blocks.map(label), rng),
    explanation: `${ipToString(host)} sits inside ${answer}.`,
  };
}

/** Ports from the start, OSI layers after a few gates, subnets once the student is flying. */
export function questionFor(gateIndex: number, rng: Rng): GateQuestion {
  const families: Category[] = ['port'];
  if (gateIndex >= UNLOCK_LAYERS_AT) families.push('layer');
  if (gateIndex >= UNLOCK_SUBNETS_AT) families.push('subnet');
  const family = pick(families, rng);
  if (family === 'layer') return layerQuestion(rng);
  if (family === 'subnet') return subnetQuestion(rng, gateIndex >= UNLOCK_SUBNETS_AT * 2 ? 27 : 26);
  return portQuestion(rng);
}

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
  | { type: 'unlock'; category: Category }
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
    if (this.gatesAttempted === UNLOCK_LAYERS_AT) events.push({ type: 'unlock', category: 'layer' });
    if (this.gatesAttempted === UNLOCK_SUBNETS_AT) events.push({ type: 'unlock', category: 'subnet' });
    const { question } = row;
    this.answers.push({
      questionId: `packet-dash:${question.category}:${question.prompt}`,
      question: question.prompt,
      options: question.options,
      correctAnswer: question.answerLane,
      selectedAnswer: this.lane,
      isCorrect,
      explanation: question.explanation,
      difficulty: question.category === 'subnet' ? 'hard' : question.category === 'layer' ? 'medium' : 'easy',
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
    const question = questionFor(gateIndex, this.rng);
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
