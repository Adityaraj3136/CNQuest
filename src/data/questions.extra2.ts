/**
 * Third question bank.
 *
 * Weighted towards units 2, 3 and 5. Unit 2 had 17 questions against unit 4's 37, which meant
 * a round on the physical layer repeated itself quickly and the new Signal Warden boss would
 * have had almost nothing to draw on.
 */

import type { Difficulty, GameType, Question } from '../models/content.ts';

const ANY: GameType[] = ['quiz', 'rapid-fire', 'boss'];

function q(
  id: string,
  unitId: string,
  topicId: string,
  question: string,
  options: string[],
  correctAnswer: number,
  explanation: string,
  difficulty: Difficulty,
  gameTypes: GameType[] = ANY,
): Question {
  return { id, unitId, topicId, question, options, correctAnswer, explanation, difficulty, gameTypes };
}

export const QUESTIONS_EXTRA2: readonly Question[] = [
  // ---------------------------------------------------------------- Unit 2

  q('qy-001', 'unit-2', 'transmission-media',
    'A channel has 4 kHz bandwidth and carries 4 signal levels with no noise. What is the maximum data rate?',
    ['8 kbps', '16 kbps', '4 kbps', '32 kbps'], 1,
    'Nyquist gives C = 2B log2(L) = 2 x 4000 x log2(4) = 16 kbps. Noiseless means Nyquist, not Shannon.', 'hard'),

  q('qy-002', 'unit-2', 'transmission-media',
    'Which impairment does shielding a cable primarily reduce?',
    ['Attenuation', 'Induced noise and crosstalk', 'Propagation delay', 'Modal dispersion'], 1,
    'A shield stops external electromagnetic energy coupling into the conductor. It does nothing about distance-related weakening.', 'medium'),

  q('qy-003', 'unit-2', 'transmission-media',
    'Why is fibre preferred between buildings on a campus?',
    ['It is cheaper to terminate', 'It is immune to electromagnetic interference and has no earthing issues', 'It carries electricity safely', 'It needs no connectors'], 1,
    'Light carries no current, so no interference couples in and no ground-potential difference exists between buildings.', 'easy'),

  q('qy-004', 'unit-2', 'transmission-media',
    'Doubling the bandwidth of a noisy channel does what to Shannon capacity?',
    ['Doubles it exactly', 'Increases it, but less than double once noise scales with bandwidth', 'Leaves it unchanged', 'Halves it'], 1,
    'C = B log2(1 + S/N). Widening B admits more noise, so the signal-to-noise ratio falls and the gain is under double.', 'hard'),

  q('qy-005', 'unit-2', 'transmission-media',
    'Which cable category is rated for a 100 m run in a structured LAN?',
    ['Coaxial only', 'Twisted pair', 'Single-mode fibre only', 'Any medium'], 1,
    'Structured cabling standards put the horizontal twisted-pair run at 100 m, which is why floor switches exist.', 'easy'),

  q('qy-006', 'unit-2', 'transmission-media',
    'What causes modal dispersion in multi-mode fibre?',
    ['External interference', 'Light rays taking paths of different lengths', 'Voltage drop', 'Reflection off the shield'], 1,
    'A wide core admits several propagation modes. They arrive at slightly different times, which smears the pulse and limits distance.', 'hard'),

  q('qy-007', 'unit-2', 'switching-multiplexing',
    'In a datagram network, two packets of the same message can',
    ['never take different routes', 'arrive out of order by different routes', 'share one sequence number', 'skip the network layer'], 1,
    'Each datagram is routed independently, so they may take different paths and arrive in any order. Reassembly is the transport layer\'s problem.', 'medium'),

  q('qy-008', 'unit-2', 'switching-multiplexing',
    'What does a virtual circuit guarantee that a datagram network does not?',
    ['Reserved bandwidth', 'Packets follow one path and stay in order', 'Zero delay', 'Error-free delivery'], 1,
    'A virtual circuit fixes the route at setup, so packets stay ordered. It does not reserve capacity, which is what separates it from circuit switching.', 'hard'),

  q('qy-009', 'unit-2', 'switching-multiplexing',
    'Synchronous TDM wastes capacity when',
    ['every source is busy', 'a source has nothing to send during its slot', 'the link is fibre', 'there are only two sources'], 1,
    'The slot is allocated whether or not it is used. Statistical TDM exists precisely to reclaim those empty slots.', 'medium'),

  q('qy-010', 'unit-2', 'switching-multiplexing',
    'Message switching differs from packet switching because',
    ['it splits data into small units', 'the whole message is stored and forwarded at each hop', 'it reserves a path', 'it has no store-and-forward delay'], 1,
    'A whole message occupies each hop for its full transmission time, which is why large messages block the path.', 'medium'),

  q('qy-011', 'unit-2', 'switching-multiplexing',
    'Which is the main drawback of circuit switching for bursty data?',
    ['Variable delay', 'Reserved capacity sits idle during silences', 'Packets arrive out of order', 'It cannot carry voice'], 1,
    'Bursty traffic uses the reserved path in short bursts and wastes it in between. Packet switching fills those gaps with other traffic.', 'easy'),

  q('qy-012', 'unit-2', 'transmission-media',
    'Unguided media differ from guided media mainly because they are',
    ['faster', 'shared and broadcast by nature', 'immune to noise', 'always encrypted'], 1,
    'Radio is a shared medium anyone in range receives, which is why wireless needs access control that a dedicated cable does not.', 'medium'),

  // ---------------------------------------------------------------- Unit 3

  q('qy-013', 'unit-3', 'data-link-error-control',
    'A 4-bit sequence number is used with Go-Back-N. What is the largest usable window?',
    ['8', '15', '16', '7'], 1,
    'Go-Back-N allows 2^m - 1, so 2^4 - 1 = 15. A full 16 would make a completely full window look identical to an empty one.', 'hard'),

  q('qy-014', 'unit-3', 'data-link-error-control',
    'Which framing method would break if the data happened to contain the flag pattern?',
    ['Bit stuffing', 'Flag bytes with no stuffing', 'Character count with escape', 'Coding violations'], 1,
    'Flags alone are ambiguous the moment the payload contains the same pattern. Stuffing exists to make that impossible.', 'medium'),

  q('qy-015', 'unit-3', 'data-link-error-control',
    'A CRC generator polynomial of degree 8 produces a remainder of how many bits?',
    ['7', '8', '9', '16'], 1,
    'The remainder is always one bit shorter than the divisor in bit terms: a degree 8 generator is 9 bits, giving an 8-bit CRC.', 'hard'),

  q('qy-016', 'unit-3', 'data-link-error-control',
    'Hamming distance 5 between valid codewords allows correction of how many bit errors?',
    ['1', '2', '4', '5'], 1,
    'Correction capability is (d-1)/2, so (5-1)/2 = 2. Detection alone would be d-1, which is 4.', 'hard'),

  q('qy-017', 'unit-3', 'data-link-error-control',
    'Piggybacking improves efficiency by',
    ['compressing the frame', 'carrying an acknowledgement inside a data frame going the other way', 'skipping error checks', 'increasing the window'], 1,
    'It avoids sending a frame that would otherwise carry nothing but an acknowledgement.', 'medium'),

  q('qy-018', 'unit-3', 'mac-ethernet',
    'Pure ALOHA achieves roughly what maximum channel efficiency?',
    ['9%', '18%', '37%', '50%'], 1,
    'Pure ALOHA peaks near 18%. Aligning transmissions to slots halves the vulnerable window and doubles it to about 37%.', 'hard'),

  q('qy-019', 'unit-3', 'mac-ethernet',
    'In 1-persistent CSMA, what does a station do when it senses the channel busy?',
    ['Waits a random time', 'Keeps listening and transmits immediately when it goes idle', 'Gives up', 'Transmits anyway'], 1,
    'It transmits with probability 1 as soon as the line frees, which is why two waiting stations collide reliably.', 'hard'),

  q('qy-020', 'unit-3', 'mac-ethernet',
    'What is the purpose of the backoff algorithm after an Ethernet collision?',
    ['To increase throughput', 'To make the retry times of colliding stations differ', 'To detect the collision', 'To reserve the channel'], 1,
    'Both stations wait a random multiple of the slot time, so they are unlikely to collide again immediately.', 'medium'),

  q('qy-021', 'unit-3', 'mac-ethernet',
    'A switch receives a frame for an address it has never seen. What does it do?',
    ['Discards it', 'Floods it out of every port except the one it arrived on', 'Returns it to the sender', 'Buffers it indefinitely'], 1,
    'Flooding is how the switch reaches an unknown destination. The reply teaches it which port that address lives on.', 'medium'),

  q('qy-022', 'unit-3', 'mac-ethernet',
    'Which device separates broadcast domains?',
    ['Hub', 'Switch', 'Router', 'Repeater'], 2,
    'Switches forward broadcasts; only a router, or a VLAN boundary configured on a switch, stops them.', 'medium'),

  q('qy-023', 'unit-3', 'mac-ethernet',
    'What does the spanning tree algorithm actually produce?',
    ['The fastest path', 'A loop-free subset of links with some ports blocked', 'A list of MAC addresses', 'A routing table'], 1,
    'It elects a root and blocks whichever ports would create a loop, leaving exactly one active path between any two switches.', 'hard'),

  q('qy-024', 'unit-3', 'mac-ethernet',
    'Why can a layer-2 loop be more damaging than a layer-3 loop?',
    ['Frames are larger', 'Frames have no TTL, so nothing removes them', 'Switches are slower', 'MAC addresses expire'], 1,
    'An IP packet caught in a loop dies when its TTL hits zero. An Ethernet frame has no such field and circulates until the topology changes.', 'hard'),

  // ---------------------------------------------------------------- Unit 5

  q('qy-025', 'unit-5', 'transport-tcp',
    'What does the TCP receiver advertise in its window field?',
    ['Congestion level', 'Free buffer space it can accept', 'Round trip time', 'Segment size'], 1,
    'The advertised window is flow control: it caps how much unacknowledged data the sender may have outstanding.', 'medium'),

  q('qy-026', 'unit-5', 'transport-tcp',
    'Karn\'s algorithm addresses which problem?',
    ['Window scaling', 'Ambiguous round trip samples from retransmitted segments', 'Checksum errors', 'Port exhaustion'], 1,
    'A retransmitted segment gives no reliable RTT sample, because the acknowledgement could be for either copy. Karn excludes those samples.', 'hard'),

  q('qy-027', 'unit-5', 'transport-tcp',
    'What is the purpose of the TCP pseudo-header in the checksum?',
    ['Compression', 'To include IP addresses so a misdelivered segment is detected', 'Encryption', 'Sequencing'], 1,
    'Covering the source and destination addresses means a segment delivered to the wrong host fails its checksum.', 'hard'),

  q('qy-028', 'unit-5', 'transport-tcp',
    'Why does TCP use a random initial sequence number rather than always starting at zero?',
    ['To save space', 'So old duplicate segments from a previous connection are not accepted', 'To speed up the handshake', 'To support IPv6'], 1,
    'A predictable start would let a stale segment from an earlier connection fall inside the new window and be accepted as valid.', 'hard'),

  q('qy-029', 'unit-5', 'transport-tcp',
    'A host has many connections to the same web server. What must differ between them?',
    ['The destination IP', 'The source port', 'The protocol', 'The MAC address'], 1,
    'The four-tuple of source IP, source port, destination IP and destination port must be unique. Only the source port is free to vary here.', 'medium'),

  q('qy-030', 'unit-5', 'transport-udp',
    'Why is the UDP checksum optional in IPv4 but mandatory in IPv6?',
    ['IPv6 is slower', 'IPv6 removed the header checksum, so the transport layer must cover it', 'IPv6 packets are larger', 'IPv4 uses ARP'], 1,
    'IPv4 routers verified a header checksum at every hop. IPv6 dropped it for speed, so the burden moves up to the transport layer.', 'hard'),

  q('qy-031', 'unit-5', 'transport-udp',
    'Which application would suffer most from TCP retransmission?',
    ['File download', 'Live voice call', 'Email delivery', 'Web page load'], 1,
    'A retransmitted voice packet arrives after the moment it belonged to, so it disrupts playback rather than repairing it.', 'medium'),

  q('qy-032', 'unit-5', 'transport-udp',
    'What identifies the process that should receive an arriving segment?',
    ['MAC address', 'Port number', 'IP address', 'Sequence number'], 1,
    'The IP address finds the host; the 16-bit port number selects which process on it receives the data.', 'easy'),

  q('qy-033', 'unit-5', 'congestion-control',
    'cwnd is 16 MSS and the threshold is 16. What happens on the next successful round trip?',
    ['cwnd becomes 32', 'cwnd becomes 17', 'cwnd resets to 1', 'cwnd stays at 16'], 1,
    'At the threshold, slow start ends and congestion avoidance begins: additive increase of roughly one MSS per round trip.', 'hard'),

  q('qy-034', 'unit-5', 'congestion-control',
    'Which signal does TCP interpret as congestion?',
    ['A router message', 'Packet loss', 'High latency alone', 'A full receive buffer'], 1,
    'Classic TCP infers congestion from loss, detected by timeout or duplicate acknowledgements. Nothing in the network tells it directly.', 'medium'),

  q('qy-035', 'unit-5', 'congestion-control',
    'What does fast recovery avoid doing after three duplicate ACKs?',
    ['Retransmitting', 'Dropping the window all the way back to one MSS', 'Sending new data', 'Updating the threshold'], 1,
    'Data is still flowing, so the path works. Halving the window keeps the connection productive instead of restarting from scratch.', 'hard'),

  q('qy-036', 'unit-5', 'congestion-control',
    'Congestion collapse is characterised by',
    ['high latency with high throughput', 'throughput falling as offered load rises', 'a router rebooting', 'packets arriving early'], 1,
    'Once most transmissions are retransmissions of already-dropped packets, adding load reduces useful throughput.', 'hard'),

  // ---------------------------------------------------------------- Units 1, 4, 6 top-up

  q('qy-037', 'unit-1', 'osi-model',
    'Which OSI layer is responsible for dialogue control and checkpointing?',
    ['Transport', 'Session', 'Presentation', 'Application'], 1,
    'The session layer manages the conversation itself, including checkpoints that let a long transfer resume rather than restart.', 'medium'),

  q('qy-038', 'unit-1', 'network-basics',
    'Propagation delay depends primarily on',
    ['packet size', 'distance and medium', 'router speed', 'queue length'], 1,
    'Propagation is distance divided by signal speed in the medium. Packet size drives transmission delay instead.', 'medium'),

  q('qy-039', 'unit-1', 'network-topologies',
    'Adding one node to a full mesh of 8 nodes requires how many new links?',
    ['1', '8', '9', '28'], 1,
    'The new node needs a link to each of the existing 8. Total rises from 28 to 36.', 'hard'),

  q('qy-040', 'unit-4', 'ipv4-addressing',
    'A host sends an ARP request. How is it addressed at layer 2?',
    ['Unicast to the gateway', 'Broadcast to every station on the link', 'Multicast to routers', 'Unicast to the target'], 1,
    'The sender does not know the target MAC yet, so it asks everyone. The reply comes back as a unicast.', 'medium'),

  q('qy-041', 'unit-4', 'subnetting',
    'How many /28 subnets fit inside a /24 network?',
    ['8', '16', '14', '32'], 1,
    'The prefix grows by 4 bits, so 2^4 = 16 subnets, each with 14 usable hosts.', 'medium'),

  q('qy-042', 'unit-4', 'routing-algorithms',
    'What makes BGP a path vector rather than a distance vector protocol?',
    ['It uses hop count', 'It advertises the full AS path, making loops visible', 'It floods link states', 'It runs Dijkstra'], 1,
    'Carrying the whole path lets a router discard any advertisement containing its own AS, and lets policy override raw distance.', 'hard'),

  q('qy-043', 'unit-6', 'dns',
    'Which DNS record type directs mail for a domain?',
    ['A', 'MX', 'NS', 'PTR'], 1,
    'MX names the mail exchanger. NS delegates a zone, PTR does reverse lookups, A maps to an IPv4 address.', 'easy'),

  q('qy-044', 'unit-6', 'http-web',
    'Which HTTP method is intended to be safe and have no side effects?',
    ['POST', 'GET', 'PUT', 'DELETE'], 1,
    'GET retrieves without changing state. Using it to modify data breaks caches, prefetching and the back button.', 'medium'),

  q('qy-045', 'unit-6', 'network-security',
    'A message is hashed, and the hash is encrypted with the sender\'s private key. What has been produced?',
    ['An encrypted message', 'A digital signature', 'A certificate', 'A session key'], 1,
    'That is exactly a digital signature: it proves origin, proves integrity, and cannot later be denied.', 'medium'),
];
