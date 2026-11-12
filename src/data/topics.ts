/**
 * Topic notes.
 *
 * Written against the AKTU Computer Networks syllabus (KCS-603 / BCS603). Each topic leads
 * with a `hook` naming the problem before the answer, and closes with `pitfalls` — the
 * mistakes that lose marks in the exam and break networks in the lab. Revision sticks better
 * when it reads like a fight someone had to win, because it was.
 *
 * Ids are referenced by questions, riddles, matching sets, word banks and bosses. Renaming
 * one means renaming it everywhere; `content.test.ts` fails the build if a reference dangles.
 */

import type { Topic } from '../models/content.ts';
import { TOPIC_SECTIONS } from './topics.depth.ts';

/** Reading speed used to add the in-depth sections to each topic's estimated time. */
const WORDS_PER_MINUTE = 200;

const BASE_TOPICS: readonly Topic[] = [
  // ---------------------------------------------------------------- Unit 1

  {
    id: 'network-basics',
    unitId: 'unit-1',
    title: 'Introduction to Computer Networks',
    description: 'Why networks exist, how they are judged, and how they are classified by scale.',
    order: 1,
    estimatedMinutes: 8,
    hook: 'Two computers in one room. How do you get a file from one to the other without carrying it?',
    overview:
      'A computer network is a set of autonomous devices connected by a transmission medium so they can exchange data. "Autonomous" is doing real work in that sentence: no machine controls another, which is what separates a network from a mainframe with terminals hanging off it. Networks are judged on three things the syllabus keeps returning to — performance, reliability and security — and classified most often by the ground they cover, from a headset paired to a phone to the Internet itself.',
    keyPoints: [
      'Four reasons networks exist: sharing resources, communication, reliability through redundancy, and saving money on hardware nobody uses full time.',
      'Classified by scale: PAN (a desk), LAN (a building), MAN (a city), WAN (countries). The Internet is a network of networks, not a bigger WAN.',
      'Performance has four measures and they are not the same: bandwidth, throughput, latency, jitter.',
      'Bandwidth is what the link could carry. Throughput is what you actually got. Throughput is never higher, and is usually well below.',
      'Latency is made of four parts: propagation, transmission, queuing and processing delay. Queuing is the one that explodes under load.',
      'A protocol fixes three things: syntax (format), semantics (meaning), timing (when, and how fast).',
      'An ISP sells you a path into that network of networks; tiers of ISPs peer with each other to make the Internet reachable end to end.',
    ],
    definitions: [
      { term: 'LAN', meaning: 'Local Area Network. One building or campus, privately owned, high speed, low delay.' },
      { term: 'WAN', meaning: 'Wide Area Network. Spans cities or countries, usually over leased or public infrastructure.' },
      { term: 'Bandwidth', meaning: 'Maximum data rate a channel can carry, in bits per second. A ceiling, not a promise.' },
      { term: 'Throughput', meaning: 'The rate actually achieved, after overhead, errors and congestion take their cut.' },
      { term: 'Latency', meaning: 'Time for one bit to travel sender to receiver, summed over all four delay types.' },
      { term: 'Jitter', meaning: 'Variation in packet delay. Voice and video hate it more than they hate raw delay.' },
    ],
    examples: [
      'A college lab wired to switches is a LAN. Bank branches linked across states is a WAN.',
      'A 100 Mbps link that delivers 60 Mbps of file data has 100 Mbps bandwidth and 60 Mbps throughput. The missing 40 is headers, retransmissions and contention.',
    ],
    pitfalls: [
      'Writing "bandwidth" when the question asks for throughput. They are different marks.',
      'Calling the Internet a WAN. It is an interconnection of many networks under separate administration.',
      'Forgetting queuing delay exists, then being unable to explain why a lightly loaded link feels fast and a busy one does not.',
    ],
    relatedTerms: ['lan', 'wan', 'bandwidth', 'latency', 'protocol'],
  },

  {
    id: 'network-topologies',
    unitId: 'unit-1',
    title: 'Network Topologies',
    description: 'Bus, star, ring, mesh and hybrid layouts, and what each one costs you.',
    order: 2,
    estimatedMinutes: 7,
    hook: 'You have five machines and a budget. Every way you wire them trades money against what happens when one cable dies.',
    overview:
      'Topology is the shape of the network. Physical topology is where the cable actually runs; logical topology is the path data takes, and the two genuinely differ — classic Ethernet was a logical bus wired as a physical star. Every topology is a bet about which failure you can live with, which is why the exam asks for trade-offs rather than definitions.',
    keyPoints: [
      'Bus: one shared backbone, cheapest to lay. One break splits the segment and everyone stops.',
      'Star: every node to a central switch. A dead node affects only itself; a dead centre kills everything.',
      'Ring: each node has exactly two neighbours and data circulates one way. A single break is fatal unless the ring is dual.',
      'Mesh: every node linked to every other. n(n-1)/2 links for n nodes, which is why nobody builds a full mesh of 50 machines.',
      'Hybrid: real networks are stars of stars, with a partial mesh between the switches that matter.',
      'Physical and logical topology need not match, and exam questions exploit exactly that gap.',
    ],
    definitions: [
      { term: 'Full mesh', meaning: 'Every device has a dedicated link to every other device. Maximum redundancy, brutal cost.' },
      { term: 'Single point of failure', meaning: 'One component whose failure stops everything downstream of it.' },
      { term: 'Physical topology', meaning: 'The actual layout of cable and devices.' },
      { term: 'Logical topology', meaning: 'The route data follows, regardless of how the cable runs.' },
    ],
    examples: [
      'A full mesh of 6 routers needs 6 × 5 / 2 = 15 links. Add one router and you need 6 more.',
      'A campus with one core switch and per-floor access switches is a hybrid: star per floor, partial mesh at the core.',
    ],
    pitfalls: [
      'Answering "star is best" without naming the central switch as a single point of failure.',
      'Using n(n-1) instead of n(n-1)/2 for full-mesh links. Each link is shared by two nodes.',
    ],
    relatedTerms: ['topology', 'switch', 'hub'],
  },

  {
    id: 'osi-model',
    unitId: 'unit-1',
    title: 'OSI Model',
    description: 'Seven layers, what each is responsible for, and why the split exists at all.',
    order: 3,
    estimatedMinutes: 12,
    hook: 'A photo leaves your phone and arrives in Canada intact. Seven different problems had to be solved on the way, and no single layer solves more than one.',
    overview:
      'The OSI reference model splits communication into seven layers, each doing one job and offering a service to the layer above through a defined interface. It is a teaching and design model rather than an implementation — nothing you use runs pure OSI — but it is the vocabulary every other answer in this syllabus is written in. Layering matters because it lets a layer be replaced without disturbing its neighbours: swapping copper for fibre changes layer 1 and nothing above it notices.',
    keyPoints: [
      'Physical (1): raw bits onto the medium. Voltages, connectors, timing.',
      'Data Link (2): node-to-node delivery on one link. Framing, MAC addressing, error detection, flow control.',
      'Network (3): host-to-host across many links. Logical addressing and routing.',
      'Transport (4): process-to-process. Segmentation, reliability, flow and congestion control.',
      'Session (5): dialogue control, checkpointing, recovery of long transfers.',
      'Presentation (6): translation, encryption, compression. Syntax, not meaning.',
      'Application (7): the protocols users meet, HTTP and SMTP and DNS.',
      'Data is encapsulated going down and de-encapsulated going up. Each layer adds a header and treats everything above as opaque payload.',
      'Unit names by layer: bits, frames, packets, segments. Naming the wrong one is a giveaway in exams.',
    ],
    definitions: [
      { term: 'Encapsulation', meaning: 'Each layer wrapping the layer above in its own header before passing it down.' },
      { term: 'PDU', meaning: 'Protocol Data Unit. The name for the chunk a given layer handles.' },
      { term: 'Peer-to-peer process', meaning: 'A layer on one host communicating logically with the same layer on the other host.' },
      { term: 'Service interface', meaning: 'What a layer promises the layer above, without revealing how it does it.' },
    ],
    examples: [
      'A router works to layer 3, a switch to layer 2, a hub only to layer 1. The device tells you how far up it can read.',
      'Encryption sits at layer 6 in OSI, but TLS in the real world sits between transport and application, which is exactly the mismatch that makes OSI a model rather than a blueprint.',
    ],
    pitfalls: [
      'Reciting the layers but not the PDU names. Half the marks are in "segment vs packet vs frame".',
      'Claiming the Internet runs OSI. It runs TCP/IP; OSI is the reference used to describe it.',
      'Putting routing at layer 2. Switching is layer 2; routing is layer 3.',
    ],
    relatedTerms: ['osi-model', 'encapsulation', 'router', 'switch'],
  },

  {
    id: 'tcp-ip-model',
    unitId: 'unit-1',
    title: 'TCP/IP Model',
    description: 'The four-layer stack the Internet actually runs, and how it maps onto OSI.',
    order: 4,
    estimatedMinutes: 8,
    hook: 'OSI was designed by committee before the fact. TCP/IP was built by people with a working network and a deadline. Only one of them is carrying your traffic.',
    overview:
      'The TCP/IP suite predates OSI standardisation and won because it shipped. It has four layers — Link, Internet, Transport, Application — and collapses OSI\'s session, presentation and application into one. Its defining decision is the narrow waist: everything runs over IP, and IP runs over everything, so a new link technology or a new application needs no permission from the middle.',
    keyPoints: [
      'Link layer: OSI layers 1 and 2 together. Ethernet, Wi-Fi, PPP.',
      'Internet layer: IP, ICMP, ARP. Best-effort delivery with no promises.',
      'Transport layer: TCP for reliability, UDP for speed. The choice is the application\'s.',
      'Application layer: OSI 5, 6 and 7 merged. HTTP, DNS, SMTP, FTP.',
      'IP is deliberately unreliable. Reliability is bought at the transport layer by whoever wants it, and not paid for by anyone who does not.',
      'The hourglass: many applications above, many link technologies below, exactly one IP in the middle.',
    ],
    definitions: [
      { term: 'Protocol suite', meaning: 'A family of protocols designed to work together as a stack.' },
      { term: 'Best-effort delivery', meaning: 'The network will try. No guarantee of arrival, order, or timing.' },
      { term: 'Narrow waist', meaning: 'The single common protocol every layer above and below must agree on: IP.' },
    ],
    examples: [
      'A DNS lookup: application DNS, transport UDP, internet IP, link Ethernet. Four headers, one small question.',
    ],
    pitfalls: [
      'Mapping TCP/IP application layer to OSI layer 7 only. It covers 5, 6 and 7.',
      'Saying IP is reliable because your downloads work. TCP is doing that work above it.',
    ],
    relatedTerms: ['tcp-ip', 'ip', 'protocol'],
  },

  // ---------------------------------------------------------------- Unit 2

  {
    id: 'transmission-media',
    unitId: 'unit-2',
    title: 'Transmission Media',
    description: 'Guided and unguided media, and the impairments that limit every one of them.',
    order: 1,
    estimatedMinutes: 9,
    hook: 'Every network is, at the bottom, a physicist\'s problem: push a signal down something and hope it is still recognisable at the far end.',
    overview:
      'Media split into guided (twisted pair, coaxial, fibre) and unguided (radio, microwave, infrared). The choice is decided by bandwidth, distance, interference and cost, and every medium loses the same three fights: attenuation, distortion and noise. Understanding impairments matters more than memorising cable categories, because impairments are what error control at the next layer exists to survive.',
    keyPoints: [
      'Twisted pair: cheap, easy, ~100 m. Twisting cancels interference; UTP has no shield, STP does.',
      'Coaxial: better shielding and bandwidth than twisted pair, largely displaced in LANs.',
      'Fibre: light in glass. Enormous bandwidth, immune to electromagnetic interference, no earthing problems, expensive to splice.',
      'Single-mode fibre carries one ray a long way; multi-mode carries many and suffers modal dispersion, so it stays short.',
      'Unguided media are shared and broadcast by nature, which is why wireless needs medium access rules that cable does not.',
      'Three impairments: attenuation (signal weakens), distortion (components travel at different speeds), noise (something else arrives too).',
      'Nyquist gives the maximum rate on a noiseless channel; Shannon gives capacity when noise is present. Shannon is the ceiling nobody beats.',
    ],
    definitions: [
      { term: 'Attenuation', meaning: 'Loss of signal strength with distance. Fixed by amplifiers or repeaters.' },
      { term: 'Distortion', meaning: 'Signal shape changing because frequency components propagate at different speeds.' },
      { term: 'Noise', meaning: 'Unwanted energy added to the signal: thermal, induced, crosstalk, impulse.' },
      { term: 'Bandwidth-delay product', meaning: 'How many bits fit in the pipe at once. Capacity multiplied by round-trip delay.' },
    ],
    examples: [
      'Cat 6 UTP to a desk, multi-mode fibre between floors, single-mode fibre between buildings. Each chosen by distance, not fashion.',
      'Shannon: a 3 kHz channel at 30 dB SNR caps out near 30 kbps, which is why dial-up modems stopped improving.',
    ],
    pitfalls: [
      'Confusing attenuation with distortion. One weakens the signal, the other reshapes it.',
      'Claiming fibre has "no" limits. It has attenuation and dispersion too, just far less.',
      'Using Nyquist where the question mentions noise. Noise means Shannon.',
    ],
    relatedTerms: ['fibre-optic', 'twisted-pair', 'attenuation'],
  },

  {
    id: 'switching-multiplexing',
    unitId: 'unit-2',
    title: 'Switching & Multiplexing',
    description: 'Circuit, message and packet switching, and how one link carries many conversations.',
    order: 2,
    estimatedMinutes: 10,
    hook: 'A telephone call reserves a path for its whole duration. A web page does not. That single difference produced the Internet.',
    overview:
      'Switching decides how a path is established across intermediate nodes; multiplexing decides how one physical link is shared by several signals. The syllabus pairs them because they answer the same underlying question — how do you avoid giving every conversation its own wire — and because the circuit-versus-packet comparison is a guaranteed exam question.',
    keyPoints: [
      'Circuit switching: a dedicated path reserved end to end before any data moves. Constant delay, wasted capacity when idle. The classic telephone network.',
      'Message switching: whole messages stored and forwarded. No reservation, but a large message ties up each hop.',
      'Packet switching: messages split into packets forwarded independently. Efficient, resilient, variable delay.',
      'Datagram packet switching routes each packet independently; virtual circuit switching sets up a path first and labels packets to follow it.',
      'FDM divides the link by frequency, TDM by time slot, WDM by wavelength on fibre.',
      'Synchronous TDM gives every source a slot whether or not it has data; statistical TDM allocates on demand and is why packet networks fill links better.',
    ],
    definitions: [
      { term: 'Circuit switching', meaning: 'Reserving a dedicated path for the entire session.' },
      { term: 'Datagram', meaning: 'A packet routed independently, carrying full addressing, arriving in any order.' },
      { term: 'Virtual circuit', meaning: 'A pre-established path packets follow in order, without dedicating capacity.' },
      { term: 'Statistical TDM', meaning: 'Time slots handed out on demand rather than by fixed rotation.' },
    ],
    examples: [
      'A voice call reserving 64 kbps for ten minutes uses that capacity even during silence. Packet switching sends nothing during silence and lets someone else use it.',
    ],
    pitfalls: [
      'Saying packet switching is "always better". It has variable delay and jitter, which is why real-time traffic needs QoS.',
      'Mixing up virtual circuits with circuit switching. A virtual circuit reserves a path, not bandwidth.',
      'Forgetting that synchronous TDM wastes empty slots. That waste is the whole reason statistical TDM exists.',
    ],
    relatedTerms: ['packet-switching', 'multiplexing', 'tdm'],
  },

  // ---------------------------------------------------------------- Unit 3

  {
    id: 'data-link-error-control',
    unitId: 'unit-3',
    title: 'Framing & Error Control',
    description: 'Turning a bit stream into frames, catching corruption, and sliding-window protocols.',
    order: 1,
    estimatedMinutes: 12,
    hook: 'The physical layer hands you a stream of bits, some of them wrong, with no marking where anything starts. Everything above depends on you fixing that.',
    overview:
      'The data link layer makes an unreliable line behave like a usable link. It has to mark where frames begin and end, detect that bits changed on the way, and stop a fast sender drowning a slow receiver. The sliding-window protocols at the end of this topic are the syllabus\'s favourite derivation, because their efficiency formulas can be asked as numericals.',
    keyPoints: [
      'Framing methods: character count, byte stuffing with flag bytes, bit stuffing, and physical layer coding violations.',
      'Bit stuffing inserts a 0 after five consecutive 1s so the flag 01111110 can never appear inside data. The receiver removes it.',
      'Parity catches any odd number of bit errors and misses every even number. Cheap and weak.',
      'Checksums add; CRC divides. CRC treats the frame as a polynomial and appends the remainder, catching all burst errors shorter than the generator.',
      'Hamming distance d detects d-1 errors and corrects (d-1)/2. Hamming code adds parity bits at powers of two to locate the wrong bit.',
      'Error control is either detect-and-retransmit (ARQ) or correct-in-place (FEC). ARQ is cheaper unless retransmission is expensive, which is why deep space uses FEC.',
      'Stop-and-Wait sends one frame and waits. Correct, and catastrophically slow on long links.',
      'Go-Back-N retransmits the failed frame and everything after it. Selective Repeat retransmits only what failed, at the cost of receiver buffering.',
      'Window sizes: Go-Back-N allows 2^m - 1, Selective Repeat allows 2^(m-1), for an m-bit sequence number.',
    ],
    definitions: [
      { term: 'Framing', meaning: 'Marking where one frame ends and the next begins in a continuous bit stream.' },
      { term: 'CRC', meaning: 'Cyclic Redundancy Check. Polynomial division whose remainder travels with the frame.' },
      { term: 'ARQ', meaning: 'Automatic Repeat reQuest. Detect the error, ask for it again.' },
      { term: 'Piggybacking', meaning: 'Carrying an acknowledgement inside a data frame going the other way.' },
      { term: 'Sliding window', meaning: 'Allowing several unacknowledged frames in flight to keep a long link busy.' },
    ],
    examples: [
      'Data 0111111010 with bit stuffing becomes 01111101010 — a 0 forced in after five 1s.',
      'Stop-and-Wait on a satellite link with 500 ms round trip sends two frames a second regardless of bandwidth. Sliding window is the only fix.',
    ],
    pitfalls: [
      'Saying CRC "corrects" errors. It detects; ARQ then retransmits.',
      'Using Go-Back-N window size for Selective Repeat. Selective Repeat needs half, or sequence numbers alias and the receiver accepts a duplicate as new.',
      'Forgetting parity misses even numbers of errors — the reason it is never used alone on a noisy link.',
    ],
    relatedTerms: ['crc', 'frame', 'arq', 'hamming-code'],
  },

  {
    id: 'mac-ethernet',
    unitId: 'unit-3',
    title: 'MAC, Ethernet & LAN Switching',
    description: 'Who gets to talk on a shared medium, plus bridges, switches and spanning tree.',
    order: 2,
    estimatedMinutes: 11,
    hook: 'One cable, thirty machines, all of them with something to say. Without a rule, everyone talks at once and nobody is heard.',
    overview:
      'Medium access control is the referee for a shared channel. The syllabus wants the three families — contention, controlled access, and channelisation — and then Ethernet as the case study that beat everything else. Bridges and switches follow because they solve the same problem by making the shared medium smaller until each device has one to itself.',
    keyPoints: [
      'ALOHA transmits whenever ready and hopes; slotted ALOHA aligns to slots and doubles efficiency from 18% to 37%.',
      'CSMA listens before transmitting. Persistent, non-persistent and p-persistent differ in what they do when the line is busy.',
      'CSMA/CD listens while transmitting and aborts on collision. Ethernet\'s rule, and it needs a minimum frame size so collisions are detected before a sender finishes.',
      'CSMA/CA avoids collisions instead of detecting them, because a wireless node cannot hear a collision at the receiver. Wi-Fi\'s rule.',
      'Controlled access: reservation, polling, token passing. Deterministic delay, no collisions, more overhead.',
      'Channelisation: FDMA, TDMA, CDMA divide the channel rather than arbitrating for it.',
      'A MAC address is 48 bits, burned in, flat, and has no geography — which is exactly why it cannot be routed.',
      'A bridge or switch learns which MAC lives on which port by watching source addresses, then forwards rather than floods.',
      'Every switch port is its own collision domain; the whole switched LAN remains one broadcast domain until a router or VLAN splits it.',
      'Spanning Tree Protocol disables links until the topology is loop-free, because a layer-2 loop has no TTL and broadcasts multiply until the LAN dies.',
    ],
    definitions: [
      { term: 'Collision domain', meaning: 'The set of devices whose transmissions can collide with each other.' },
      { term: 'Broadcast domain', meaning: 'The set of devices a broadcast frame reaches.' },
      { term: 'Transparent bridge', meaning: 'A bridge that learns addresses by observation, needing no configuration.' },
      { term: 'Broadcast storm', meaning: 'Broadcast frames circulating a layer-2 loop forever, saturating the LAN.' },
    ],
    examples: [
      'A hub with 8 ports is one collision domain. An 8-port switch is eight, and that is the entire reason switches replaced hubs.',
      'Ethernet\'s 64-byte minimum frame exists so a sender is still transmitting when the collision signal gets back to it.',
    ],
    pitfalls: [
      'Saying switches stop broadcasts. They forward them; only a router or VLAN boundary stops them.',
      'Using CSMA/CD for Wi-Fi. Wireless uses CSMA/CA, because a node cannot detect a collision happening at the receiver.',
      'Forgetting why STP exists. "Loops are bad" earns nothing; "layer 2 has no TTL, so nothing kills a looping frame" earns the mark.',
    ],
    relatedTerms: ['mac-address', 'ethernet', 'switch', 'csma-cd'],
  },

  // ---------------------------------------------------------------- Unit 4

  {
    id: 'ipv4-addressing',
    unitId: 'unit-4',
    title: 'IPv4, IPv6 & Address Resolution',
    description: 'Logical addressing, classes and CIDR, IPv6, and the ARP/DHCP/ICMP supporting cast.',
    order: 1,
    estimatedMinutes: 12,
    hook: 'A MAC address says who you are. It does not say where you are, and you cannot deliver post to a name alone.',
    overview:
      'The network layer gives every interface a hierarchical address so routers can aggregate, and hierarchy is the only reason the Internet\'s routing tables are merely large rather than impossible. This topic covers IPv4 structure, the classful scheme and its replacement by CIDR, the exhaustion that produced NAT and IPv6, and the four helper protocols the syllabus lists beside them: ARP, RARP, DHCP and ICMP.',
    keyPoints: [
      'An IPv4 address is 32 bits, written as four dotted decimal octets, and identifies an interface rather than a host.',
      'Classful addressing (A, B, C, D, E) wasted enormous space: a class B was 65 534 hosts to an organisation needing 300.',
      'CIDR replaced classes with an explicit prefix length, so allocation matches need and routes aggregate.',
      'Private ranges (10/8, 172.16/12, 192.168/16) are not routable on the Internet. NAT translates them at the border and breaks end-to-end addressing doing it.',
      'IPv6 is 128 bits, written in hex groups, with no broadcast, no header checksum, and a fixed 40-byte header for faster forwarding.',
      'ARP maps a known IP to an unknown MAC on the local link, by broadcasting the question and unicasting the answer.',
      'RARP does the reverse for diskless machines and is long superseded by DHCP.',
      'DHCP leases an address, mask, gateway and DNS server to a client that arrives knowing nothing.',
      'ICMP carries the network layer\'s error and diagnostic messages. Ping and traceroute are ICMP wearing different hats.',
    ],
    definitions: [
      { term: 'CIDR', meaning: 'Classless Inter-Domain Routing. Addressing by explicit prefix length, e.g. /26.' },
      { term: 'ARP', meaning: 'Address Resolution Protocol. Finds the MAC address behind a known IP on the same link.' },
      { term: 'NAT', meaning: 'Network Address Translation. Many private addresses sharing one public address.' },
      { term: 'ICMP', meaning: 'Internet Control Message Protocol. Reports errors and answers diagnostics.' },
      { term: 'Dual stack', meaning: 'Running IPv4 and IPv6 together during the migration nobody has finished.' },
    ],
    examples: [
      'Ping is an ICMP echo request and reply. Traceroute sends packets with rising TTL and reads the ICMP time-exceeded messages that come back.',
      'ARP is broadcast because the asker does not yet know who to ask; the reply is unicast because by then it does.',
    ],
    pitfalls: [
      'Calling ARP a network layer protocol that runs over IP. It sits between layers 2 and 3 and is carried directly in a frame.',
      'Saying IPv6 "has more addresses" and stopping. The mark is in no broadcast, no fragmentation by routers, no header checksum.',
      'Treating NAT as a security feature. It is an address-conservation hack that happens to hide topology.',
    ],
    relatedTerms: ['ipv4', 'ipv6', 'nat', 'cidr'],
  },

  {
    id: 'subnetting',
    unitId: 'unit-4',
    title: 'Subnetting',
    description: 'Splitting a network with masks, VLSM, and the arithmetic the exam actually tests.',
    order: 2,
    estimatedMinutes: 15,
    hook: 'You are handed one network and four departments that must not see each other\'s broadcasts. The address block does not change. You do.',
    overview:
      'Subnetting borrows bits from the host portion to create additional network bits, trading host capacity for separate broadcast domains. This is the most numerical topic in the syllabus and the one most often failed on arithmetic rather than understanding, so the method matters as much as the concept: find the block size, count in it, and never guess.',
    keyPoints: [
      'The mask marks network bits as 1 and host bits as 0. /26 means 26 network bits and 6 host bits.',
      'Usable hosts per subnet is 2^h - 2. The two lost are the all-zeros network address and the all-ones broadcast address.',
      'Block size = 256 - (mask octet value). A /26 has mask 192, block size 64, so subnets start at 0, 64, 128, 192.',
      'Number of subnets from borrowing b bits is 2^b.',
      'VLSM applies different masks within one block, sizing each subnet to its actual need instead of the largest need.',
      'Allocate VLSM largest-first. Starting with the small subnets fragments the block and the big one no longer fits.',
      'Supernetting is the same arithmetic in reverse: combining contiguous blocks into one shorter prefix to shrink routing tables.',
    ],
    definitions: [
      { term: 'Subnet mask', meaning: 'The bit pattern separating network portion from host portion.' },
      { term: 'VLSM', meaning: 'Variable Length Subnet Masking. Different prefix lengths inside one network.' },
      { term: 'Network address', meaning: 'All host bits zero. Names the subnet, cannot be assigned to a host.' },
      { term: 'Broadcast address', meaning: 'All host bits one. Reaches every host on that subnet.' },
    ],
    examples: [
      '192.168.1.0/26 gives four subnets: .0-.63, .64-.127, .128-.191, .192-.255. Each has 62 usable hosts.',
      'Need 50, 25, 10 and 2 hosts? Allocate /26, then /27, then /28, then /30 — largest first, and everything fits.',
    ],
    pitfalls: [
      'Forgetting to subtract 2 for network and broadcast addresses.',
      'Allocating VLSM smallest-first and running out of contiguous space.',
      'Assigning the network or broadcast address to a device. It is a valid-looking answer that cannot work.',
    ],
    relatedTerms: ['subnet-mask', 'cidr', 'vlsm', 'broadcast-address'],
  },

  {
    id: 'routing-algorithms',
    unitId: 'unit-4',
    title: 'Routing Algorithms & Protocols',
    description: 'Distance vector, link state and path vector, and the protocols built on each.',
    order: 3,
    estimatedMinutes: 13,
    hook: 'No router knows the whole Internet. Each knows its neighbours. Somehow a packet still finds Tokyo.',
    overview:
      'Routing is how forwarding tables get built. The syllabus splits it into static versus dynamic, then into the three dynamic families, and expects both the mechanism and the failure mode of each. Distance vector\'s failure — count-to-infinity — is the most commonly asked, because the fixes for it are what separate understanding from memorisation.',
    keyPoints: [
      'Forwarding is the per-packet lookup. Routing is the background process that builds the table. Exams reward keeping them apart.',
      'Distance vector: tell your neighbours everything you know. Simple, slow to converge, prone to count-to-infinity. RIP, using hop count with a limit of 15.',
      'Link state: tell everyone about your neighbours. Every router floods its state, builds the full map, and runs Dijkstra locally. OSPF.',
      'Path vector: advertise the full path, so loops are visible and policy is possible. BGP, the protocol that holds the Internet together.',
      'Count-to-infinity is fought with split horizon, poison reverse, hold-down timers and a defined infinity.',
      'Interior gateway protocols run inside one autonomous system; exterior ones run between them. RIP and OSPF are interior, BGP exterior.',
      'Dijkstra needs non-negative link costs and produces the shortest-path tree from one source.',
      'Congestion at the network layer is handled by leaky bucket and token bucket shaping, choke packets, and load shedding when all else fails.',
    ],
    definitions: [
      { term: 'Autonomous system', meaning: 'A set of routers under one administration presenting a single routing policy.' },
      { term: 'Count-to-infinity', meaning: 'Routers incrementing each other\'s stale distances after a link fails.' },
      { term: 'Split horizon', meaning: 'Never advertising a route back out of the interface you learned it from.' },
      { term: 'Leaky bucket', meaning: 'Shaping traffic to a constant output rate, discarding overflow.' },
      { term: 'Token bucket', meaning: 'Like leaky bucket, but saving credit so a burst can be sent after quiet.' },
    ],
    examples: [
      'RIP calls 16 hops unreachable, so count-to-infinity terminates in seconds rather than never.',
      'Token bucket allows a burst; leaky bucket never does. That single difference is a standard two-mark question.',
    ],
    pitfalls: [
      'Saying OSPF "sends its routing table". It floods link states; each router computes its own table.',
      'Treating BGP as a shortest-path protocol. It is policy-driven, and the shortest AS path often loses to a business relationship.',
      'Mixing up leaky and token bucket. Only one permits bursts.',
    ],
    relatedTerms: ['rip', 'ospf', 'bgp', 'router', 'dijkstra'],
  },

  // ---------------------------------------------------------------- Unit 5

  {
    id: 'transport-tcp',
    unitId: 'unit-5',
    title: 'TCP — Reliable Transport',
    description: 'Connection management, reliability, flow control and the state machine behind them.',
    order: 1,
    estimatedMinutes: 13,
    hook: 'IP loses packets, duplicates them and delivers them out of order. TCP promises the opposite, over exactly that.',
    overview:
      'TCP provides a reliable, ordered, connection-oriented byte stream on top of a network that guarantees none of those things. It does it with sequence numbers, cumulative acknowledgements, retransmission timers and a sliding window. The syllabus wants the three-way handshake, the four-way close and the reason it is four rather than three — and that reason is the half-close.',
    keyPoints: [
      'Process-to-process delivery is achieved by port numbers; the socket is the IP and port pair that identifies one endpoint.',
      'Three-way handshake: SYN, SYN-ACK, ACK. Both sides exchange and confirm initial sequence numbers before any data.',
      'Connection release takes four segments because each direction closes independently. One side can finish sending while still receiving.',
      'Sequence numbers count bytes, not segments. This is why TCP can retransmit a different-sized segment covering the same data.',
      'Acknowledgements are cumulative: ACK n means everything before n arrived. Selective acknowledgement is an extension, not the default.',
      'Flow control is receiver-driven through the advertised window, and is completely separate from congestion control, which is network-driven.',
      'A zero window stops the sender; the persist timer probes so a lost window update cannot deadlock the connection.',
      'Retransmission timeout is derived from measured RTT with Jacobson\'s algorithm, because a fixed timer is wrong on every link.',
    ],
    definitions: [
      { term: 'Socket', meaning: 'An endpoint identified by an IP address and port number.' },
      { term: 'Three-way handshake', meaning: 'SYN, SYN-ACK, ACK. Synchronises sequence numbers in both directions.' },
      { term: 'Advertised window', meaning: 'Free buffer space the receiver announces, capping what the sender may have outstanding.' },
      { term: 'TIME_WAIT', meaning: 'The wait after closing, long enough for stray duplicates to expire.' },
    ],
    examples: [
      'Loading a web page opens a TCP connection before a single byte of HTML moves. On a distant server the handshake alone costs a visible fraction of a second.',
    ],
    pitfalls: [
      'Confusing flow control with congestion control. One protects the receiver, the other the network. Both exist because they fail differently.',
      'Saying the handshake "exchanges data". It exchanges sequence numbers; data comes after.',
      'Claiming connection release is three-way. It is four, because each direction is closed separately.',
    ],
    relatedTerms: ['tcp', 'three-way-handshake', 'socket', 'port'],
  },

  {
    id: 'transport-udp',
    unitId: 'unit-5',
    title: 'UDP, Ports & Quality of Service',
    description: 'The minimal transport protocol, port numbering, and what QoS actually guarantees.',
    order: 2,
    estimatedMinutes: 8,
    hook: 'A late video frame is worthless. Retransmitting it is worse than dropping it. Sometimes reliability is the wrong answer.',
    overview:
      'UDP adds almost nothing to IP: ports, a length and an optional checksum, in an eight-byte header. That minimalism is the point. Applications that value latency over completeness, or that implement their own recovery, would rather not pay for TCP\'s machinery. Quality of service sits here too, because when the network cannot promise delivery, the application\'s requirements have to be stated somewhere.',
    keyPoints: [
      'UDP header is 8 bytes: source port, destination port, length, checksum. TCP\'s is 20 minimum.',
      'No handshake, no acknowledgements, no ordering, no congestion control. Fire and forget.',
      'Port ranges: well-known 0-1023, registered 1024-49151, dynamic 49152-65535.',
      'Well-known ports worth memorising: 20/21 FTP, 22 SSH, 23 Telnet, 25 SMTP, 53 DNS, 80 HTTP, 443 HTTPS.',
      'UDP suits DNS queries, DHCP, streaming, VoIP and online games — anything where a late answer is useless.',
      'QoS is described by four requirements: reliability, delay, jitter and bandwidth. Different applications weight them differently.',
      'Integrated Services reserves per-flow and does not scale; Differentiated Services marks packets into classes and does.',
    ],
    definitions: [
      { term: 'Port number', meaning: '16-bit identifier selecting which process on a host receives the data.' },
      { term: 'Connectionless', meaning: 'No setup before sending; each datagram stands alone.' },
      { term: 'QoS', meaning: 'Quality of Service. Treating traffic differently according to what it needs.' },
      { term: 'DiffServ', meaning: 'Marking packets into a small number of classes handled differently per hop.' },
    ],
    examples: [
      'DNS uses UDP for queries and switches to TCP when a response is too large — the classic "why both" question.',
      'A dropped frame in a video call is invisible. A retransmitted one arrives after the moment has passed and is worse than nothing.',
    ],
    pitfalls: [
      'Calling UDP "unreliable" as if it were broken. It is unreliable by design, and that is why it is fast.',
      'Saying UDP has no error checking. Its checksum is optional in IPv4 and mandatory in IPv6.',
      'Confusing IntServ with DiffServ. One reserves per flow, the other classifies per packet.',
    ],
    relatedTerms: ['udp', 'port', 'dns', 'socket'],
  },

  {
    id: 'congestion-control',
    unitId: 'unit-5',
    title: 'Congestion Control',
    description: 'How TCP finds the network\'s capacity without being told, and backs off when it is wrong.',
    order: 3,
    estimatedMinutes: 10,
    hook: 'Nobody tells a sender how fast the Internet is today. It has to guess, and the only feedback is packets going missing.',
    overview:
      'Congestion is demand exceeding capacity at a router, and the collapse it causes is self-reinforcing: dropped packets are retransmitted, adding load. TCP treats loss as the congestion signal and manages a congestion window alongside the receiver\'s advertised window, sending the smaller of the two. The syllabus expects the phases by name and the arithmetic of what happens on loss.',
    keyPoints: [
      'Sender rate is min(congestion window, advertised window). Flow control and congestion control are enforced together, computed separately.',
      'Slow start is not slow: cwnd doubles every RTT, which is exponential growth until the threshold.',
      'At the threshold, congestion avoidance takes over and cwnd grows by one MSS per RTT — additive increase.',
      'Timeout means severe congestion: threshold halves, cwnd resets to 1, slow start begins again.',
      'Three duplicate ACKs mean a packet was lost but later ones arrived, so the path still works. Fast retransmit resends immediately and fast recovery halves cwnd rather than resetting it.',
      'The overall pattern is AIMD: additive increase, multiplicative decrease. It converges to fairness between competing flows, which is why it survived.',
      'Congestion collapse is the failure mode where throughput falls as offered load rises, because most traffic is retransmission.',
    ],
    definitions: [
      { term: 'Congestion window', meaning: 'The sender\'s own estimate of what the network will currently accept.' },
      { term: 'Slow start', meaning: 'Exponential growth of cwnd from one MSS until the threshold is reached.' },
      { term: 'AIMD', meaning: 'Additive Increase, Multiplicative Decrease. Grow cautiously, retreat sharply.' },
      { term: 'Fast recovery', meaning: 'Halving cwnd after duplicate ACKs instead of restarting from one.' },
    ],
    examples: [
      'cwnd 1 → 2 → 4 → 8 → 16 while slow starting. Hit the threshold at 16 and it becomes 17, 18, 19 — the sawtooth every textbook graphs.',
    ],
    pitfalls: [
      'Saying slow start is slow. It is the fastest-growing phase; only its starting point is small.',
      'Treating timeout and three duplicate ACKs identically. One resets to 1, the other halves — that difference is the marks.',
      'Confusing the congestion window with the advertised window. The receiver sets one, the sender infers the other.',
    ],
    relatedTerms: ['congestion-control', 'slow-start', 'aimd', 'tcp'],
  },

  // ---------------------------------------------------------------- Unit 6

  {
    id: 'dns',
    unitId: 'unit-6',
    title: 'DNS — The Internet Directory',
    description: 'Hierarchical name resolution, record types, caching, and why it is a database not a server.',
    order: 1,
    estimatedMinutes: 10,
    hook: 'Every site you visit begins with a question you never typed: what number is this name?',
    overview:
      'DNS is a distributed, hierarchical database that maps names to addresses. No single machine holds it, and no single organisation could — which is the point. Authority is delegated down the tree from the root, and caching everywhere keeps the root from being asked billions of times a day. The syllabus wants the resolution walk, the record types, and the role of TTL.',
    keyPoints: [
      'The namespace is a tree: root, top-level domains, second-level, subdomains. It is read right to left.',
      'A recursive query asks the resolver to do all the work and return a final answer; an iterative query returns a referral to ask next.',
      'Resolution order: local cache, then resolver, then root, then TLD server, then authoritative server.',
      'Record types: A (IPv4), AAAA (IPv6), CNAME (alias), MX (mail), NS (delegation), PTR (reverse lookup).',
      'TTL controls how long an answer may be cached. Short TTL means agility; long TTL means fewer queries.',
      'DNS uses UDP port 53 for queries and TCP for zone transfers and oversized responses.',
      'A zone is the part of the tree one server is authoritative for, which is not the same as a domain.',
    ],
    definitions: [
      { term: 'Resolver', meaning: 'The client-side component that performs lookups on an application\'s behalf.' },
      { term: 'Authoritative server', meaning: 'The server holding the original records for a zone, not a cached copy.' },
      { term: 'TTL', meaning: 'Time To Live. How long a cached record stays valid.' },
      { term: 'Zone', meaning: 'The portion of the namespace one server is responsible for.' },
    ],
    examples: [
      'Resolving www.example.com: cache, then root (asks .com), then .com (asks example.com), then example.com answers.',
      'Lowering a record\'s TTL a day before migrating a server is standard practice, precisely because caching would otherwise outlast the move.',
    ],
    pitfalls: [
      'Saying DNS "is a server". It is a distributed database; servers are how it is served.',
      'Forgetting DNS uses TCP as well as UDP. Zone transfers and large responses need it.',
      'Mixing up a zone and a domain. A domain can be split across several zones.',
    ],
    relatedTerms: ['dns', 'udp', 'ttl'],
  },

  {
    id: 'http-web',
    unitId: 'unit-6',
    title: 'HTTP, Email & File Transfer',
    description: 'The application protocols the syllabus names: HTTP, SMTP, POP3, IMAP, FTP and Telnet.',
    order: 2,
    estimatedMinutes: 11,
    hook: 'Every application protocol here is a conversation in plain text that someone eventually had to encrypt.',
    overview:
      'The application layer is where protocols stop moving bytes and start meaning something. HTTP fetches resources, SMTP pushes mail outward, POP3 and IMAP pull it down, FTP moves files on two connections, and Telnet gave remote access before anyone worried about who was listening. What they share is a request-response text structure and a well-known port.',
    keyPoints: [
      'HTTP is stateless and request-response. Methods: GET, POST, PUT, DELETE, HEAD.',
      'Status classes: 1xx informational, 2xx success, 3xx redirect, 4xx client error, 5xx server error.',
      'Statelessness is worked around with cookies and sessions, because the protocol itself remembers nothing between requests.',
      'HTTPS is HTTP inside TLS on port 443. It provides confidentiality, integrity and server authentication.',
      'SMTP (25) pushes mail between servers. POP3 (110) downloads and typically deletes; IMAP (143) keeps mail on the server and syncs state.',
      'FTP uses two connections: control on 21 for commands, data on 20 for transfer. Active and passive mode differ in who opens the data connection.',
      'Telnet (23) sends everything including passwords in clear text; SSH (22) replaced it for that exact reason.',
      'The application layer also covers network management via SNMP and data compression, which reduces what has to travel at all.',
    ],
    definitions: [
      { term: 'Stateless protocol', meaning: 'Each request is independent; the server keeps no memory of previous ones.' },
      { term: 'Cookie', meaning: 'A small value the server stores in the client and receives back, faking continuity.' },
      { term: 'User agent', meaning: 'The client making the request, usually a browser.' },
      { term: 'MIME', meaning: 'The encoding that lets mail carry attachments and non-ASCII text.' },
    ],
    examples: [
      '404 is the client asking for something absent; 500 is the server failing at something it accepted. Blaming the wrong side is a classic lost mark.',
      'FTP passive mode exists because firewalls block the server opening a connection back to the client.',
    ],
    pitfalls: [
      'Saying HTTPS is "a different protocol". It is HTTP over TLS; the requests are identical.',
      'Confusing POP3 and IMAP. One takes mail away, the other leaves it and synchronises.',
      'Forgetting FTP uses two ports. It is the standard reason it is awkward through firewalls.',
    ],
    relatedTerms: ['http', 'https', 'tls', 'port'],
  },

  {
    id: 'network-security',
    unitId: 'unit-6',
    title: 'Network Security & Cryptography',
    description: 'The security goals, symmetric and asymmetric cryptography, digital signatures and defences.',
    order: 3,
    estimatedMinutes: 12,
    hook: 'Every protocol in this syllabus was designed for a network where everyone was trusted. None of them are used in one.',
    overview:
      'Security is stated as goals first — confidentiality, integrity, availability, authentication and non-repudiation — because attacks are best understood as goals being violated. Cryptography supplies the mechanisms: symmetric ciphers for speed, asymmetric for key exchange and signatures, hashes for integrity. The syllabus keeps this at basic-concepts level, so the marks are in knowing which tool serves which goal.',
    keyPoints: [
      'The CIA triad plus authentication and non-repudiation. Each attack maps to whichever one it breaks.',
      'Symmetric encryption (DES, AES) uses one shared key. Fast, but distributing the key securely is the whole problem.',
      'Asymmetric encryption (RSA) uses a public and a private key. Slow, so it is used to exchange a symmetric key rather than bulk data.',
      'Encrypt with the recipient\'s public key for confidentiality; encrypt with your own private key for a signature. Same maths, opposite direction, opposite purpose.',
      'A hash (MD5, SHA) is one-way and fixed-length, giving integrity but not confidentiality.',
      'A digital signature is a hash encrypted with the sender\'s private key, providing authentication, integrity and non-repudiation together.',
      'A digital certificate binds a public key to an identity, vouched for by a certificate authority — which is what stops a man-in-the-middle supplying their own key.',
      'Defences: firewalls filter by rule, IDS detects, VPNs tunnel encrypted traffic across untrusted networks.',
      'Attacks worth naming: DoS and DDoS, man-in-the-middle, replay, spoofing, phishing.',
    ],
    definitions: [
      { term: 'Confidentiality', meaning: 'Only the intended recipient can read it.' },
      { term: 'Integrity', meaning: 'It arrived unaltered, and alteration would be detectable.' },
      { term: 'Non-repudiation', meaning: 'The sender cannot later deny having sent it.' },
      { term: 'Digital signature', meaning: 'A hash encrypted with the sender\'s private key.' },
      { term: 'VPN', meaning: 'An encrypted tunnel making a public path behave like a private one.' },
    ],
    examples: [
      'HTTPS uses both: RSA to agree a session key, AES to encrypt the traffic. Asymmetric for setup, symmetric for volume.',
      'A DDoS attacks availability alone. Nothing is read or altered, and the service is still down.',
    ],
    pitfalls: [
      'Saying asymmetric encryption is "more secure". It is differently useful, and too slow for bulk data.',
      'Claiming hashing is encryption. There is no key and no way back.',
      'Treating a firewall as complete security. It filters traffic; it does not authenticate users or encrypt anything.',
    ],
    relatedTerms: ['firewall', 'encryption', 'vpn', 'ddos'],
  },
];

/** Notes plus their in-depth sections, with reading time adjusted for the extra text. */
export const TOPICS: readonly Topic[] = BASE_TOPICS.map((topic) => {
  const sections = TOPIC_SECTIONS[topic.id];
  if (!sections?.length) return topic;
  const words = sections.reduce((sum, section) => sum + section.body.split(/\s+/).length, 0);
  return {
    ...topic,
    sections: [...sections],
    estimatedMinutes: topic.estimatedMinutes + Math.round(words / WORDS_PER_MINUTE),
  };
});
