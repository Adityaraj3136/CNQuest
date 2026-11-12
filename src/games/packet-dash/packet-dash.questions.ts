/**
 * Packet Dash's gate questions. Every question has exactly three short answers, one per lane,
 * and exactly one of them is right.
 *
 * Families unlock in tiers so a run gets harder as it goes, but even the first gates already
 * mix four families — a student who crashes early still meets more than port numbers.
 * Pure: no DOM, deterministic for a given rng.
 */

import { cidrToString, ipFromString, ipToString, networkOf } from '../packet-runner/packet-runner.engine.ts';

const LANES = 3;

export type Category =
  | 'port'
  | 'transport'
  | 'device'
  | 'pdu'
  | 'layer'
  | 'size'
  | 'private'
  | 'subnet'
  | 'hosts';

export interface GateQuestion {
  category: Category;
  /** The thing being asked about, e.g. "HTTPS". */
  prompt: string;
  /** One label per lane. */
  options: string[];
  answerLane: number;
  explanation: string;
}

/** Gate counts at which the next tier of families joins the mix. */
export const TIER_2_AT = 3;
export const TIER_3_AT = 8;
/** Subnet questions move from /26 to /27 blocks this deep into a run. */
const SMALLER_SUBNETS_AT = 16;

const TIERS: readonly (readonly Category[])[] = [
  ['port', 'transport', 'device', 'pdu'],
  ['layer', 'size', 'private'],
  ['subnet', 'hosts'],
];

export function familiesFor(gateIndex: number): Category[] {
  const unlocked = gateIndex >= TIER_3_AT ? 3 : gateIndex >= TIER_2_AT ? 2 : 1;
  return TIERS.slice(0, unlocked).flat();
}

// ---------------------------------------------------------------- banks

const PORTS: readonly [string, string][] = [
  ['HTTP', '80'], ['HTTPS', '443'], ['DNS', '53'], ['SSH', '22'], ['SMTP', '25'],
  ['FTP', '21'], ['Telnet', '23'], ['DHCP server', '67'], ['POP3', '110'], ['IMAP', '143'],
  ['SNMP', '161'], ['NTP', '123'], ['RDP', '3389'], ['BGP', '179'], ['LDAP', '389'],
];

const TRANSPORTS: readonly [string, string][] = [
  ['HTTP', 'TCP'], ['HTTPS', 'TCP'], ['SSH', 'TCP'], ['FTP', 'TCP'], ['SMTP', 'TCP'],
  ['Telnet', 'TCP'], ['BGP', 'TCP'], ['DHCP', 'UDP'], ['TFTP', 'UDP'], ['SNMP', 'UDP'],
  ['NTP', 'UDP'], ['Syslog', 'UDP'], ['RIP', 'UDP'], ['VoIP media (RTP)', 'UDP'],
  ['Ping', 'ICMP'], ['Time Exceeded error', 'ICMP'],
];

const DEVICES: readonly [string, string][] = [
  ['Forwards frames by MAC address', 'Switch'],
  ['Forwards packets by IP address', 'Router'],
  ['Repeats bits out of every port', 'Hub'],
  ['Connects Wi-Fi clients to a LAN', 'Access point'],
  ['Turns digital data into line signals', 'Modem'],
  ['Joins two LAN segments by MAC', 'Bridge'],
  ['Boosts a weak signal on one link', 'Repeater'],
];

/** Pairs that are too close to serve as each other's decoy. */
const DEVICE_CONFLICTS: Record<string, readonly string[]> = {
  Switch: ['Bridge'],
  Bridge: ['Switch'],
  Hub: ['Repeater'],
  Repeater: ['Hub'],
};

const PDUS: readonly [string, string][] = [
  ['Transport layer (TCP)', 'Segment'],
  ['Network layer', 'Packet'],
  ['Data Link layer', 'Frame'],
  ['Physical layer', 'Bits'],
  ['Application layer', 'Data'],
];

const LAYER_NAMES = ['Physical', 'Data Link', 'Network', 'Transport', 'Session', 'Presentation', 'Application'];

const LAYERS: readonly [string, number][] = [
  ['Router', 3], ['Switch', 2], ['Hub', 1], ['Repeater', 1], ['HTTP', 7], ['DNS', 7],
  ['TCP', 4], ['UDP', 4], ['IP', 3], ['ICMP', 3], ['MAC address', 2], ['Ethernet frame', 2],
  ['Segment', 4], ['Packet', 3], ['Bits on the wire', 1], ['TLS encryption', 6], ['SSH session', 7],
];

/** Each size question carries its own decoys: the units differ per question. */
const SIZES: readonly [string, string, readonly string[]][] = [
  ['IPv4 address', '32 bits', ['48 bits', '128 bits', '64 bits']],
  ['IPv6 address', '128 bits', ['32 bits', '64 bits', '48 bits']],
  ['MAC address', '48 bits', ['32 bits', '64 bits', '128 bits']],
  ['Port number field', '16 bits', ['8 bits', '32 bits', '24 bits']],
  ['One octet', '8 bits', ['4 bits', '16 bits', '32 bits']],
  ['Ethernet MTU', '1500 bytes', ['1024 bytes', '2048 bytes', '512 bytes']],
  ['IPv4 header (minimum)', '20 bytes', ['8 bytes', '12 bytes', '32 bytes']],
  ['IPv6 header', '40 bytes', ['20 bytes', '64 bytes', '32 bytes']],
  ['UDP header', '8 bytes', ['20 bytes', '16 bytes', '4 bytes']],
  ['TCP header (no options)', '20 bytes', ['8 bytes', '12 bytes', '64 bytes']],
];

