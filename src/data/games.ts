/**
 * Game-specific seed data: Match & Pair sets, Word Search word banks and Boss configurations.
 * Consumed by the corresponding games in Phase 7.
 */

import type { Boss, MatchingSet, WordSearchSet } from '../models/content.ts';
import { MATCHING_SETS_EXTRA, WORD_SEARCH_SETS_EXTRA } from './games.extra.ts';
import { BOSSES_EXTRA, MATCHING_SETS_EXTRA2, WORD_SEARCH_SETS_EXTRA2 } from './games.extra2.ts';
import { MATCHING_SETS_EXTRA3, WORD_SEARCH_SETS_EXTRA3 } from './games.extra3.ts';

const MATCHING_SETS_CORE: readonly MatchingSet[] = [
  {
    id: 'match-protocol-port',
    unitId: 'unit-5',
    topicId: 'transport-udp',
    title: 'Protocol → Port',
    leftLabel: 'Protocol',
    rightLabel: 'Port',
    difficulty: 'easy',
    pairs: [
      { left: 'HTTP', right: '80' },
      { left: 'HTTPS', right: '443' },
      { left: 'DNS', right: '53' },
      { left: 'SSH', right: '22' },
      { left: 'SMTP', right: '25' },
      { left: 'FTP (control)', right: '21' },
    ],
  },
  {
    id: 'match-device-layer',
    unitId: 'unit-1',
    topicId: 'osi-model',
    title: 'Device → OSI Layer',
    leftLabel: 'Device',
    rightLabel: 'Layer',
    difficulty: 'easy',
    pairs: [
      { left: 'Hub', right: 'Physical (1)' },
      { left: 'Switch', right: 'Data Link (2)' },
      { left: 'Router', right: 'Network (3)' },
      { left: 'Firewall (stateful)', right: 'Transport (4)' },
      { left: 'Proxy server', right: 'Application (7)' },
    ],
  },
  {
    id: 'match-layer-responsibility',
    unitId: 'unit-1',
    topicId: 'osi-model',
    title: 'OSI Layer → Responsibility',
    leftLabel: 'Layer',
    rightLabel: 'Responsibility',
    difficulty: 'medium',
    pairs: [
      { left: 'Physical', right: 'Transmits raw bits as signals' },
      { left: 'Data Link', right: 'Framing and MAC addressing' },
      { left: 'Network', right: 'Logical addressing and routing' },
      { left: 'Transport', right: 'End-to-end delivery and flow control' },
      { left: 'Session', right: 'Establishes and manages dialogues' },
      { left: 'Presentation', right: 'Translation, encryption, compression' },
    ],
  },
  {
    id: 'match-protocol-function',
    unitId: 'unit-6',
    topicId: 'dns',
    title: 'Protocol → Function',
    leftLabel: 'Protocol',
    rightLabel: 'Function',
    difficulty: 'medium',
    pairs: [
      { left: 'DNS', right: 'Resolves names to IP addresses' },
      { left: 'DHCP', right: 'Assigns IP configuration automatically' },
      { left: 'ARP', right: 'Maps an IP address to a MAC address' },
      { left: 'ICMP', right: 'Reports errors and runs ping' },
      { left: 'SMTP', right: 'Sends email between servers' },
      { left: 'IMAP', right: 'Retrieves email, keeping it on the server' },
    ],
  },
  {
    id: 'match-mask-prefix',
    unitId: 'unit-4',
    topicId: 'subnetting',
    title: 'Prefix → Subnet Mask',
    leftLabel: 'Prefix',
    rightLabel: 'Mask',
    difficulty: 'hard',
    pairs: [
      { left: '/24', right: '255.255.255.0' },
      { left: '/25', right: '255.255.255.128' },
      { left: '/26', right: '255.255.255.192' },
      { left: '/27', right: '255.255.255.224' },
      { left: '/28', right: '255.255.255.240' },
      { left: '/30', right: '255.255.255.252' },
    ],
  },
];

