/**
 * Third bank of matching sets, word banks and bosses.
 *
 * The three bosses here cover units 2, 3 and 5, which previously had none: a student could
 * finish the physical layer or the transport layer and find nothing waiting at the end of it.
 * Every unit now has one.
 */

import type { Boss, MatchingSet, WordSearchSet } from '../models/content.ts';

export const MATCHING_SETS_EXTRA2: readonly MatchingSet[] = [
  {
    id: 'ms-media-limits',
    unitId: 'unit-2',
    topicId: 'transmission-media',
    title: 'Media and their limits',
    leftLabel: 'Medium or effect',
    rightLabel: 'Defining property',
    pairs: [
      { left: 'Single-mode fibre', right: 'One light path, longest reach' },
      { left: 'Multi-mode fibre', right: 'Many light paths, modal dispersion' },
      { left: 'Twisted pair', right: 'Twisting cancels induced interference' },
      { left: 'Attenuation', right: 'Signal weakens with distance' },
      { left: 'Distortion', right: 'Frequencies arrive at different times' },
    ],
    difficulty: 'medium',
  },
  {
    id: 'ms-multiplexing',
    unitId: 'unit-2',
    topicId: 'switching-multiplexing',
    title: 'Sharing one link',
    leftLabel: 'Technique',
    rightLabel: 'How it divides the link',
    pairs: [
      { left: 'FDM', right: 'By frequency band' },
      { left: 'TDM', right: 'By fixed time slot' },
      { left: 'WDM', right: 'By wavelength on fibre' },
      { left: 'Statistical TDM', right: 'By demand, idle sources waste nothing' },
      { left: 'Circuit switching', right: 'Reserves a whole path in advance' },
    ],
    difficulty: 'medium',
  },
  {
    id: 'ms-error-detection',
    unitId: 'unit-3',
    topicId: 'data-link-error-control',
    title: 'Catching corruption',
    leftLabel: 'Scheme',
    rightLabel: 'What it does',
    pairs: [
      { left: 'Parity bit', right: 'Misses every even number of errors' },
      { left: 'Checksum', right: 'Adds words and sends the complement' },
      { left: 'CRC', right: 'Polynomial division, remainder travels along' },
      { left: 'Hamming code', right: 'Locates and corrects a single bit' },
      { left: 'ARQ', right: 'Detects, then asks for it again' },
    ],
    difficulty: 'hard',
  },
  {
    id: 'ms-osi-units',
    unitId: 'unit-1',
    topicId: 'osi-model',
    title: 'Layers and their units',
    leftLabel: 'Layer',
    rightLabel: 'Protocol data unit',
    pairs: [
      { left: 'Physical', right: 'Bit' },
      { left: 'Data link', right: 'Frame' },
      { left: 'Network', right: 'Packet' },
      { left: 'Transport', right: 'Segment' },
      { left: 'Application', right: 'Message' },
    ],
    difficulty: 'easy',
  },
  {
    id: 'ms-tcp-events',
    unitId: 'unit-5',
    topicId: 'transport-tcp',
    title: 'TCP reacting to trouble',
    leftLabel: 'Event',
    rightLabel: 'What TCP does',
    pairs: [
      { left: 'Timeout', right: 'Threshold halves, window restarts at one' },
      { left: 'Three duplicate ACKs', right: 'Fast retransmit, window halves' },
      { left: 'Zero window advertised', right: 'Persist timer probes the receiver' },
      { left: 'Connection setup', right: 'SYN, SYN-ACK, ACK' },
      { left: 'Connection release', right: 'Four segments, each direction separately' },
    ],
    difficulty: 'hard',
  },
  {
    id: 'ms-address-types',
    unitId: 'unit-4',
    topicId: 'subnetting',
    title: 'Addresses inside a subnet',
    leftLabel: 'Address',
    rightLabel: 'Meaning',
    pairs: [
      { left: 'All host bits zero', right: 'Network address, names the subnet' },
      { left: 'All host bits one', right: 'Broadcast, reaches every host' },
      { left: '/26 mask octet', right: '192' },
      { left: '/27 usable hosts', right: '30' },
      { left: '169.254.x.x', right: 'Link-local, DHCP failed' },
    ],
    difficulty: 'hard',
  },
  {
    id: 'ms-app-ports',
    unitId: 'unit-6',
    topicId: 'http-web',
    title: 'Mail and transfer ports',
    leftLabel: 'Protocol',
    rightLabel: 'Port',
    pairs: [
      { left: 'FTP control', right: '21' },
      { left: 'Telnet', right: '23' },
      { left: 'SMTP', right: '25' },
      { left: 'IMAP', right: '143' },
      { left: 'SNMP', right: '161' },
    ],
    difficulty: 'medium',
  },
  {
    id: 'ms-crypto-tools',
    unitId: 'unit-6',
    topicId: 'network-security',
    title: 'Picking the right tool',
    leftLabel: 'Requirement',
    rightLabel: 'Tool',
    pairs: [
      { left: 'Encrypt bulk traffic quickly', right: 'AES, a symmetric cipher' },
      { left: 'Agree a key over an open link', right: 'RSA, a public key cipher' },
      { left: 'Prove nothing was altered', right: 'A hash such as SHA' },
      { left: 'Prove who sent it', right: 'A digital signature' },
      { left: 'Trust a stranger public key', right: 'A certificate authority' },
    ],
    difficulty: 'medium',
  },
];

