/**
 * Packet Runner — forward one packet across a chain of routers by reading each routing table.
 *
 * At every router the student sees the packet's destination and the router's table, and picks
 * the outgoing interface. The engine judges the pick with a real longest-prefix match, so the
 * generator only has to build interesting tables: it never decides the answer itself.
 *
 * TTL is the life meter. A correct hop spends 1; a wrong one spends 2 (misrouted, then bounced
 * back to the same router). TTL reaching 0 drops the packet, exactly as a real router would.
 *
 * Pure: no DOM, no three.js. The page drives it; the 3D scene only draws what it says.
 */

import type { Difficulty } from '../../models/content.ts';
import type { AnsweredQuestion, GameResult, GameSummary } from '../../models/game.ts';
import { BASE_XP, calculateRoundXp, xpForCorrectAnswer } from '../../config/xp.config.ts';
import { mulberry32 } from '../word-search/word-search.generator.ts';

// ---------------------------------------------------------------- IPv4 helpers

export interface RouteEntry {
  /** Network address as an unsigned 32-bit integer. */
  network: number;
  prefixLen: number;
  iface: string;
}

export function maskFor(prefixLen: number): number {
  return prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
}

export function networkOf(ip: number, prefixLen: number): number {
  return (ip & maskFor(prefixLen)) >>> 0;
}

export function ipToString(ip: number): string {
  return [24, 16, 8, 0].map((shift) => (ip >>> shift) & 255).join('.');
}

export function ipFromString(text: string): number {
  return text.split('.').reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0);
}

export function cidrToString(entry: Pick<RouteEntry, 'network' | 'prefixLen'>): string {
  return `${ipToString(entry.network)}/${entry.prefixLen}`;
}

export function routeContains(entry: RouteEntry, ip: number): boolean {
  return networkOf(ip, entry.prefixLen) === entry.network;
}

/** Every route that covers `ip`, most specific first. */
export function matchingRoutes(table: readonly RouteEntry[], ip: number): RouteEntry[] {
  return table.filter((entry) => routeContains(entry, ip)).sort((a, b) => b.prefixLen - a.prefixLen);
}

export function longestPrefixMatch(table: readonly RouteEntry[], ip: number): RouteEntry | null {
  return matchingRoutes(table, ip)[0] ?? null;
}

// ---------------------------------------------------------------- level generation

export interface RouterHop {
  name: string;
  /** Display order — deliberately not interface order. */
  table: RouteEntry[];
  /** eth0, eth1, … in interface order. */
  interfaces: string[];
}

export interface PacketRun {
  destination: number;
  hops: RouterHop[];
  difficulty: Difficulty;
}

export const HOPS_PER_RUN: Record<Difficulty, number> = { easy: 5, medium: 6, hard: 7 };

/** Spare TTL beyond the hop count. At 2 TTL per mistake, 4 spare means two free mistakes. */
export const TTL_SLACK = 4;
export const WRONG_HOP_TTL_COST = 2;

type Rng = () => number;

function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type Prefix = Pick<RouteEntry, 'network' | 'prefixLen'>;

/**
 * A same-length network that does NOT contain `ip`: flip one bit inside the prefix. Flips stay
 * in the last octet of the prefix where possible, so decoys look like neighbours, not noise.
 */
function siblingOf(ip: number, prefixLen: number, rng: Rng): Prefix {
  const low = Math.max(0, prefixLen - 8);
  const bit = randInt(rng, low, prefixLen - 1);
  return { network: networkOf((ip ^ (1 << (31 - bit))) >>> 0, prefixLen), prefixLen };
}

