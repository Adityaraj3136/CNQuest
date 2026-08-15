/**
 * Syllabus units.
 *
 * SEED DATA — generated for development and demonstration. Replace with the official
 * university Computer Networks syllabus before academic submission. Ids are referenced by
 * topics, questions, riddles and bosses, so rename them everywhere at once.
 */

import type { Unit } from '../models/content.ts';

export const UNITS: readonly Unit[] = [
  {
    id: 'unit-1',
    number: 1,
    title: 'Foundations & Reference Models',
    description: 'What a network is, how networks are classified, and the OSI and TCP/IP models.',
    icon: 'bi-diagram-3',
    order: 1,
  },
  {
    id: 'unit-2',
    number: 2,
    title: 'Physical Layer',
    description: 'Transmission media, signal encoding, multiplexing and switching techniques.',
    icon: 'bi-ethernet',
    order: 2,
  },
  {
    id: 'unit-3',
    number: 3,
    title: 'Data Link Layer',
    description: 'Framing, error detection and correction, medium access control and Ethernet.',
    icon: 'bi-link-45deg',
    order: 3,
  },
  {
    id: 'unit-4',
    number: 4,
    title: 'Network Layer',
    description: 'IPv4 and IPv6 addressing, subnetting, and routing algorithms and protocols.',
    icon: 'bi-signpost-split',
    order: 4,
  },
  {
    id: 'unit-5',
    number: 5,
    title: 'Transport Layer',
    description: 'TCP, UDP, reliable delivery, flow control and congestion control.',
    icon: 'bi-arrow-left-right',
    order: 5,
  },
  {
    id: 'unit-6',
    number: 6,
    title: 'Application Layer & Security',
    description: 'DNS, HTTP, email and file transfer protocols, DHCP, and network security basics.',
    icon: 'bi-globe2',
    order: 6,
  },
];
