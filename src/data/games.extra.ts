/**
 * Second bank of matching sets and word banks.
 *
 * Matching pairs must be unambiguous: no left item may plausibly match two right items, or the
 * round has no correct answer. Word-search words are upper case and letters only, because the
 * grid generator cannot place a space or a hyphen.
 */

import type { MatchingSet, WordSearchSet } from '../models/content.ts';

export const MATCHING_SETS_EXTRA: readonly MatchingSet[] = [
  {
    id: 'ms-arq-protocols',
    unitId: 'unit-3',
    topicId: 'data-link-error-control',
    title: 'Link protocols and their behaviour',
    leftLabel: 'Protocol',
    rightLabel: 'Behaviour',
    pairs: [
      { left: 'Stop-and-Wait', right: 'One frame in flight at a time' },
      { left: 'Go-Back-N', right: 'Resends the lost frame and all after it' },
      { left: 'Selective Repeat', right: 'Resends only the frames actually lost' },
      { left: 'Piggybacking', right: 'Acknowledgement carried in a reverse data frame' },
      { left: 'Bit stuffing', right: 'Inserts a 0 after five consecutive 1s' },
    ],
    difficulty: 'medium',
  },
  {
    id: 'ms-access-methods',
    unitId: 'unit-3',
    topicId: 'mac-ethernet',
    title: 'Medium access methods',
    leftLabel: 'Method',
    rightLabel: 'Defining idea',
    pairs: [
      { left: 'Pure ALOHA', right: 'Transmit whenever ready, about 18% efficient' },
      { left: 'Slotted ALOHA', right: 'Transmit only at slot boundaries, about 37% efficient' },
      { left: 'CSMA/CD', right: 'Listen while sending and abort on collision' },
      { left: 'CSMA/CA', right: 'Avoid collisions because they cannot be heard' },
      { left: 'Token passing', right: 'Only the holder of a circulating permit may send' },
    ],
    difficulty: 'hard',
  },
  {
    id: 'ms-helper-protocols',
    unitId: 'unit-4',
    topicId: 'ipv4-addressing',
    title: 'Network layer helpers',
    leftLabel: 'Protocol',
    rightLabel: 'Job',
    pairs: [
      { left: 'ARP', right: 'Finds the MAC address behind a known IP' },
      { left: 'RARP', right: 'Finds a diskless host its own IP from its MAC' },
      { left: 'DHCP', right: 'Leases address, mask, gateway and resolver' },
      { left: 'ICMP', right: 'Reports errors and answers diagnostics' },
      { left: 'NAT', right: 'Shares one public address among many private ones' },
    ],
    difficulty: 'medium',
  },
  {
    id: 'ms-ports',
    unitId: 'unit-5',
    topicId: 'transport-udp',
    title: 'Well-known ports',
    leftLabel: 'Service',
    rightLabel: 'Port',
    pairs: [
      { left: 'SSH', right: '22' },
      { left: 'SMTP', right: '25' },
      { left: 'DNS', right: '53' },
      { left: 'HTTP', right: '80' },
      { left: 'POP3', right: '110' },
      { left: 'HTTPS', right: '443' },
    ],
    difficulty: 'easy',
  },
  {
    id: 'ms-security-goals',
    unitId: 'unit-6',
    topicId: 'network-security',
    title: 'Security goals and mechanisms',
    leftLabel: 'Goal or attack',
    rightLabel: 'Mechanism or effect',
    pairs: [
      { left: 'Confidentiality', right: 'Encrypt with the recipient public key' },
      { left: 'Non-repudiation', right: 'Digital signature using the sender private key' },
      { left: 'Integrity', right: 'Hash compared at both ends' },
      { left: 'Availability', right: 'The goal a DDoS attack destroys' },
      { left: 'Man-in-the-middle', right: 'Defeated by certificate authorities' },
    ],
    difficulty: 'hard',
  },
  {
    id: 'ms-routing-families',
    unitId: 'unit-4',
    topicId: 'routing-algorithms',
    title: 'Routing protocol families',
    leftLabel: 'Protocol',
    rightLabel: 'Family or trait',
    pairs: [
      { left: 'RIP', right: 'Distance vector, hop count capped at 15' },
      { left: 'OSPF', right: 'Link state, runs Dijkstra locally' },
      { left: 'BGP', right: 'Path vector, driven by policy' },
      { left: 'Split horizon', right: 'Never advertise a route back where it came from' },
      { left: 'Leaky bucket', right: 'Constant output rate, no bursts allowed' },
    ],
    difficulty: 'hard',
  },
];

export const WORD_SEARCH_SETS_EXTRA: readonly WordSearchSet[] = [
  {
    id: 'ws-link-layer',
    unitId: 'unit-3',
    topicId: 'data-link-error-control',
    title: 'Data link vocabulary',
    words: ['FRAMING', 'STUFFING', 'PARITY', 'CHECKSUM', 'WINDOW', 'PIGGYBACK', 'ARQ', 'HAMMING'],
    difficulty: 'medium',
  },
  {
    id: 'ws-access',
    unitId: 'unit-3',
    topicId: 'mac-ethernet',
    title: 'Access and switching',
    words: ['ALOHA', 'TOKEN', 'BRIDGE', 'SPANNING', 'COLLISION', 'BROADCAST', 'VLAN', 'ETHERNET'],
    difficulty: 'medium',
  },
  {
    id: 'ws-network-helpers',
    unitId: 'unit-4',
    topicId: 'ipv4-addressing',
    title: 'Network layer helpers',
    words: ['ARP', 'RARP', 'DHCP', 'ICMP', 'PING', 'TRACEROUTE', 'GATEWAY', 'FRAGMENT'],
    difficulty: 'easy',
  },
  {
    id: 'ws-application',
    unitId: 'unit-6',
    topicId: 'http-web',
    title: 'Application protocols',
    words: ['SMTP', 'IMAP', 'TELNET', 'COOKIE', 'STATUS', 'SNMP', 'MIME', 'PROXY'],
    difficulty: 'medium',
  },
  {
    id: 'ws-cryptography',
    unitId: 'unit-6',
    topicId: 'network-security',
    title: 'Security and cryptography',
    words: ['CIPHER', 'SIGNATURE', 'CERTIFICATE', 'HASHING', 'PHISHING', 'SPOOFING', 'INTEGRITY', 'TUNNEL'],
    difficulty: 'hard',
  },
];
