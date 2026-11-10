/**
 * Second question bank.
 *
 * Split from `questions.ts` so neither file becomes unreadable; they are concatenated there
 * and the integrity tests treat the result as one bank. These questions cover the syllabus
 * ground the first bank left thin: sliding windows, medium access, spanning tree, the
 * ARP/DHCP/ICMP family, quality of service, mail and file transfer, and cryptography.
 *
 * Every explanation says *why*, not just *which*. A question a student gets wrong is the one
 * chance to teach them something, and "Correct answer: B" teaches nothing.
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

export const QUESTIONS_EXTRA: readonly Question[] = [
  // ---------------------------------------------------------------- Unit 1

  q('qx-001', 'unit-1', 'network-basics',
    'Which delay component grows fastest as a link approaches full utilisation?',
    ["Propagation delay", "Processing delay", "Transmission delay", "Queuing delay"], 3,
    'Propagation depends on distance and transmission on frame size, both fixed. Queuing delay depends on how many packets are already waiting, so it climbs steeply as load rises.', 'medium'),

  q('qx-002', 'unit-1', 'network-basics',
    'A link is advertised at 100 Mbps but a file transfer sustains 62 Mbps. What is 62 Mbps?',
    ["Jitter", "Bandwidth", "Latency", "Throughput"], 3,
    'Bandwidth is the ceiling the link could carry; throughput is what was actually achieved after headers, retransmissions and contention.', 'easy'),

  q('qx-003', 'unit-1', 'network-basics',
    'Which property makes a collection of machines a network rather than a mainframe with terminals?',
    ["They are in one building", "They share a power supply", "They run the same operating system", "They are autonomous"], 3,
    'Autonomy is the defining word: no machine can start, stop or control another. Terminals hanging off a mainframe fail that test.', 'medium'),

  q('qx-004', 'unit-1', 'network-basics',
    'A protocol definition must fix syntax, timing and one more thing. What?',
    ["Encryption", "Bandwidth", "Topology", "Semantics"], 3,
    'Syntax is the format, semantics is what each field means, and timing covers when to send and how fast. All three or the two ends cannot agree.', 'easy'),

  q('qx-005', 'unit-1', 'network-basics',
    'Which measure matters most to a voice call?',
    ["Disk speed", "Jitter", "Number of hops", "Total bandwidth"], 1,
    'Voice needs a steady stream. Variable delay makes playback stutter even when average delay and bandwidth are comfortable.', 'medium'),

  q('qx-006', 'unit-1', 'network-topologies',
    'How many links does a full mesh of 8 nodes require?',
    ["64", "16", "28", "56"], 2,
    'n(n-1)/2 = 8 x 7 / 2 = 28. Each link is shared by two nodes, which is why the result is halved.', 'medium'),

  q('qx-007', 'unit-1', 'network-topologies',
    'Which topology suffers a total segment failure from a single cable break?',
    ["Full mesh", "Star", "Hybrid", "Bus"], 3,
    'A bus is one shared backbone. Break it and the segment splits, so every node on it loses contact.', 'easy'),

  q('qx-008', 'unit-1', 'network-topologies',
    'Classic Ethernet was wired as a star but behaved as a bus. What does that illustrate?',
    ["Star topology is obsolete", "Physical and logical topology can differ", "Bus needs no cabling", "Bad design"], 1,
    'Physical topology is where the cable runs; logical topology is the path data takes. They need not match, and exam questions exploit that gap.', 'medium'),

  q('qx-009', 'unit-1', 'osi-model',
    'Which OSI layer converts frames to bits and puts them on the medium?',
    ["Data link", "Physical", "Network", "Transport"], 1,
    'The physical layer handles voltages, connectors and timing. It has no idea what a frame means; it just transmits bits.', 'easy'),

  q('qx-010', 'unit-1', 'osi-model',
    'What is the PDU at the transport layer?',
    ["Packet", "Bit", "Frame", "Segment"], 3,
    'Bits at layer 1, frames at layer 2, packets at layer 3, segments at layer 4. Naming the wrong unit is a standard lost mark.', 'easy'),

  q('qx-011', 'unit-1', 'osi-model',
    'Encryption and compression are the responsibility of which OSI layer?',
    ["Presentation", "Application", "Transport", "Session"], 0,
    'The presentation layer deals with syntax rather than meaning: translation, encryption and compression all reshape data without changing what it says.', 'medium'),

  q('qx-012', 'unit-1', 'osi-model',
    'Why is layering useful when replacing copper with fibre?',
    ["It makes the network faster", "Only layer 1 changes; higher layers are untouched", "It doubles the bandwidth", "It removes the need for protocols"], 1,
    'Each layer offers a service through a fixed interface. Swapping the medium changes the physical layer only, and nothing above notices.', 'medium'),

  q('qx-013', 'unit-1', 'osi-model',
    'A device that reads logical addresses and chooses an outgoing path operates up to which layer?',
    ["Layer 4", "Layer 3", "Layer 1", "Layer 2"], 1,
    'That is a router. Logical addressing and path selection are network layer functions; a switch stops at layer 2.', 'easy'),

  q('qx-014', 'unit-1', 'tcp-ip-model',
    'The TCP/IP application layer corresponds to which OSI layers?',
    ["7 only", "6 and 7", "5, 6 and 7", "4, 5 and 6"], 2,
    'TCP/IP merges session, presentation and application into one layer, which is why it has four layers where OSI has seven.', 'medium'),

  q('qx-015', 'unit-1', 'tcp-ip-model',
    'What does the "narrow waist" of the TCP/IP model refer to?',
    ["Limited bandwidth", "IP being the single common protocol in the middle", "The small header size", "TCP being the only transport"], 1,
    'Many applications above and many link technologies below, all meeting at exactly one protocol: IP. That is what lets either end evolve independently.', 'hard'),

  q('qx-016', 'unit-1', 'tcp-ip-model',
    'IP offers best-effort delivery. What does that guarantee?',
    ["Constant delay", "Ordered delivery", "Guaranteed arrival", "Nothing beyond an attempt"], 3,
    'IP promises to try. Arrival, ordering and timing are all unguaranteed, which is why TCP exists for applications that need them.', 'easy'),

  // ---------------------------------------------------------------- Unit 2

  q('qx-017', 'unit-2', 'transmission-media',
    'Which impairment reshapes a signal because frequency components travel at different speeds?',
    ["Attenuation", "Crosstalk", "Impulse noise", "Distortion"], 3,
    'Attenuation only weakens the signal. Distortion changes its shape, because the components arrive at different times.', 'medium'),

  q('qx-018', 'unit-2', 'transmission-media',
    'Which formula gives channel capacity when noise is present?',
    ["Shannon", "Hamming", "Dijkstra", "Nyquist"], 0,
    'Nyquist covers a noiseless channel. Once the question mentions signal-to-noise ratio, the answer is Shannon: C = B log2(1 + S/N).', 'medium'),

  q('qx-019', 'unit-2', 'transmission-media',
    'Why does single-mode fibre carry further than multi-mode?',
    ["Light takes one path, avoiding modal dispersion", "Thicker glass", "It has more shielding", "It uses electricity"], 0,
    'A multi-mode core is wide enough for several light paths of differing length, which smears the pulse. A single-mode core allows only one.', 'hard'),

  q('qx-020', 'unit-2', 'transmission-media',
    'Which medium is immune to electromagnetic interference?',
    ["UTP", "Optical fibre", "Coaxial", "STP"], 1,
    'Fibre carries light, not current, so no electromagnetic field couples into it. That is why it crosses noisy industrial sites and lightning-prone runs.', 'easy'),

  q('qx-021', 'unit-2', 'transmission-media',
    'Why is twisted pair twisted at all?',
    ["To save cable", "To increase voltage", "To make it flexible", "So interference affects both wires equally and cancels"], 3,
    'Interference induced on a twisted pair hits both conductors nearly equally, and the receiver reads the difference, so the common part cancels.', 'medium'),

  q('qx-022', 'unit-2', 'switching-multiplexing',
    'Which switching method reserves capacity for the whole session whether or not it is used?',
    ["Packet switching", "Circuit switching", "Statistical multiplexing", "Datagram switching"], 1,
    'Circuit switching dedicates a path end to end. Silence on a phone call still consumes the reserved capacity.', 'easy'),

  q('qx-023', 'unit-2', 'switching-multiplexing',
    'What distinguishes statistical TDM from synchronous TDM?',
    ["Slots are allocated on demand rather than by fixed rotation", "It is slower", "It uses frequencies", "It requires fibre"], 0,
    'Synchronous TDM gives every source its slot whether or not it has data. Statistical TDM hands slots to whoever has something to send, so idle sources waste nothing.', 'medium'),

  q('qx-024', 'unit-2', 'switching-multiplexing',
    'A virtual circuit differs from circuit switching because it',
    ["establishes a path without dedicating capacity", "works only on fibre", "reserves bandwidth", "sends packets out of order"], 0,
    'A virtual circuit fixes the route so packets stay in order, but the link is still shared. Circuit switching reserves the capacity itself.', 'hard'),

  q('qx-025', 'unit-2', 'switching-multiplexing',
    'WDM is essentially FDM applied to what?',
    ["Copper", "Light in fibre", "Time slots", "Radio"], 1,
    'Wavelength Division Multiplexing separates channels by wavelength, which is frequency division carried out on an optical fibre.', 'medium'),

  // ---------------------------------------------------------------- Unit 3

  q('qx-026', 'unit-3', 'data-link-error-control',
    'With bit stuffing, what does the sender do after five consecutive 1s?',
    ["Insert a 1", "Send a flag", "Insert a 0", "Restart the frame"], 2,
    'Stuffing a 0 guarantees the flag pattern 01111110 can never occur inside the payload. The receiver removes any 0 following five 1s.', 'medium'),

  q('qx-027', 'unit-3', 'data-link-error-control',
    'Go-Back-N with a 3-bit sequence number allows what maximum window size?',
    ["4", "8", "3", "7"], 3,
    'Go-Back-N allows 2^m - 1, so 2^3 - 1 = 7. Using all 8 would make a full window indistinguishable from an empty one.', 'hard'),

  q('qx-028', 'unit-3', 'data-link-error-control',
    'Selective Repeat with a 3-bit sequence number allows what maximum window size?',
    ["3", "7", "8", "4"], 3,
    'Selective Repeat allows 2^(m-1) = 4. Any larger and the receiver could accept a retransmission as a new frame.', 'hard'),

  q('qx-029', 'unit-3', 'data-link-error-control',
    'Which error-detection scheme misses every even number of bit errors?',
    ["Simple parity", "CRC", "Hamming code", "Checksum"], 0,
    'A single parity bit tracks whether the count of 1s is odd or even, so two errors restore the original parity and go unnoticed.', 'easy'),

  q('qx-030', 'unit-3', 'data-link-error-control',
    'Why is Stop-and-Wait unsuitable for a satellite link?',
    ["It needs fibre", "It cannot detect errors", "It has no acknowledgements", "One frame per round trip wastes almost all the capacity"], 3,
    'With a 500 ms round trip the sender manages two frames a second no matter how fast the link is. Sliding window is the only fix.', 'medium'),

  q('qx-031', 'unit-3', 'data-link-error-control',
    'What does CRC actually compute?',
    ["A hash", "A sum of bytes", "The remainder of a polynomial division", "A parity bit per byte"], 2,
    'The frame is treated as a polynomial and divided by a generator; the remainder travels with it. That is why CRC catches every burst shorter than the generator.', 'medium'),

  q('qx-032', 'unit-3', 'data-link-error-control',
    'Deep-space probes prefer forward error correction over ARQ because',
    ["FEC uses less power", "retransmission would take hours", "FEC is cheaper", "ARQ needs fibre"], 1,
    'ARQ is normally cheaper, but when the round trip is measured in hours, asking again is not an option. Correcting in place is.', 'medium'),

  q('qx-033', 'unit-3', 'mac-ethernet',
    'Why does Ethernet mandate a minimum frame size?',
    ["To save bandwidth", "To simplify CRC", "To fit the MAC address", "So a sender is still transmitting when a collision signal returns"], 3,
    'Collision detection only works if the sender has not finished. The 64-byte minimum guarantees transmission lasts longer than the worst-case round trip.', 'hard'),

  q('qx-034', 'unit-3', 'mac-ethernet',
    'Wi-Fi uses CSMA/CA rather than CSMA/CD because',
    ["a wireless node cannot detect a collision happening at the receiver", "it is faster", "collisions never occur", "it needs less power"], 0,
    'A transmitting radio cannot hear a much weaker colliding signal at the far end, so wireless avoids collisions in advance instead of detecting them.', 'medium'),

  q('qx-035', 'unit-3', 'mac-ethernet',
    'An 8-port switch creates how many collision domains?',
    ["8", "16", "2", "1"], 0,
    'Every switch port is its own collision domain. A hub, by contrast, leaves all eight in one, which is precisely why switches replaced hubs.', 'medium'),

  q('qx-036', 'unit-3', 'mac-ethernet',
    'Why is Spanning Tree Protocol necessary in a switched LAN?',
    ["To encrypt frames", "To assign IP addresses", "To speed up forwarding", "Layer-2 frames have no TTL, so a loop never clears"], 3,
    'An IP packet caught in a loop dies when its TTL expires. An Ethernet frame has no such field, so broadcasts multiply until the LAN collapses.', 'hard'),

  q('qx-037', 'unit-3', 'mac-ethernet',
    'Slotted ALOHA improves channel efficiency from roughly 18% to what?',
    ["37%", "25%", "50%", "75%"], 0,
    'Aligning transmissions to slot boundaries halves the window in which a collision can occur, doubling efficiency to about 37%.', 'hard'),

  q('qx-038', 'unit-3', 'mac-ethernet',
    'How does a transparent bridge learn where an address lives?',
    ["By asking a router", "From DHCP", "By reading source addresses of frames it receives", "From a configuration file"], 2,
    'It notes which port a frame arrived on and associates the source address with it. No configuration is needed, hence "transparent".', 'medium'),

  q('qx-039', 'unit-3', 'mac-ethernet',
    'A MAC address cannot be routed across the Internet because it',
    ["changes every reboot", "is encrypted", "is flat, carrying no location information", "is too short"], 2,
    'MAC addresses are flat identifiers with no hierarchy, so they cannot be aggregated. IP addresses are hierarchical, which is what makes routing tractable.', 'medium'),

  // ---------------------------------------------------------------- Unit 4

  q('qx-040', 'unit-4', 'ipv4-addressing',
    'Which protocol finds the MAC address behind a known IP on the same link?',
    ["ARP", "ICMP", "DNS", "RARP"], 0,
    'ARP broadcasts the question because it does not yet know who to ask, and receives a unicast reply because by then it does.', 'easy'),

  q('qx-041', 'unit-4', 'ipv4-addressing',
    'Traceroute discovers the path by manipulating which field?',
    ["Protocol number", "TTL", "Checksum", "Source address"], 1,
    'Packets are sent with TTL 1, 2, 3 and so on. Each router that discards one returns an ICMP time-exceeded message, naming itself in the process.', 'hard'),

  q('qx-042', 'unit-4', 'ipv4-addressing',
    'Which of these is a private address range?',
    ["1.1.1.0/24", "200.0.0.0/8", "8.8.8.0/24", "172.16.0.0/12"], 3,
    '10/8, 172.16/12 and 192.168/16 are reserved for private use and are not routed on the public Internet.', 'medium'),

  q('qx-043', 'unit-4', 'ipv4-addressing',
    'An IPv6 header is a fixed 40 bytes with no checksum. Why drop the checksum?',
    ["Checksums are insecure", "IPv6 cannot detect errors", "It saves address space", "Layer 2 and layer 4 already check, so repeating it at every hop wastes time"], 3,
    'The link layer checks each hop and the transport layer checks end to end. Recomputing a header checksum at every router was pure overhead.', 'hard'),

  q('qx-044', 'unit-4', 'ipv4-addressing',
    'A machine boots knowing nothing and needs an address, mask, gateway and DNS server. Which protocol supplies them?',
    ["ICMP", "DNS", "ARP", "DHCP"], 3,
    'DHCP leases the whole configuration. RARP did an early, far more limited version of this and is long superseded.', 'easy'),

  q('qx-045', 'unit-4', 'ipv4-addressing',
    'Ping is built on which protocol?',
    ["ARP", "ICMP", "UDP", "TCP"], 1,
    'Ping sends an ICMP echo request and times the echo reply. ICMP is the network layer reporting on itself.', 'easy'),

  q('qx-046', 'unit-4', 'subnetting',
    'How many usable hosts does a /27 subnet provide?',
    ["32", "14", "62", "30"], 3,
    'A /27 leaves 5 host bits, so 2^5 = 32 addresses, minus the network and broadcast addresses, giving 30 usable.', 'medium'),

  q('qx-047', 'unit-4', 'subnetting',
    'What is the block size of a /28 subnet?',
    ["16", "32", "8", "64"], 0,
    'A /28 has mask octet 240, and 256 - 240 = 16. Subnets therefore begin at 0, 16, 32, 48 and so on.', 'medium'),

  q('qx-048', 'unit-4', 'subnetting',
    'In 192.168.1.0/26, which address is the broadcast address of the second subnet?',
    ["192.168.1.128", "192.168.1.127", "192.168.1.63", "192.168.1.64"], 1,
    'Block size 64 gives subnets .0-.63, .64-.127, .128-.191, .192-.255. The second subnet ends at .127, which is its broadcast address.', 'hard'),

  q('qx-049', 'unit-4', 'subnetting',
    'Why must VLSM allocation start with the largest subnet?',
    ["It is faster", "Small subnets are optional", "The mask requires it", "Starting small fragments the block so the large subnet no longer fits"], 3,
    'A large subnet needs a contiguous, correctly aligned block. Allocating small ones first leaves holes that no longer accommodate it.', 'hard'),

  q('qx-050', 'unit-4', 'subnetting',
    'Why are two addresses unusable in every IPv4 subnet?',
    ["They are reserved for routers", "All-zeros names the network and all-ones is the broadcast", "They are reserved for DNS", "They are used by DHCP"], 1,
    'The all-zeros host portion identifies the subnet itself and the all-ones portion addresses every host on it, so neither can belong to a single machine.', 'easy'),

  q('qx-051', 'unit-4', 'subnetting',
    'Supernetting exists mainly to',
    ["create more subnets", "improve security", "shrink routing tables by aggregating contiguous blocks", "increase host count"], 2,
    'Combining adjacent networks into one shorter prefix means routers advertise a single entry instead of many. It is subnetting run backwards.', 'medium'),

  q('qx-052', 'unit-4', 'routing-algorithms',
    'Which routing family floods link descriptions and computes paths locally?',
    ["Distance vector", "Static", "Path vector", "Link state"], 3,
    'Link state routers each build a full map from flooded advertisements, then run Dijkstra themselves. Distance vector shares conclusions instead of facts.', 'medium'),

  q('qx-053', 'unit-4', 'routing-algorithms',
    'RIP defines 16 hops as unreachable in order to',
    ["save memory", "give count-to-infinity a finite endpoint", "speed up forwarding", "support more routers"], 1,
    'Without a defined infinity, two routers could increment each other\'s distances forever. Capping at 16 makes the process terminate in seconds.', 'hard'),

  q('qx-054', 'unit-4', 'routing-algorithms',
    'What does split horizon prevent?',
    ["Advertising a route back to the neighbour it was learned from", "Fragmentation", "Address exhaustion", "Congestion"], 0,
    'Telling a neighbour about a route it taught you is how stale information loops back and inflates. Split horizon simply refuses to do it.', 'medium'),

  q('qx-055', 'unit-4', 'routing-algorithms',
    'Which shaping algorithm permits a burst after a quiet period?',
    ["Neither", "Token bucket", "Leaky bucket", "Both"], 1,
    'Token bucket accumulates credit while idle and spends it in a burst. Leaky bucket always emits at a constant rate, whatever has been saved.', 'medium'),

  q('qx-056', 'unit-4', 'routing-algorithms',
    'BGP is best described as which kind of protocol?',
    ["Flooding", "Distance vector", "Path vector", "Link state"], 2,
    'BGP advertises the full AS path, which makes loops visible and lets policy override raw distance. That is what a path vector protocol is.', 'hard'),

  q('qx-057', 'unit-4', 'routing-algorithms',
    'What is the difference between routing and forwarding?',
    ["They are the same", "Routing builds the table; forwarding is the per-packet lookup", "Forwarding builds the table", "Routing applies only to switches"], 1,
    'Routing is the background process that decides what the table should say. Forwarding is the fast per-packet action of consulting it.', 'medium'),

  // ---------------------------------------------------------------- Unit 5

  q('qx-058', 'unit-5', 'transport-tcp',
    'Why does TCP connection release take four segments rather than three?',
    ["To resend lost data", "To confirm the checksum", "To renegotiate the window", "Each direction closes independently"], 3,
    'A TCP connection is two independent byte streams. One side can stop sending while still receiving, so each direction gets its own FIN and ACK.', 'hard'),

  q('qx-059', 'unit-5', 'transport-tcp',
    'TCP sequence numbers count what?',
    ["Packets", "Segments", "Windows", "Bytes"], 3,
    'Counting bytes lets TCP retransmit a differently sized segment covering the same data, which segment counting could not express.', 'medium'),

  q('qx-060', 'unit-5', 'transport-tcp',
    'What does a cumulative acknowledgement of 500 tell the sender?',
    ["The window is 500", "Only 500 bytes remain", "Byte 500 arrived", "Everything before 500 arrived"], 3,
    'ACK 500 means "I have everything up to 499 and expect 500 next". It says nothing about anything received beyond that gap.', 'medium'),

  q('qx-061', 'unit-5', 'transport-tcp',
    'Which timer prevents deadlock when a window update is lost?',
    ["Keepalive timer", "Retransmission timer", "Persist timer", "TIME_WAIT timer"], 2,
    'A zero window stops the sender. If the update reopening it is lost, the persist timer prompts a probe, so both ends do not wait for each other forever.', 'hard'),

  q('qx-062', 'unit-5', 'transport-tcp',
    'What identifies one endpoint of a TCP connection?',
    ["Sequence number", "Port alone", "MAC address", "IP address and port together"], 3,
    'That pair is the socket. The IP finds the host and the port selects the process on it; neither is sufficient alone.', 'easy'),

  q('qx-063', 'unit-5', 'transport-udp',
    'How large is a UDP header?',
    ["20 bytes", "40 bytes", "8 bytes", "4 bytes"], 2,
    'Source port, destination port, length and checksum, two bytes each. TCP needs 20 bytes minimum to carry its extra machinery.', 'easy'),

  q('qx-064', 'unit-5', 'transport-udp',
    'Why does DNS use UDP for ordinary queries?',
    ["TCP cannot carry DNS", "UDP encrypts", "UDP is more reliable", "A query and reply fit in one exchange; a handshake would cost more than a retry"], 3,
    'A TCP handshake would triple the cost of a small lookup. If the answer is lost, asking again is cheaper than setting up a connection.', 'medium'),

  q('qx-065', 'unit-5', 'transport-udp',
    'Which port range is reserved for well-known services?',
    ["0-255", "0-1023", "49152-65535", "1024-49151"], 1,
    'Well-known ports run 0-1023, registered 1024-49151, and dynamic or ephemeral 49152-65535.', 'easy'),

  q('qx-066', 'unit-5', 'transport-udp',
    'Which pair of protocol and port is correct?',
    ["DNS on 80", "SSH on 22", "IMAP on 25", "SMTP on 110"], 1,
    'SSH is 22. SMTP is 25, POP3 110, IMAP 143, DNS 53 and HTTP 80.', 'medium'),

  q('qx-067', 'unit-5', 'transport-udp',
    'IntServ differs from DiffServ because it',
    ["reserves resources per flow", "works only on LANs", "requires fibre", "marks packets into classes"], 0,
    'IntServ reserves per flow, giving strong guarantees but forcing routers to hold state for every conversation. DiffServ marks a few classes and scales.', 'hard'),

  q('qx-068', 'unit-5', 'transport-udp',
    'Retransmitting a lost frame in a live video call is undesirable because',
    ["the codec cannot decode it", "UDP forbids it", "it costs bandwidth", "the frame arrives after the moment it belonged to"], 3,
    'A late frame is worse than a missing one: the player has already moved on, and inserting it would disrupt what is being shown now.', 'medium'),

  q('qx-069', 'unit-5', 'congestion-control',
    'On a timeout, TCP sets the congestion window to what?',
    ["Zero", "One MSS", "The advertised window", "Half its value"], 1,
    'A timeout signals severe congestion, so the threshold halves and cwnd restarts at one MSS with slow start. Three duplicate ACKs are treated far more gently.', 'hard'),

  q('qx-070', 'unit-5', 'congestion-control',
    'Three duplicate ACKs indicate what?',
    ["The receiver crashed", "A packet was lost but later ones are arriving", "The connection closed", "The network is idle"], 1,
    'Duplicate ACKs mean data is still getting through past a gap, so the path works. Fast retransmit resends immediately without waiting for a timeout.', 'medium'),

  q('qx-071', 'unit-5', 'congestion-control',
    'What does AIMD stand for, and why does it work?',
    ["Additive Increase Multiplicative Decrease, because it converges to fairness", "Automatic Increase Manual Decrease, because it is simple", "Additive Interval Multiple Delay, because it avoids loss", "Average Increase Minimum Delay, because it is fast"], 0,
    'Growing slowly and retreating sharply means competing flows converge on an equal share, which is why AIMD survived where other schemes did not.', 'hard'),

  q('qx-072', 'unit-5', 'congestion-control',
    'The sender may transmit at most the minimum of which two values?',
    ["MTU and MSS", "RTT and timeout", "Congestion window and advertised window", "Slow start and threshold"], 2,
    'The advertised window protects the receiver\'s buffers; the congestion window protects the network. The sender must respect both, so it takes the smaller.', 'medium'),

  q('qx-073', 'unit-5', 'congestion-control',
    'Why is "slow start" a misleading name?',
    ["It is slower than congestion avoidance", "cwnd doubles every RTT, which is exponential growth", "It never ends", "It only applies to UDP"], 1,
    'Only the starting point is small. Doubling each round trip makes it the fastest-growing phase; congestion avoidance afterwards is the slow one.', 'medium'),

  q('qx-074', 'unit-5', 'congestion-control',
    'Congestion collapse describes which situation?',
    ["A router losing power", "Throughput falling as offered load rises", "DNS failure", "A cable break"], 1,
    'Once most traffic is retransmission of packets already dropped, adding load reduces useful throughput. The failure feeds itself.', 'hard'),

  // ---------------------------------------------------------------- Unit 6

  q('qx-075', 'unit-6', 'dns',
    'Which DNS record maps a name to an IPv6 address?',
    ["AAAA", "MX", "A", "CNAME"], 0,
    'A is IPv4 and AAAA is IPv6. CNAME is an alias and MX names a mail server.', 'easy'),

  q('qx-076', 'unit-6', 'dns',
    'In an iterative query, what does a server return when it lacks the answer?',
    ["The final answer anyway", "An error", "A referral to the next server to ask", "Nothing"], 2,
    'Iterative resolution returns "ask them instead", leaving the resolver to continue. A recursive query asks the server to do all the work itself.', 'medium'),

  q('qx-077', 'unit-6', 'dns',
    'Why lower a record\'s TTL before migrating a server?',
    ["To save bandwidth", "To speed up the server", "To improve security", "So cached copies expire quickly and clients follow the move"], 3,
    'TTL controls how long resolvers may cache the old answer. Lowering it in advance means the change propagates in minutes rather than a day.', 'hard'),

  q('qx-078', 'unit-6', 'dns',
    'When does DNS use TCP rather than UDP?',
    ["Only over IPv6", "For zone transfers and oversized responses", "Never", "For all queries"], 1,
    'Small queries fit a UDP datagram. Zone transfers and responses too large for one datagram need TCP\'s reliability and streaming.', 'medium'),

  q('qx-079', 'unit-6', 'dns',
    'A zone and a domain are not the same because',
    ["a zone is smaller than a domain always", "zones are for IPv6", "domains are cached", "a domain may be split across several zones with delegated authority"], 3,
    'A zone is the part of the tree one server is authoritative for. Delegating a subdomain creates a second zone inside the same domain.', 'hard'),

  q('qx-080', 'unit-6', 'http-web',
    'Which HTTP status class indicates a client error?',
    ["3xx", "4xx", "5xx", "2xx"], 1,
    '4xx means the request was faulty, such as 404 for something absent. 5xx means the server accepted the request and then failed.', 'easy'),

  q('qx-081', 'unit-6', 'http-web',
    'HTTP is stateless. How do sites remember a logged-in user?',
    ["The IP address", "The protocol stores it", "The TCP connection", "Cookies returned with each request"], 3,
    'The server issues a value the browser sends back every time, reconstructing continuity the protocol itself does not provide.', 'medium'),

  q('qx-082', 'unit-6', 'http-web',
    'FTP uses two connections. What are they for?',
    ["Upload and download", "IPv4 and IPv6", "Control commands and data transfer", "Encryption and authentication"], 2,
    'Control runs on port 21 for the whole session while data moves on a separate connection. That second connection is what makes FTP awkward through firewalls.', 'medium'),

  q('qx-083', 'unit-6', 'http-web',
    'What is the practical difference between POP3 and IMAP?',
    ["IMAP is faster", "POP3 is encrypted", "POP3 supports attachments", "POP3 downloads and typically deletes; IMAP keeps mail on the server and syncs"], 3,
    'IMAP suits several devices because the server holds the authoritative state. POP3 assumes one machine and takes the mail away.', 'medium'),

  q('qx-084', 'unit-6', 'http-web',
    'Which protocol pushes mail between servers?',
    ["IMAP", "POP3", "SMTP", "SNMP"], 2,
    'SMTP is a push protocol used for submission and server-to-server relay. POP3 and IMAP are the retrieval half.', 'easy'),

  q('qx-085', 'unit-6', 'http-web',
    'Telnet was replaced by SSH mainly because Telnet',
    ["sends everything including passwords in clear text", "was slow", "lacked file transfer", "used too much bandwidth"], 0,
    'Anyone able to observe the path could read the session and the credentials. SSH provides the same access with encryption and host authentication.', 'easy'),

  q('qx-086', 'unit-6', 'network-security',
    'For confidentiality, a message is encrypted with whose key?',
    ["A shared hash", "Sender's public key", "Sender's private key", "Recipient's public key"], 3,
    'Only the recipient holds the matching private key, so only they can decrypt. Using the sender\'s private key instead produces a signature, not secrecy.', 'hard'),

  q('qx-087', 'unit-6', 'network-security',
    'A digital signature is produced by encrypting what, with which key?',
    ["A hash, with the recipient's public key", "A hash of the message, with the sender's private key", "The message, with a shared key", "The message, with the recipient's public key"], 1,
    'Signing a hash is cheap and proves origin, integrity and non-repudiation at once, because only the sender could have produced it.', 'hard'),

  q('qx-088', 'unit-6', 'network-security',
    'Which security goal does a DDoS attack violate?',
    ["Confidentiality", "Integrity", "Non-repudiation", "Availability"], 3,
    'Nothing is read or altered. The service is simply unreachable, which is availability and nothing else.', 'easy'),

  q('qx-089', 'unit-6', 'network-security',
    'Why is asymmetric encryption used to exchange a symmetric key rather than encrypt the data?',
    ["It cannot encrypt large keys", "It needs a certificate", "It is far slower than symmetric encryption", "It is less secure"], 2,
    'Public-key operations are orders of magnitude slower. Using them once to agree a session key, then AES for the traffic, gets both properties.', 'medium'),

  q('qx-090', 'unit-6', 'network-security',
    'What does a certificate authority actually vouch for?',
    ["That traffic is encrypted", "That a site is safe", "That a public key belongs to the named identity", "That the server is online"], 2,
    'Without that binding, a man in the middle could present their own key. The CA\'s signature is what makes the key trustworthy, not the encryption itself.', 'hard'),

  q('qx-091', 'unit-6', 'network-security',
    'Why is hashing not encryption?',
    ["It uses public keys", "It only works on text", "It is one-way and has no key to reverse it", "It is slower"], 2,
    'A hash cannot be undone to recover the input, and there is no key involved. It provides integrity, never confidentiality.', 'medium'),

  q('qx-092', 'unit-6', 'network-security',
    'A firewall alone is insufficient because it',
    ["is too slow", "filters traffic but neither authenticates users nor encrypts anything", "blocks all traffic", "only works on IPv4"], 1,
    'Filtering by rule stops unwanted connections. It says nothing about who is on an allowed connection or whether what they send can be read in transit.', 'medium'),
];
