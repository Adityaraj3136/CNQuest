/**
 * Self-checks for Packet Dash. Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GATE_POINTS,
  LANES,
  MIN_GATES_FOR_BONUS,
  PacketDashEngine,
  SPEED_MAX,
  SPEED_START,
  START_LIVES,
  multiplierFor,
  type DashEvent,
} from './packet-dash.engine.ts';
import { TIER_2_AT, TIER_3_AT, familiesFor, questionFor, type Category } from './packet-dash.questions.ts';
import { mulberry32 } from '../word-search/word-search.generator.ts';
import { ipFromString, networkOf } from '../packet-runner/packet-runner.engine.ts';

const DT = 1 / 60;

/** Steps until the next unresolved gate row is behind the packet, steering with `chooseLane`. */
function runToNextGate(engine: PacketDashEngine, chooseLane: (answerLane: number) => number): DashEvent[] {
  const row = engine.snapshot().nextRow!;
  const target = chooseLane(row.question.answerLane);
  const events: DashEvent[] = [];
  let guard = 0;
  while (engine.snapshot().nextRow === row && engine.snapshot().status === 'running' && guard < 10_000) {
    const lane = engine.snapshot().lane;
    if (lane !== target) engine.steer(lane < target ? 1 : -1);
    events.push(...engine.step(DT));
    guard += 1;
  }
  return events;
}

const PRIVATE_RANGES = [
  { net: '10.0.0.0', len: 8 },
  { net: '172.16.0.0', len: 12 },
  { net: '192.168.0.0', len: 16 },
];
const isPrivate = (ip: string): boolean =>
  PRIVATE_RANGES.some(({ net, len }) => networkOf(ipFromString(ip), len) === ipFromString(net));

/** The checks every question must pass, plus the family-specific "only one is right" proofs. */
function assertSound(q: ReturnType<typeof questionFor>): void {
  assert.equal(q.options.length, LANES);
  assert.equal(new Set(q.options).size, LANES, `duplicate lane labels: ${q.options}`);
  assert.ok(q.answerLane >= 0 && q.answerLane < LANES);
  assert.ok(q.explanation.length > 0);
  const answer = q.options[q.answerLane];
  const decoys = q.options.filter((_, i) => i !== q.answerLane);

  if (q.category === 'subnet') {
    const [network, len] = answer.split('/');
    assert.equal(networkOf(ipFromString(q.prompt), Number(len)), ipFromString(network));
    for (const option of decoys) {
      const [net, l] = option.split('/');
      assert.notEqual(networkOf(ipFromString(q.prompt), Number(l)), ipFromString(net));
    }
  }
  if (q.category === 'private') {
    assert.ok(isPrivate(answer), `${answer} should be private`);
    decoys.forEach((d) => assert.ok(!isPrivate(d), `${d} should be public`));
  }
  if (q.category === 'hosts') {
    const prefix = Number(q.prompt.match(/\/(\d+)/)![1]);
    assert.equal(answer, `${2 ** (32 - prefix) - 2} hosts`);
  }
  if (q.category === 'device') {
    // A near-synonym of the answer would be a second right answer.
    const twins: Record<string, string> = { Switch: 'Bridge', Bridge: 'Switch', Hub: 'Repeater', Repeater: 'Hub' };
    if (twins[answer]) assert.ok(!decoys.includes(twins[answer]), `${answer} offered with ${twins[answer]}`);
  }
}

test('every family produces sound questions with exactly one right answer', () => {
  const rng = mulberry32(7);
  const seen = new Set<Category>();
  for (let i = 0; i < 3000; i += 1) {
    const q = questionFor(TIER_3_AT + 20, rng);
    seen.add(q.category);
    assertSound(q);
  }
  assert.deepEqual([...seen].sort(), [...familiesFor(TIER_3_AT)].sort());
});

test('families unlock by tier, the first gates already mix several, and no family repeats back to back', () => {
  assert.ok(familiesFor(0).length >= 4, 'the opening tier should not be ports alone');
  assert.ok(!familiesFor(TIER_2_AT - 1).includes('layer'));
  assert.ok(familiesFor(TIER_2_AT).includes('layer'));
  assert.ok(!familiesFor(TIER_3_AT - 1).includes('subnet'));
  assert.ok(familiesFor(TIER_3_AT).includes('subnet'));

  const rng = mulberry32(3);
  const opening = new Set<Category>();
  let last: Category | undefined;
  for (let gate = 0; gate < 40; gate += 1) {
    const q = questionFor(gate, rng, { lastCategory: last });
    assert.ok(familiesFor(gate).includes(q.category), `gate ${gate} asked locked ${q.category}`);
    assert.notEqual(q.category, last, 'same family twice in a row');
    if (gate < TIER_2_AT) opening.add(q.category);
    last = q.category;
  }
  assert.ok(opening.size >= 2, 'the first gates should not all be one family');
});