export type Rng = () => number;

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function between(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Answer plus two distinct decoys, shuffled across the lanes. */
function laneOptions(
  answer: string,
  decoyPool: readonly string[],
  rng: Rng,
  exclude: readonly string[] = [],
): { options: string[]; answerLane: number } {
  const pool = [...new Set(decoyPool)].filter((d) => d !== answer && !exclude.includes(d));
  const options = shuffle([answer, ...shuffle(pool, rng).slice(0, LANES - 1)], rng);
  return { options, answerLane: options.indexOf(answer) };
}

// ---------------------------------------------------------------- families

function fromPairs(
  category: Category,
  bank: readonly [string, string][],
  explain: (prompt: string, answer: string) => string,
  rng: Rng,
  conflicts: Record<string, readonly string[]> = {},
): GateQuestion {
  const [prompt, answer] = pick(bank, rng);
  return {
    category,
    prompt,
    ...laneOptions(answer, bank.map(([, a]) => a), rng, conflicts[answer]),
    explanation: explain(prompt, answer),
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

function sizeQuestion(rng: Rng): GateQuestion {
  const [thing, answer, decoys] = pick(SIZES, rng);
  return {
    category: 'size',
    prompt: thing,
    ...laneOptions(answer, decoys, rng),
    explanation: `${thing}: ${answer}.`,
  };
}

function privateAddress(rng: Rng): string {
  const range = between(rng, 0, 2);
  if (range === 0) return `10.${between(rng, 0, 255)}.${between(rng, 0, 255)}.${between(rng, 1, 254)}`;
  if (range === 1) return `172.${between(rng, 16, 31)}.${between(rng, 0, 255)}.${between(rng, 1, 254)}`;
  return `192.168.${between(rng, 0, 255)}.${between(rng, 1, 254)}`;
}

/** Public look-alikes, several deliberately just outside the RFC 1918 ranges. */
function publicAddress(rng: Rng): string {
  const host = `${between(rng, 0, 255)}.${between(rng, 1, 254)}`;
  return pick(
    [
      `172.${between(rng, 32, 47)}.${host}`,
      `172.${between(rng, 1, 15)}.${host}`,
      `192.169.${host}`,
      `11.${between(rng, 0, 255)}.${host}`,
      `8.8.${host}`,
      `52.${between(rng, 0, 255)}.${host}`,
    ],
    rng,
  );
}

function privateQuestion(rng: Rng): GateQuestion {
  const answer = privateAddress(rng);
  const decoys = new Set<string>();
  while (decoys.size < LANES - 1) decoys.add(publicAddress(rng));
  return {
    category: 'private',
    prompt: 'Which is private?',
    ...laneOptions(answer, [...decoys], rng),
    explanation: `${answer} is private: RFC 1918 reserves 10/8, 172.16/12 and 192.168/16.`,
  };
}

function subnetQuestion(rng: Rng, prefixLen: number): GateQuestion {
  const base = ipFromString(`192.168.${between(rng, 1, 254)}.0`);
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

function hostsQuestion(rng: Rng): GateQuestion {
  const hostsFor = (prefix: number): number => 2 ** (32 - prefix) - 2;
  const prefix = between(rng, 23, 30);
  const label = (prefixLen: number): string => `${hostsFor(prefixLen)} hosts`;
  return {
    category: 'hosts',
    prompt: `A /${prefix} subnet`,
    ...laneOptions(label(prefix), [23, 24, 25, 26, 27, 28, 29, 30].map(label), rng),
    explanation: `/${prefix} leaves ${32 - prefix} host bits: 2^${32 - prefix} − 2 = ${hostsFor(prefix)} usable hosts.`,
  };
}

function build(category: Category, gateIndex: number, rng: Rng): GateQuestion {
  switch (category) {
    case 'port':
      return fromPairs('port', PORTS, (p, a) => `${p} uses port ${a}.`, rng);
    case 'transport':
      return fromPairs('transport', TRANSPORTS, (p, a) => `${p} runs over ${a}.`, rng);
    case 'device':
      return fromPairs('device', DEVICES, (p, a) => `${a}: ${p.charAt(0).toLowerCase()}${p.slice(1)}.`, rng, DEVICE_CONFLICTS);
    case 'pdu':
      return fromPairs('pdu', PDUS, (p, a) => `${p} data unit: ${a}.`, rng);
    case 'layer':
      return layerQuestion(rng);
    case 'size':
      return sizeQuestion(rng);
    case 'private':
      return privateQuestion(rng);
    case 'subnet':
      return subnetQuestion(rng, gateIndex >= SMALLER_SUBNETS_AT ? 27 : 26);
    case 'hosts':
      return hostsQuestion(rng);
  }
}

export interface QuestionHistory {
  lastCategory?: Category;
  /** prompt|answer keys asked recently, to avoid repeats. */
  recent?: ReadonlySet<string>;
}

export function questionKey(question: GateQuestion): string {
  return `${question.prompt}|${question.options[question.answerLane]}`;
}

const MAX_REROLLS = 6;

/** A question from the unlocked families: never the same family twice running, rarely a repeat. */
export function questionFor(gateIndex: number, rng: Rng, history: QuestionHistory = {}): GateQuestion {
  const unlocked = familiesFor(gateIndex);
  const families = unlocked.filter((f) => f !== history.lastCategory);
  const category = pick(families.length ? families : unlocked, rng);
  let question = build(category, gateIndex, rng);
  for (let i = 0; i < MAX_REROLLS && history.recent?.has(questionKey(question)); i += 1) {
    question = build(category, gateIndex, rng);
  }
  return question;
}
