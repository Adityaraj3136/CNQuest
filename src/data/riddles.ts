/**
 * Network Riddles.
 *
 * SEED DATA. Answers are matched case-insensitively after whitespace and punctuation are
 * normalised, so `acceptedAnswers` only needs genuine alternatives (abbreviations, full forms).
 */

import type { Riddle } from '../models/content.ts';
import { RIDDLES_EXTRA } from './riddles.extra.ts';

const RIDDLES_CORE: readonly Riddle[] = [
  {
    id: 'r-dns',
    unitId: 'unit-6',
    topicId: 'dns',
    question: 'I turn names such as example.com into addresses machines understand. Who am I?',
    answer: 'DNS',
    acceptedAnswers: ['Domain Name System', 'Domain Name Service'],
    hints: ['I usually work over UDP port 53.', 'I am organised as a hierarchy starting at the root.'],
    difficulty: 'easy',
  },
  {
    id: 'r-router',
    unitId: 'unit-4',
    topicId: 'routing-algorithms',
    question: 'I live at Layer 3, I read logical addresses, and I decide which way your packet leaves. What am I?',
    answer: 'Router',
    hints: ['I separate broadcast domains.', 'I keep a table of destinations and next hops.'],
    difficulty: 'easy',
  },
  {
    id: 'r-switch',
    unitId: 'unit-3',
    topicId: 'mac-ethernet',
    question: 'I learn who lives on each of my ports, and I send frames only where they belong. What am I?',
    answer: 'Switch',
    acceptedAnswers: ['Network switch', 'Ethernet switch'],
    hints: ['I work with MAC addresses.', 'My ancestor, the hub, shouted to everyone instead.'],
    difficulty: 'easy',
  },
  {
    id: 'r-arp',
    unitId: 'unit-4',
    topicId: 'ipv4-addressing',
    question: 'You know the IP address but not the hardware address. You shout on the LAN, and I answer. Who am I?',
    answer: 'ARP',
    acceptedAnswers: ['Address Resolution Protocol'],
    hints: ['I map Layer 3 addresses to Layer 2 addresses.', 'I keep a small cache so you need not ask twice.'],
    difficulty: 'medium',
  },
  {
    id: 'r-dhcp',
    unitId: 'unit-6',
    topicId: 'dns',
    question: 'Plug in a new laptop and I hand it an address, a mask, a gateway and a resolver. Who am I?',
    answer: 'DHCP',
    acceptedAnswers: ['Dynamic Host Configuration Protocol'],
    hints: ['My conversation is often summarised as DORA.', 'I use UDP ports 67 and 68.'],
    difficulty: 'medium',
  },
  {
    id: 'r-tcp',
    unitId: 'unit-5',
    topicId: 'transport-tcp',
    question: 'I shake hands three times before I speak, I number every byte, and I resend whatever gets lost. Who am I?',
    answer: 'TCP',
    acceptedAnswers: ['Transmission Control Protocol'],
    hints: ['My header is 20 bytes without options.', 'My careless cousin needs only 8.'],
    difficulty: 'easy',
  },
  {
    id: 'r-udp',
    unitId: 'unit-5',
    topicId: 'transport-udp',
    question: 'I never call ahead, I never apologise for what I lose, and streaming loves me for it. Who am I?',
    answer: 'UDP',
    acceptedAnswers: ['User Datagram Protocol'],
    hints: ['My header has exactly four fields.', 'DNS queries usually travel inside me.'],
    difficulty: 'easy',
  },
  {
    id: 'r-crc',
    unitId: 'unit-3',
    topicId: 'data-link-error-control',
    question: 'I treat your frame as a polynomial, divide it, and send the remainder along as proof. Who am I?',
    answer: 'CRC',
    acceptedAnswers: ['Cyclic Redundancy Check'],
    hints: ['I ride at the tail of every Ethernet frame.', 'I detect errors but never correct them.'],
    difficulty: 'medium',
  },
  {
    id: 'r-subnet-mask',
    unitId: 'unit-4',
    topicId: 'subnetting',
    question: 'I am 32 bits of ones then zeros, and I tell you where the network ends and the host begins. What am I?',
    answer: 'Subnet mask',
    acceptedAnswers: ['Netmask', 'Mask'],
    hints: ['255.255.255.0 is one of my common forms.', 'CIDR writes me as a number after a slash.'],
    difficulty: 'medium',
  },
  {
    id: 'r-firewall',
    unitId: 'unit-6',
    topicId: 'network-security',
    question: 'I stand at the boundary with a rule book, and nothing passes unless my rules permit it. What am I?',
    answer: 'Firewall',
    hints: ['My stateful form remembers connections.', 'I often guard the entrance to a DMZ.'],
    difficulty: 'easy',
  },
  {
    id: 'r-osi',
    unitId: 'unit-1',
    topicId: 'osi-model',
    question: 'I have seven layers, I was born at ISO, and students remember me with a mnemonic. What am I?',
    answer: 'OSI model',
    acceptedAnswers: ['OSI', 'Open Systems Interconnection'],
    hints: ['My top layer is Application.', 'My layer 4 is Transport.'],
    difficulty: 'easy',
  },
  {
    id: 'r-fibre',
    unitId: 'unit-2',
    topicId: 'transmission-media',
    question: 'I carry your data as pulses of light, electrical noise cannot touch me, and I cross oceans. What am I?',
    answer: 'Optical fibre',
    acceptedAnswers: ['Fibre', 'Fiber', 'Optical fiber', 'Fibre optic cable', 'Fiber optic cable'],
    hints: ['My single-mode form goes the furthest.', 'My rival is copper.'],
    difficulty: 'medium',
  },
];

/** Both banks as one collection. */
export const RIDDLES: readonly Riddle[] = [...RIDDLES_CORE, ...RIDDLES_EXTRA];
