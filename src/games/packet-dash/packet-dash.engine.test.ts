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
  UNLOCK_LAYERS_AT,
  UNLOCK_SUBNETS_AT,
  multiplierFor,
  questionFor,
  type DashEvent,
} from './packet-dash.engine.ts';
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

test('questions always offer one right answer per lane set, and families unlock in order', () => {
  const rng = mulberry32(7);
  const seen = new Set<string>();
  for (let gate = 0; gate < 60; gate += 1) {
    const q = questionFor(gate, rng);
    seen.add(q.category);
    assert.equal(q.options.length, LANES);
    assert.equal(new Set(q.options).size, LANES, 'duplicate lane labels');
    assert.ok(q.answerLane >= 0 && q.answerLane < LANES);
    if (gate < UNLOCK_LAYERS_AT) assert.equal(q.category, 'port');
    if (gate < UNLOCK_SUBNETS_AT) assert.notEqual(q.category, 'subnet');
    if (q.category === 'subnet') {
      const [network, len] = q.options[q.answerLane].split('/');
      assert.equal(networkOf(ipFromString(q.prompt), Number(len)), ipFromString(network));
      // No decoy may also contain the host.
      q.options
        .filter((_, i) => i !== q.answerLane)
        .forEach((option) => {
          const [net, l] = option.split('/');
          assert.notEqual(networkOf(ipFromString(q.prompt), Number(l)), ipFromString(net));
        });
    }
  }
  assert.deepEqual([...seen].sort(), ['layer', 'port', 'subnet']);
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
  const engine = new PacketDashEngine({ seed: 11 });
  engine.start();
  assert.equal(engine.snapshot().speed, SPEED_START);

  let bestPoints = 0;
  // Fly straight through a firewall-free life by steering only at gates; shields may absorb hits.
  for (let gate = 0; gate < 6; gate += 1) {
    const events = runToNextGate(engine, (answer) => answer);
    const gateEvent = events.find((e) => e.type === 'gate');
    assert.ok(gateEvent && gateEvent.type === 'gate' && gateEvent.isCorrect);
    bestPoints = Math.max(bestPoints, gateEvent.points);
    if (engine.snapshot().status !== 'running') break;
  }
  assert.equal(engine.stats().gatesCorrect, engine.stats().gatesAttempted);
  assert.ok(bestPoints >= GATE_POINTS * 2, 'combo multiplier never kicked in');
  assert.equal(multiplierFor(0), 1);
  assert.equal(multiplierFor(3), 2);
  assert.equal(multiplierFor(100), 5);

  for (let i = 0; i < 60 * 200; i += 1) engine.step(DT);
  assert.ok(engine.snapshot().speed <= SPEED_MAX);
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
