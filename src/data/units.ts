/**
 * Syllabus units.
 *
 * Aligned to the AKTU B.Tech CSE Computer Networks syllabus (KCS-603 / BCS603), which is
 * examined as five units. They are split into six here because AKTU's Unit II carries both
 * the physical layer and the whole data link layer, which is too much ground for one
 * revision unit. Unit 2 and Unit 3 below are that unit's two halves.
 *
 * Unit ids are referenced by topics, questions, riddles and bosses. Rename them everywhere
 * at once or not at all.
 */

import type { Unit } from '../models/content.ts';

export const UNITS: readonly Unit[] = [
  {
    id: 'unit-1',
    number: 1,
    title: 'Foundations & Reference Models',
    description:
      'Why networks exist, how they are classified, and the two layered models every later answer is built on. Syllabus Unit I.',
    icon: 'bi-diagram-3',
    order: 1,
  },
  {
    id: 'unit-2',
    number: 2,
    title: 'Physical Layer',
    description:
      'Getting bits onto a wire and sharing it: media, encoding, impairments, switching and multiplexing. First half of syllabus Unit II.',
    icon: 'bi-ethernet',
    order: 2,
  },
  {
    id: 'unit-3',
    number: 3,
    title: 'Data Link Layer & LANs',
    description:
      'Turning a noisy line into a usable link: framing, error control, sliding windows, and who gets to talk on a shared medium. Second half of syllabus Unit II.',
    icon: 'bi-link-45deg',
    order: 3,
  },
  {
    id: 'unit-4',
    number: 4,
    title: 'Network Layer',
    description:
      'Addressing and finding a path across networks that have never met: IP, subnetting, ARP and friends, routing algorithms, IPv6. Syllabus Unit III.',
    icon: 'bi-signpost-split',
    order: 4,
  },
  {
    id: 'unit-5',
    number: 5,
    title: 'Transport Layer',
    description:
      'Process-to-process delivery: TCP, UDP, connection management, flow control, congestion control and quality of service. Syllabus Unit IV.',
    icon: 'bi-arrow-left-right',
    order: 5,
  },
  {
    id: 'unit-6',
    number: 6,
    title: 'Application Layer & Security',
    description:
      'The protocols you actually use every day, plus the cryptography that keeps them honest. Syllabus Unit V.',
    icon: 'bi-globe2',
    order: 6,
  },
];