test('a run avoids repeating recent questions', () => {
  const engine = new PacketDashEngine({ seed: 21 });
  engine.start();
  for (let i = 0; i < 60 * 60; i += 1) engine.step(DT);
  const prompts = engine.snapshot().rows.map((r) => `${r.question.prompt}|${r.question.options[r.question.answerLane]}`);
  assert.equal(new Set(prompts).size, prompts.length, 'a question repeated within view');
});

test('ready mode scrolls the tunnel but spawns nothing', () => {
  const engine = new PacketDashEngine({ seed: 1 });
  engine.step(1);
  const snap = engine.snapshot();
  assert.equal(snap.status, 'ready');
  assert.ok(snap.distance > 0);
  assert.equal(snap.entities.length, 0);
});

test('every row leaves at least one lane free of firewalls', () => {
  const byZ = new Map<number, Set<number>>();
  for (let seed = 1; seed <= 40; seed += 1) {
    const engine = new PacketDashEngine({ seed });
    engine.start();
    for (const e of engine.snapshot().entities) {
      if (e.kind !== 'firewall') continue;
      const key = seed * 1e6 + e.z;
      byZ.set(key, (byZ.get(key) ?? new Set()).add(e.lane));
    }
  }
  assert.ok(byZ.size > 0);
  for (const lanes of byZ.values()) assert.ok(lanes.size < LANES);
});

test('correct gates build combo, multiply points, and speed rises to the cap', () => {
  // Steering only at gates can still clip a firewall, so look across seeds for a clean opening.
  let bestPoints = 0;
  let cleanRun: PacketDashEngine | null = null;
  for (let seed = 1; seed <= 60 && !cleanRun; seed += 1) {
    const engine = new PacketDashEngine({ seed });
    engine.start();
    assert.equal(engine.snapshot().speed, SPEED_START);
    let runBest = 0;
    for (let gate = 0; gate < 6 && engine.snapshot().status === 'running'; gate += 1) {
      for (const event of runToNextGate(engine, (answer) => answer)) {
        if (event.type !== 'gate') continue;
        assert.ok(event.isCorrect, 'flying the answer lane must score the gate');
        runBest = Math.max(runBest, event.points);
      }
    }
    if (engine.stats().gatesCorrect >= 6 && runBest >= GATE_POINTS * 2) {
      cleanRun = engine;
      bestPoints = runBest;
    }
  }
  assert.ok(cleanRun, 'no seed produced six clean gates');
  assert.ok(bestPoints >= GATE_POINTS * 2, 'combo multiplier never kicked in');
  assert.equal(multiplierFor(0), 1);
  assert.equal(multiplierFor(3), 2);
  assert.equal(multiplierFor(100), 5);

  for (let i = 0; i < 60 * 200; i += 1) cleanRun.step(DT);
  assert.ok(cleanRun.snapshot().speed <= SPEED_MAX);
});

test('wrong gates cost a life and are logged for review; three ends the run', () => {
  const engine = new PacketDashEngine({ seed: 5 });
  engine.start();
  let over = false;
  for (let gate = 0; gate < 20 && !over; gate += 1) {
    const events = runToNextGate(engine, (answer) => (answer + 1) % LANES);
    over = events.some((e) => e.type === 'over');
  }
  const snap = engine.snapshot();
  assert.equal(snap.status, 'over');
  assert.equal(snap.lives, 0);
  assert.ok(engine.missedGates().length >= 1);
  assert.ok(engine.missedGates().length <= START_LIVES + 1); // a shield can absorb one
  assert.equal(engine.step(DT).length, 0, 'a finished run stays finished');
  assert.equal(engine.summary().result.gameType, 'packet-dash');
});

test('a short run earns no round bonuses', () => {
  const engine = new PacketDashEngine({ seed: 11 });
  engine.start();
  runToNextGate(engine, (answer) => answer);
  assert.ok(engine.stats().gatesAttempted < MIN_GATES_FOR_BONUS);
  const xp = engine.xpBreakdown();
  assert.equal(xp.perfectBonus + xp.accuracyBonus + xp.streakBonus, 0);
  assert.equal(xp.total, xp.answerXp);
});

test('steering is clamped to the three lanes', () => {
  const engine = new PacketDashEngine({ seed: 1 });
  engine.steer(-1);
  engine.steer(-1);
  assert.equal(engine.snapshot().lane, 0);
  engine.steer(1);
  engine.steer(1);
  engine.steer(1);
  assert.equal(engine.snapshot().lane, LANES - 1);
});