export const WORD_SEARCH_SETS_EXTRA2: readonly WordSearchSet[] = [
  {
    id: 'ws-physical',
    unitId: 'unit-2',
    topicId: 'transmission-media',
    title: 'Physical layer',
    words: ['FIBRE', 'COAXIAL', 'NOISE', 'SHANNON', 'NYQUIST', 'MODAL', 'SHIELD', 'SIGNAL'],
    difficulty: 'medium',
  },
  {
    id: 'ws-switching',
    unitId: 'unit-2',
    topicId: 'switching-multiplexing',
    title: 'Switching and multiplexing',
    words: ['CIRCUIT', 'PACKET', 'DATAGRAM', 'VIRTUAL', 'SLOT', 'BURST', 'HOP'],
    difficulty: 'easy',
  },
  {
    id: 'ws-transport',
    unitId: 'unit-5',
    topicId: 'transport-tcp',
    title: 'Transport layer',
    words: ['SEGMENT', 'HANDSHAKE', 'WINDOW', 'SOCKET', 'TIMEOUT', 'PERSIST', 'CWND'],
    difficulty: 'hard',
  },
  {
    id: 'ws-routing',
    unitId: 'unit-4',
    topicId: 'routing-algorithms',
    title: 'Routing',
    words: ['DIJKSTRA', 'FLOOD', 'METRIC', 'POISON', 'HORIZON', 'VECTOR', 'PEER'],
    difficulty: 'hard',
  },
];

/**
 * Bosses for the three units that had none.
 *
 * HP is tuned so a round lasts roughly ten questions: the boss should be a test of the unit,
 * not an endurance exercise. Player HP is deliberately generous enough that one wrong answer
 * is a setback rather than the end.
 */
export const BOSSES_EXTRA: readonly Boss[] = [
  {
    id: 'boss-signal-warden',
    unitId: 'unit-2',
    name: 'Signal Warden',
    title: 'Keeper of the Medium',
    icon: 'bi-broadcast-pin',
    intro: 'Every cable has a limit. Prove you know where mine begins.',
    defeatLine: 'The signal degraded before it reached me. Study the impairments and return.',
    victoryLine: 'Clean transmission, end to end. The medium is yours.',
    hp: 100,
    playerHp: 3,
    difficulties: ['easy', 'medium'],
  },
  {
    id: 'boss-frame-marshal',
    unitId: 'unit-3',
    name: 'Frame Marshal',
    title: 'Arbiter of the Shared Wire',
    icon: 'bi-diagram-2',
    intro: 'Thirty machines, one cable, and only one of them may speak. Decide who.',
    defeatLine: 'Collisions everywhere. Learn the access rules and challenge me again.',
    victoryLine: 'Every frame delivered, every collision resolved. Well arbitrated.',
    hp: 120,
    playerHp: 3,
    difficulties: ['medium', 'hard'],
  },
  {
    id: 'boss-flow-sentinel',
    unitId: 'unit-5',
    name: 'Flow Sentinel',
    title: 'Warden of the Window',
    icon: 'bi-arrow-left-right',
    intro: 'The network never tells you how fast to go. Guess wrong and I will let you.',
    defeatLine: 'Your window collapsed. Revisit congestion control and try again.',
    victoryLine: 'Steady throughput, no collapse. You know when to back off.',
    hp: 130,
    playerHp: 3,
    difficulties: ['medium', 'hard'],
  },
];