const WORD_SEARCH_SETS_CORE: readonly WordSearchSet[] = [
  {
    id: 'ws-devices',
    unitId: 'unit-1',
    topicId: 'osi-model',
    title: 'Devices & Layers',
    difficulty: 'easy',
    words: ['ROUTER', 'SWITCH', 'HUB', 'BRIDGE', 'PACKET', 'FRAME', 'LAYER'],
  },
  {
    id: 'ws-protocols',
    unitId: 'unit-6',
    topicId: 'http-web',
    title: 'Protocol Alphabet Soup',
    difficulty: 'medium',
    words: ['HTTP', 'HTTPS', 'DNS', 'DHCP', 'SMTP', 'IMAP', 'TCP', 'UDP', 'ARP'],
  },
  {
    id: 'ws-addressing',
    unitId: 'unit-4',
    topicId: 'subnetting',
    title: 'Addressing & Routing',
    difficulty: 'hard',
    words: ['SUBNET', 'GATEWAY', 'NETMASK', 'OCTET', 'PREFIX', 'ROUTING', 'BROADCAST', 'UNICAST'],
  },
  {
    id: 'ws-security',
    unitId: 'unit-6',
    topicId: 'network-security',
    title: 'Security Essentials',
    difficulty: 'medium',
    words: ['FIREWALL', 'ENCRYPT', 'INTEGRITY', 'PHISHING', 'MALWARE', 'TUNNEL', 'CIPHER'],
  },
];

const BOSSES_CORE: readonly Boss[] = [
  {
    id: 'boss-osi-guardian',
    unitId: 'unit-1',
    name: 'OSI Guardian',
    title: 'Keeper of the Seven Layers',
    icon: 'bi-layers',
    intro: 'Seven layers stand between you and understanding. Name them, or be turned away.',
    defeatLine: 'The layers part before you. Pass, student.',
    victoryLine: 'You confused Layer 3 with Layer 2 once too often.',
    hp: 100,
    playerHp: 100,
    difficulties: ['easy', 'medium'],
  },
  {
    id: 'boss-subnet-overlord',
    unitId: 'unit-4',
    name: 'Subnet Overlord',
    title: 'Divider of Address Space',
    icon: 'bi-diagram-2',
    intro: 'I have split this network into pieces. Count the hosts, or lose your way in them.',
    defeatLine: 'Impossible! You counted every borrowed bit.',
    victoryLine: 'You forgot the network and broadcast addresses. Again.',
    hp: 120,
    playerHp: 100,
    difficulties: ['medium', 'hard'],
  },
  {
    id: 'boss-firewall-guardian',
    unitId: 'unit-6',
    name: 'Firewall Guardian',
    title: 'Warden of the Perimeter',
    icon: 'bi-shield-shaded',
    intro: 'Nothing passes my rule set without justification. State your business.',
    defeatLine: 'Rule matched. Traffic permitted. You may proceed.',
    victoryLine: 'Denied. Read your security notes and return.',
    hp: 110,
    playerHp: 100,
    difficulties: ['medium', 'hard'],
  },
];

/** Both banks as one collection each. */
export const MATCHING_SETS: readonly MatchingSet[] = [...MATCHING_SETS_CORE, ...MATCHING_SETS_EXTRA, ...MATCHING_SETS_EXTRA2, ...MATCHING_SETS_EXTRA3];
export const WORD_SEARCH_SETS: readonly WordSearchSet[] = [...WORD_SEARCH_SETS_CORE, ...WORD_SEARCH_SETS_EXTRA, ...WORD_SEARCH_SETS_EXTRA2, ...WORD_SEARCH_SETS_EXTRA3];

/** Every unit now has a boss. */
export const BOSSES: readonly Boss[] = [...BOSSES_CORE, ...BOSSES_EXTRA];
