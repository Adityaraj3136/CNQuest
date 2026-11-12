/**
 * How each Packet Dash question family is labelled and coloured. One table, read by the page
 * (mission card) and the 3D scene (banner over the gates), so the two never disagree.
 * No three.js import: the page loads this without pulling in the 3D chunk.
 */

import type { Category } from './packet-dash.engine';

export interface CategoryMeta {
  /** Small caps label on the mission card. */
  chip: string;
  /** Instruction under the prompt. */
  hint: string;
  /** Word in the 3D banner: "HTTPS → port?". */
  word: string;
  color: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  port: { chip: 'Port', hint: 'Fly through its port number', word: 'port', color: '#67e8f9' },
  transport: { chip: 'Carried by', hint: 'TCP, UDP or ICMP?', word: 'carried by', color: '#86efac' },
  device: { chip: 'Device', hint: 'Which device does this?', word: 'device', color: '#93c5fd' },
  pdu: { chip: 'Data unit', hint: 'Name the PDU at this layer', word: 'PDU', color: '#f9a8d4' },
  layer: { chip: 'OSI layer', hint: 'Fly through its layer', word: 'layer', color: '#c4b5fd' },
  size: { chip: 'Size', hint: 'Pick the right size', word: 'size', color: '#fdba74' },
  private: { chip: 'Private IP', hint: 'Fly through the RFC 1918 address', word: 'private', color: '#5eead4' },
  subnet: { chip: 'Subnet', hint: 'Fly through the subnet that holds it', word: 'subnet', color: '#fcd34d' },
  hosts: { chip: 'Usable hosts', hint: 'How many hosts fit?', word: 'hosts', color: '#fde68a' },
};

export const TIER_UNLOCK_COPY: Record<2 | 3, string> = {
  2: 'Level up: layers · sizes · private IPs',
  3: 'Level up: subnets · host counts',
};