/** Adds siblings until `count` distinct prefixes exist. */
function withSiblings(base: Prefix[], ip: number, prefixLen: number, count: number, rng: Rng): Prefix[] {
  const seen = new Set(base.map((p) => `${p.network}/${p.prefixLen}`));
  const out = [...base];
  while (out.length < count) {
    const candidate = siblingOf(ip, prefixLen, rng);
    const key = `${candidate.network}/${candidate.prefixLen}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(candidate);
    }
  }
  return out;
}

const DEFAULT_ROUTE: Prefix = { network: 0, prefixLen: 0 };

function prefixesFor(difficulty: Difficulty, dest: number, rng: Rng): Prefix[] {
  if (difficulty === 'easy') {
    // One match, two same-length decoys: read the table, find the network.
    return withSiblings([{ network: networkOf(dest, 16), prefixLen: 16 }], dest, 16, 3, rng);
  }

  if (difficulty === 'medium') {
    // Two routes match; the /24 must beat the /16.
    const base = [
      { network: networkOf(dest, 24), prefixLen: 24 },
      { network: networkOf(dest, 16), prefixLen: 16 },
    ];
    return withSiblings(base, dest, 24, 4, rng);
  }

  // Hard: non-octet prefixes, a default route, and sometimes the default is the answer.
  const long = randInt(rng, 22, 28);
  if (rng() < 0.25) {
    const decoys = withSiblings([], dest, long, 2, rng);
    return [...withSiblings(decoys, dest, long - randInt(rng, 2, 5), 3, rng), DEFAULT_ROUTE];
  }
  const short = long - randInt(rng, 2, 6);
  const base = [
    { network: networkOf(dest, long), prefixLen: long },
    { network: networkOf(dest, short), prefixLen: short },
  ];
  return [...withSiblings(base, dest, long, 3, rng), DEFAULT_ROUTE];
}

export function generateRun(difficulty: Difficulty, seed = Date.now()): PacketRun {
  const rng = mulberry32(seed);
  const destination = ipFromString(
    `10.${randInt(rng, 1, 254)}.${randInt(rng, 1, 254)}.${randInt(rng, 1, 254)}`,
  );

  const hops = Array.from({ length: HOPS_PER_RUN[difficulty] }, (_, i): RouterHop => {
    // Shuffle once to assign interfaces, again to display, so row order leaks nothing.
    const assigned = shuffle(prefixesFor(difficulty, destination, rng), rng).map(
      (prefix, index): RouteEntry => ({ ...prefix, iface: `eth${index}` }),
    );
    return {
      name: `R${i + 1}`,
      table: shuffle(assigned, rng),
      interfaces: assigned.map((entry) => entry.iface),
    };
  });

  return { destination, hops, difficulty };
}

// ---------------------------------------------------------------- engine

export type RunStatus = 'choosing' | 'feedback' | 'delivered' | 'expired';

export interface HopDecision {
  hopIndex: number;
  chosen: string;
  correctIface: string;
  isCorrect: boolean;
  matches: RouteEntry[];
  explanation: string;
  xpEarned: number;
}

export interface RunView {
  status: RunStatus;
  hopIndex: number;
  totalHops: number;
  hop: RouterHop;
  destination: number;
  ttl: number;
  maxTtl: number;
  lastDecision: HopDecision | null;
  currentStreak: number;
}

function explain(dest: number, matches: RouteEntry[], correct: string, chosen: string): string {
  const ip = ipToString(dest);
  let why: string;
  if (matches.length === 1 && matches[0].prefixLen === 0) {
    why = `No specific route covers ${ip}, so the default route 0.0.0.0/0 sends it out ${correct}.`;
  } else if (matches.length > 1) {
    const list = matches.map(cidrToString).join(' and ');
    why = `${ip} matches ${list}. The longest prefix (/${matches[0].prefixLen}) wins, so it leaves on ${correct}.`;
  } else {
    why = `${ip} falls inside ${cidrToString(matches[0])}, the only matching route, so it leaves on ${correct}.`;
  }
  return chosen === correct
    ? why
    : `${why} ${chosen} sent it the wrong way: TTL −${WRONG_HOP_TTL_COST} (misrouted and bounced back).`;
}

export class PacketRunnerEngine {
  private readonly run: PacketRun;
  private readonly now: () => number;
  private readonly startedAt: number;
  private readonly maxTtl: number;

  private hopIndex = 0;
  private ttl: number;
  private status: RunStatus = 'choosing';
  private readonly decisions: HopDecision[] = [];
  private currentStreak = 0;
  private bestStreak = 0;
  private finishedAt: number | null = null;

  constructor(run: PacketRun, options: { now?: () => number } = {}) {
    if (run.hops.length === 0) throw new Error('PacketRunnerEngine needs at least one hop.');
    this.run = run;
    this.now = options.now ?? (() => Date.now());
    this.startedAt = this.now();
    this.maxTtl = run.hops.length + TTL_SLACK;
    this.ttl = this.maxTtl;
  }

  view(): RunView {
    return {
      status: this.status,
      hopIndex: this.hopIndex,
      totalHops: this.run.hops.length,
      hop: this.run.hops[this.hopIndex],
      destination: this.run.destination,
      ttl: this.ttl,
      maxTtl: this.maxTtl,
      lastDecision: this.decisions.at(-1) ?? null,
      currentStreak: this.currentStreak,
    };
  }

  /** The interface a correct router would pick at the current hop. */
  correctIface(): string {
    const hop = this.run.hops[this.hopIndex];
    const match = longestPrefixMatch(hop.table, this.run.destination);
    // Every generated table has a match; a hand-made one without one is a content bug.
    if (!match) throw new Error(`${hop.name} has no route to ${ipToString(this.run.destination)}.`);
    return match.iface;
  }

  isOver(): boolean {
    return this.status === 'delivered' || this.status === 'expired';
  }

  choose(iface: string): HopDecision | null {
    if (this.status !== 'choosing') return null;
    const hop = this.run.hops[this.hopIndex];
    if (!hop.interfaces.includes(iface)) return null;

    const correctIface = this.correctIface();
    const isCorrect = iface === correctIface;
    const matches = matchingRoutes(hop.table, this.run.destination);

    this.ttl = Math.max(0, this.ttl - (isCorrect ? 1 : WRONG_HOP_TTL_COST));
    if (isCorrect) {
      this.currentStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    } else {
      this.currentStreak = 0;
    }

    const decision: HopDecision = {
      hopIndex: this.hopIndex,
      chosen: iface,
      correctIface,
      isCorrect,
      matches,
      explanation: explain(this.run.destination, matches, correctIface, iface),
      xpEarned: isCorrect ? xpForCorrectAnswer(BASE_XP.packetHopCorrect, this.run.difficulty) : 0,
    };
    this.decisions.push(decision);
    this.status = 'feedback';
    return decision;
  }

  /** Moves on after feedback: next router, same router again, or the end of the run. */
  next(): RunStatus {
    if (this.status !== 'feedback') return this.status;
    const last = this.decisions.at(-1)!;
    const isLastHop = this.hopIndex === this.run.hops.length - 1;

    if (last.isCorrect && isLastHop) return this.finish('delivered');
    if (this.ttl <= 0) return this.finish('expired');
    if (last.isCorrect) this.hopIndex += 1;
    this.status = 'choosing';
    return this.status;
  }

  /** Quitting drops the packet — no farming XP by bailing out of a bad run. */
  abort(): void {
    if (!this.isOver()) this.finish('expired');
  }

  private finish(status: 'delivered' | 'expired'): RunStatus {
    this.status = status;
    this.finishedAt = this.now();
    return status;
  }

  isDelivered(): boolean {
    return this.status === 'delivered';
  }

  xpBreakdown(): ReturnType<typeof calculateRoundXp> {
    const correct = this.decisions.filter((d) => d.isCorrect).length;
    const answerXp =
      this.decisions.reduce((sum, d) => sum + d.xpEarned, 0) +
      (this.isDelivered() ? BASE_XP.packetDelivered : 0);
    return calculateRoundXp({
      answerXp,
      attempted: this.decisions.length,
      correct,
      bestStreak: this.bestStreak,
    });
  }

  summary(): GameSummary {
    const attempted = this.decisions.length;
    const correct = this.decisions.filter((d) => d.isCorrect).length;
    const endedAt = this.finishedAt ?? this.now();
    const dest = ipToString(this.run.destination);

    const answers = this.decisions.map((d): AnsweredQuestion => {
      const hop = this.run.hops[d.hopIndex];
      return {
        questionId: `packet-runner:${hop.name}`,
        question: `${hop.name}: which interface forwards a packet for ${dest}?`,
        options: hop.interfaces,
        correctAnswer: hop.interfaces.indexOf(d.correctIface),
        selectedAnswer: hop.interfaces.indexOf(d.chosen),
        isCorrect: d.isCorrect,
        explanation: d.explanation,
        difficulty: this.run.difficulty,
        timeTakenMs: 0,
        xpEarned: d.xpEarned,
      };
    });

    const result: GameResult = {
      gameType: 'packet-runner',
      unitId: 'unit-4',
      topicId: 'routing-algorithms',
      attempted,
      correct,
      wrong: attempted - correct,
      score: correct,
      accuracy: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
      xpEarned: this.xpBreakdown().total,
      durationSeconds: Math.max(0, Math.round((endedAt - this.startedAt) / 1000)),
      difficulty: this.run.difficulty,
      bestStreak: this.bestStreak,
    };

    return { result, answers };
  }
}
