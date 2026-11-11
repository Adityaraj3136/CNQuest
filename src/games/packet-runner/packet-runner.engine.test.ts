/**
 * Self-checks for Packet Runner. Run with: npm run test:units
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOPS_PER_RUN,
  PacketRunnerEngine,
  TTL_SLACK,
  generateRun,
  ipFromString,
  ipToString,
  longestPrefixMatch,
  matchingRoutes,
  type PacketRun,
  type RouteEntry,
} from './packet-runner.engine.ts';
import { BASE_XP } from '../../config/xp.config.ts';
import type { Difficulty } from '../../models/content.ts';

const route = (cidr: string, iface: string): RouteEntry => {
  const [ip, len] = cidr.split('/');
  return { network: ipFromString(ip), prefixLen: Number(len), iface };
};

/** Two-hop run with a known answer at each hop. */
function fixedRun(): PacketRun {
  const table = [route('10.0.0.0/8', 'eth0'), route('10.1.2.0/24', 'eth1'), route('0.0.0.0/0', 'eth2')];
  return {
    destination: ipFromString('10.1.2.5'),
    difficulty: 'medium',
    hops: [
      { name: 'R1', table, interfaces: ['eth0', 'eth1', 'eth2'] },
      { name: 'R2', table, interfaces: ['eth0', 'eth1', 'eth2'] },
    ],
  };
}

test('ip helpers round-trip and longest prefix wins', () => {
  assert.equal(ipToString(ipFromString('192.168.200.7')), '192.168.200.7');
  const table = fixedRun().hops[0].table;
  assert.equal(longestPrefixMatch(table, ipFromString('10.1.2.5'))?.iface, 'eth1');
  assert.equal(longestPrefixMatch(table, ipFromString('10.9.9.9'))?.iface, 'eth0');
  assert.equal(longestPrefixMatch(table, ipFromString('8.8.8.8'))?.iface, 'eth2');
  assert.equal(longestPrefixMatch([route('10.0.0.0/8', 'eth0')], ipFromString('11.0.0.1')), null);
});

test('generated runs always have exactly one best route, and it varies', () => {
  for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
    const answers = new Set<string>();
    for (let seed = 1; seed <= 200; seed += 1) {
      const run = generateRun(difficulty, seed);
      assert.equal(run.hops.length, HOPS_PER_RUN[difficulty]);
      for (const hop of run.hops) {
        const matches = matchingRoutes(hop.table, run.destination);
        assert.ok(matches.length > 0, `${difficulty} seed ${seed}: no route`);
        // A tie at the top would make two answers "correct".
        if (matches.length > 1) assert.ok(matches[0].prefixLen > matches[1].prefixLen);
        assert.equal(new Set(hop.interfaces).size, hop.interfaces.length);
        assert.equal(hop.table.length, hop.interfaces.length);
        answers.add(matches[0].iface);
      }
    }
    assert.ok(answers.size >= 3, `${difficulty}: answer is always the same interface`);
  }
});

test('medium and hard need the longest prefix, not just any match', () => {
  for (const difficulty of ['medium', 'hard'] as Difficulty[]) {
    let overlapping = 0;
    for (let seed = 1; seed <= 50; seed += 1) {
      const run = generateRun(difficulty, seed);
      overlapping += run.hops.filter((h) => matchingRoutes(h.table, run.destination).length > 1).length;
    }
    assert.ok(overlapping > 100, `${difficulty}: too few overlapping tables (${overlapping})`);
  }
});

test('correct hops deliver the packet and earn XP', () => {
  let clock = 0;
  const engine = new PacketRunnerEngine(fixedRun(), { now: () => clock });
  assert.equal(engine.view().ttl, 2 + TTL_SLACK);

  assert.equal(engine.choose('eth1')?.isCorrect, true);
  assert.equal(engine.next(), 'choosing');
  assert.equal(engine.view().hopIndex, 1);
  engine.choose('eth1');
  clock = 30_000;
  assert.equal(engine.next(), 'delivered');

  const { result } = engine.summary();
  assert.equal(result.gameType, 'packet-runner');
  assert.equal(result.accuracy, 100);
  assert.equal(result.durationSeconds, 30);
  assert.ok(result.xpEarned >= BASE_XP.packetDelivered + 2 * BASE_XP.packetHopCorrect);
});

test('a wrong hop costs 2 TTL, keeps the packet at the router, and explains why', () => {
  const engine = new PacketRunnerEngine(fixedRun());
  const decision = engine.choose('eth0');
  assert.equal(decision?.isCorrect, false);
  assert.equal(decision?.correctIface, 'eth1');
  assert.match(decision!.explanation, /longest prefix \(\/24\)/);
  engine.next();
  assert.equal(engine.view().hopIndex, 0);
  assert.equal(engine.view().ttl, 2 + TTL_SLACK - 2);
});

test('TTL running out drops the packet; ignored input does nothing', () => {
  const engine = new PacketRunnerEngine(fixedRun());
  assert.equal(engine.choose('eth9'), null);
  for (let i = 0; i < 3; i += 1) {
    engine.choose('eth2');
    if (engine.next() === 'expired') break;
  }
  assert.equal(engine.view().status, 'expired');
  assert.equal(engine.choose('eth1'), null);
  assert.equal(engine.summary().result.correct, 0);
  assert.equal(engine.xpBreakdown().total, 0);
});

test('quitting mid-run counts as a dropped packet', () => {
  const engine = new PacketRunnerEngine(fixedRun());
  engine.choose('eth1');
  engine.abort();
  assert.equal(engine.isDelivered(), false);
  assert.equal(engine.next(), 'expired');
});
