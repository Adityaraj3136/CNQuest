/**
 * Topics with revision notes.
 *
 * SEED DATA — generated for development and demonstration, not university-approved content.
 * Notes are deliberately short and revision-oriented; CN Quest supplements a textbook.
 */

import type { Topic } from '../models/content.ts';

export const TOPICS: readonly Topic[] = [
  // ---------------- Unit 1 ----------------
  {
    id: 'network-basics',
    unitId: 'unit-1',
    title: 'Introduction to Computer Networks',
    description: 'Why networks exist, their goals, and how they are classified by scale.',
    order: 1,
    estimatedMinutes: 8,
    overview:
      'A computer network is a set of autonomous devices connected by a transmission medium so they can exchange data. Networks are judged on performance (throughput and delay), reliability, and security. Scale is the most common way to classify them, from a personal area network on a desk to the global Internet.',
    keyPoints: [
      'Networks exist for resource sharing, communication, reliability through redundancy, and cost saving.',
      'Classified by scale: PAN, LAN, MAN and WAN.',
      'Performance is measured mainly by bandwidth, throughput, latency and jitter.',
      'Bandwidth is the capacity of a link; throughput is what you actually achieve on it.',
      'A protocol is an agreed set of rules covering syntax, semantics and timing.',
    ],
    definitions: [
      { term: 'LAN', meaning: 'Local Area Network — one building or campus, privately owned, high speed.' },
      { term: 'WAN', meaning: 'Wide Area Network — spans cities or countries, often uses leased lines.' },
      { term: 'Bandwidth', meaning: 'Maximum data rate a channel can carry, measured in bits per second.' },
      { term: 'Latency', meaning: 'Total time for one bit to travel from sender to receiver.' },
      { term: 'Jitter', meaning: 'Variation in packet delay — the enemy of voice and video calls.' },
    ],
    examples: [
      'A college computer lab connected by switches is a LAN.',
      'A bank linking branches across several states runs a WAN.',
    ],
    relatedTerms: ['lan', 'wan', 'bandwidth', 'latency', 'protocol'],
  },
  {
    id: 'network-topologies',
    unitId: 'unit-1',
    title: 'Network Topologies',
    description: 'Bus, star, ring, mesh and hybrid layouts, with their trade-offs.',
    order: 2,
    estimatedMinutes: 7,
    overview:
      'Topology describes how devices are arranged and interconnected. Physical topology is the actual cabling; logical topology is the path data takes, and the two need not match. Modern wired LANs are almost always physically star-wired to a central switch.',
    keyPoints: [
      'Bus: one shared backbone. Cheap, but a break in the cable kills the whole segment.',
      'Star: every node connects to a central hub or switch. A node failure is isolated; the centre is a single point of failure.',
      'Ring: each node connects to exactly two neighbours; data circulates in one direction.',
      'Mesh: every node links to every other. A full mesh of n nodes needs n(n-1)/2 links.',
      'Hybrid topologies combine these — for example, a star of rings.',
    ],
    definitions: [
      { term: 'Full mesh', meaning: 'Every device has a dedicated link to every other device.' },
      { term: 'Single point of failure', meaning: 'One component whose failure stops the entire network.' },
      { term: 'Physical topology', meaning: 'The actual layout of cables and devices.' },
      { term: 'Logical topology', meaning: 'The route data follows, regardless of the cabling.' },
    ],
    examples: ['A full mesh of 6 routers needs 6 × 5 / 2 = 15 links.'],
    relatedTerms: ['topology', 'switch', 'hub'],
  },
  {
    id: 'osi-model',
    unitId: 'unit-1',
    title: 'OSI Model',
    description: 'The seven-layer reference model and what each layer is responsible for.',
    order: 3,
    estimatedMinutes: 12,
    overview:
      'The OSI (Open Systems Interconnection) model is a seven-layer conceptual framework from ISO. Each layer serves the one above it and is served by the one below. It is a teaching and troubleshooting reference — real stacks follow TCP/IP — but layer names and numbers are examined constantly.',
    keyPoints: [
      'Layer 7 Application — network services directly to the user (HTTP, FTP, SMTP).',
      'Layer 6 Presentation — translation, encryption and compression.',
      'Layer 5 Session — establishes, manages and terminates sessions; synchronisation points.',
      'Layer 4 Transport — end-to-end delivery, segmentation, flow and error control (TCP, UDP).',
      'Layer 3 Network — logical addressing and routing between networks (IP, routers).',
      'Layer 2 Data Link — framing, MAC addressing, error detection on one link (switches).',
      'Layer 1 Physical — bits as signals over the medium (cables, hubs, repeaters).',
      'Mnemonic, top down: All People Seem To Need Data Processing.',
    ],
    definitions: [
      { term: 'Encapsulation', meaning: 'Each layer adds its own header as data moves down the stack.' },
      { term: 'PDU', meaning: 'Protocol Data Unit — segment (L4), packet (L3), frame (L2), bit (L1).' },
      { term: 'Peer-to-peer process', meaning: 'Layer n on one host communicates logically with layer n on the other.' },
    ],
    examples: [
      'A router is a Layer 3 device; a switch is Layer 2; a hub is Layer 1.',
      'Encryption belongs to the Presentation layer in OSI terms.',
    ],
    relatedTerms: ['osi-model', 'encapsulation', 'router', 'switch'],
  },
  {
    id: 'tcp-ip-model',
    unitId: 'unit-1',
    title: 'TCP/IP Model',
    description: 'The four-layer model the Internet actually runs on, and how it maps to OSI.',
    order: 4,
    estimatedMinutes: 8,
    overview:
      'The TCP/IP suite predates OSI and is what the Internet implements. It has four layers: Application, Transport, Internet and Network Access. Its Application layer covers OSI layers 5-7, and its Network Access layer covers OSI layers 1-2.',
    keyPoints: [
      'Four layers: Application, Transport, Internet, Network Access (Link).',
      'TCP/IP Application = OSI Application + Presentation + Session.',
      'TCP/IP Network Access = OSI Data Link + Physical.',
      'The Internet layer is IP; it is connectionless and best-effort.',
      'OSI was designed before its protocols; TCP/IP protocols came before the model.',
    ],
    definitions: [
      { term: 'Best-effort delivery', meaning: 'No guarantee of delivery, order or duplicate protection.' },
      { term: 'Protocol suite', meaning: 'A layered family of protocols designed to work together.' },
    ],
    examples: ['HTTP, TCP, IP and Ethernet together form one TCP/IP stack in action.'],
    relatedTerms: ['tcp-ip', 'ip', 'protocol'],
  },

  // ---------------- Unit 2 ----------------
  {
    id: 'transmission-media',
    unitId: 'unit-2',
    title: 'Transmission Media',
    description: 'Guided and unguided media, and how to choose between them.',
    order: 1,
    estimatedMinutes: 9,
    overview:
      'Transmission media carry the signal. Guided media confine the signal to a physical path (twisted pair, coaxial, fibre); unguided media broadcast through free space (radio, microwave, infrared). Fibre offers the highest bandwidth and immunity to electromagnetic interference.',
    keyPoints: [
      'Twisted pair: cheap and common; twisting reduces crosstalk. UTP Cat 6 is standard for LANs.',
      'Coaxial cable: better shielding than twisted pair, used for cable TV and older Ethernet.',
      'Optical fibre: carries light; huge bandwidth, very low attenuation, immune to EMI.',
      'Single-mode fibre has a narrow core for long distances; multimode is cheaper and shorter-range.',
      'Unguided media suffer interference and are inherently easier to eavesdrop on.',
    ],
    definitions: [
      { term: 'Attenuation', meaning: 'Loss of signal strength with distance.' },
      { term: 'Crosstalk', meaning: 'Signal from one wire leaking into a neighbouring wire.' },
      { term: 'EMI', meaning: 'Electromagnetic interference from motors, lights and other cables.' },
    ],
    examples: ['Submarine intercontinental links use single-mode optical fibre.'],
    relatedTerms: ['fibre-optic', 'twisted-pair', 'attenuation'],
  },
  {
    id: 'switching-multiplexing',
    unitId: 'unit-2',
    title: 'Switching & Multiplexing',
    description: 'Circuit, packet and message switching, plus FDM, TDM and WDM.',
    order: 2,
    estimatedMinutes: 10,
    overview:
      'Switching decides how data crosses an intermediate network. Circuit switching reserves a dedicated path for the whole call; packet switching splits data into packets routed independently. Multiplexing lets several signals share one link.',
    keyPoints: [
      'Circuit switching: dedicated path, fixed bandwidth, setup delay, wasteful when idle (classic telephony).',
      'Packet switching: no reservation, efficient sharing, variable delay (the Internet).',
      'Datagram packet switching routes each packet independently; virtual circuits fix a path first.',
      'FDM divides the link by frequency; TDM divides it by time slots.',
      'WDM is FDM applied to light in optical fibre.',
      'Statistical TDM allocates slots only to senders that actually have data.',
    ],
    definitions: [
      { term: 'Multiplexing', meaning: 'Combining several signals onto one shared medium.' },
      { term: 'Virtual circuit', meaning: 'A pre-established path that all packets of a connection follow.' },
      { term: 'Store and forward', meaning: 'A switch receives a whole packet before forwarding it.' },
    ],
    examples: ['A traditional landline call is circuit switched; a video call over the Internet is packet switched.'],
    relatedTerms: ['packet-switching', 'multiplexing', 'tdm'],
  },

  // ---------------- Unit 3 ----------------
  {
    id: 'data-link-error-control',
    unitId: 'unit-3',
    title: 'Framing & Error Control',
    description: 'Framing, parity, checksums, CRC and the ARQ protocols.',
    order: 1,
    estimatedMinutes: 12,
    overview:
      'The data link layer groups bits into frames and protects them against transmission errors. Error detection codes reveal that something changed; error correction codes can rebuild the original. Automatic Repeat reQuest (ARQ) schemes recover by retransmitting.',
    keyPoints: [
      'Single-bit parity detects any odd number of bit errors, never corrects.',
      'Two-dimensional parity detects most burst errors and can correct a single-bit error.',
      'CRC treats the frame as a polynomial and divides by a generator; it is the standard in Ethernet.',
      'Checksums add data in blocks and send the one’s complement of the sum (used by IP, TCP, UDP).',
      'Hamming code adds redundant bits so the receiver can locate and correct a single-bit error.',
      'ARQ variants: Stop-and-Wait, Go-Back-N and Selective Repeat.',
      'Go-Back-N retransmits from the lost frame onward; Selective Repeat retransmits only the lost frame.',
    ],
    definitions: [
      { term: 'Frame', meaning: 'The data link layer PDU — a packet plus a header and trailer.' },
      { term: 'CRC', meaning: 'Cyclic Redundancy Check — polynomial-division error detection.' },
      { term: 'ARQ', meaning: 'Automatic Repeat reQuest — recovering from errors by retransmission.' },
      { term: 'Piggybacking', meaning: 'Carrying an acknowledgement inside an outgoing data frame.' },
    ],
    examples: [
      'Ethernet frames end with a 32-bit CRC in the Frame Check Sequence field.',
      'With window size N, Go-Back-N needs a sequence-number space of at least N + 1.',
    ],
    relatedTerms: ['crc', 'frame', 'arq', 'hamming-code'],
  },
  {
    id: 'mac-ethernet',
    unitId: 'unit-3',
    title: 'MAC & Ethernet',
    description: 'Medium access control, CSMA/CD, CSMA/CA, MAC addresses and switching.',
    order: 2,
    estimatedMinutes: 11,
    overview:
      'When several stations share a medium, a medium access control method decides who transmits. Ethernet historically used CSMA/CD on a shared bus; Wi-Fi uses CSMA/CA because collisions cannot be detected reliably on radio. Modern switched Ethernet is full duplex, so collisions no longer occur.',
    keyPoints: [
      'A MAC address is 48 bits, written as 12 hexadecimal digits, and is burned into the NIC.',
      'The first 24 bits are the OUI, identifying the manufacturer.',
      'FF:FF:FF:FF:FF:FF is the broadcast MAC address.',
      'CSMA/CD: listen, transmit, detect collision, jam, back off exponentially, retry.',
      'CSMA/CA avoids collisions with RTS/CTS and random backoff before transmitting.',
      'A switch learns MAC addresses into a table and forwards frames only out of the correct port.',
      'Each switch port is its own collision domain; a VLAN or router bounds a broadcast domain.',
    ],
    definitions: [
      { term: 'MAC address', meaning: 'A 48-bit physical address identifying a network interface.' },
      { term: 'Collision domain', meaning: 'A network segment where simultaneous transmissions collide.' },
      { term: 'Broadcast domain', meaning: 'The set of devices reached by a broadcast frame.' },
      { term: 'CSMA/CD', meaning: 'Carrier Sense Multiple Access with Collision Detection.' },
    ],
    examples: ['00:1A:2B:3C:4D:5E is a MAC address; its first three octets identify the vendor.'],
    relatedTerms: ['mac-address', 'ethernet', 'switch', 'csma-cd'],
  },

  // ---------------- Unit 4 ----------------
  {
    id: 'ipv4-addressing',
    unitId: 'unit-4',
    title: 'IPv4 & IPv6 Addressing',
    description: 'Address classes, private ranges, NAT and the move to IPv6.',
    order: 1,
    estimatedMinutes: 12,
    overview:
      'An IPv4 address is 32 bits, written as four dotted decimal octets. Classful addressing (A-E) has been replaced by CIDR, which uses an explicit prefix length. IPv6 raises the address to 128 bits and removes the need for NAT.',
    keyPoints: [
      'IPv4 is 32 bits; IPv6 is 128 bits written as eight groups of four hex digits.',
      'Class A 1-126, Class B 128-191, Class C 192-223, Class D 224-239 (multicast), Class E 240-255.',
      '127.0.0.0/8 is loopback; 127.0.0.1 is localhost.',
      'Private ranges: 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16.',
      '169.254.0.0/16 is APIPA — self-assigned when DHCP fails.',
      'NAT maps many private addresses onto one public address, conserving IPv4 space.',
      'IPv6 has no broadcast; it uses multicast and anycast instead.',
    ],
    definitions: [
      { term: 'CIDR', meaning: 'Classless Inter-Domain Routing — addresses written as a.b.c.d/prefix.' },
      { term: 'NAT', meaning: 'Network Address Translation between private and public addresses.' },
      { term: 'Loopback', meaning: 'An address that sends traffic back to the same host.' },
    ],
    examples: ['192.168.1.10/24 is a private Class C style address with a 24-bit network prefix.'],
    relatedTerms: ['ipv4', 'ipv6', 'nat', 'cidr'],
  },
  {
    id: 'subnetting',
    unitId: 'unit-4',
    title: 'Subnetting',
    description: 'Splitting a network with masks, and counting hosts and subnets.',
    order: 2,
    estimatedMinutes: 15,
    overview:
      'Subnetting borrows bits from the host portion of an address to create smaller networks. It reduces broadcast traffic, improves security boundaries and uses address space efficiently. Every subnet loses two addresses: the network address and the broadcast address.',
    keyPoints: [
      'Usable hosts per subnet = 2^h - 2, where h is the number of host bits.',
      'Number of subnets created by borrowing b bits = 2^b.',
      'A /24 mask is 255.255.255.0 and gives 254 usable hosts.',
      'A /26 gives 4 subnets of 62 usable hosts each; the block size is 64.',
      'The network address has all host bits 0; the broadcast address has all host bits 1.',
      'A /30 gives 2 usable hosts — the standard for point-to-point router links.',
      'VLSM lets subnets of different sizes coexist inside one address block.',
    ],
    definitions: [
      { term: 'Subnet mask', meaning: 'A 32-bit value marking which bits are network and which are host.' },
      { term: 'Block size', meaning: '256 minus the interesting octet of the mask — the subnet increment.' },
      { term: 'VLSM', meaning: 'Variable Length Subnet Masking — different prefix lengths in one network.' },
    ],
    examples: [
      '192.168.1.0/26 → subnets .0, .64, .128, .192; the .64 subnet spans .65-.126 with broadcast .127.',
      'A /28 has 4 host bits, so 2^4 - 2 = 14 usable hosts.',
    ],
    relatedTerms: ['subnet-mask', 'cidr', 'vlsm', 'broadcast-address'],
  },
  {
    id: 'routing-algorithms',
    unitId: 'unit-4',
    title: 'Routing Algorithms & Protocols',
    description: 'Distance vector versus link state, and RIP, OSPF and BGP.',
    order: 3,
    estimatedMinutes: 13,
    overview:
      'Routing determines the path a packet takes between networks. Distance-vector protocols share their whole table with neighbours; link-state protocols flood link information and each router computes the full topology itself. BGP is the path-vector protocol that glues the Internet together.',
    keyPoints: [
      'Distance vector (RIP) uses the Bellman-Ford algorithm and hop count as its metric.',
      'RIP has a maximum of 15 hops; 16 means unreachable — this bounds the count-to-infinity problem.',
      'Link state (OSPF) uses Dijkstra’s shortest path first over a full topology map.',
      'OSPF’s metric is cost, derived from bandwidth, and it converges faster than RIP.',
      'BGP is a path-vector protocol used between autonomous systems.',
      'Split horizon, route poisoning and hold-down timers fight routing loops.',
      'Static routes are manually configured; dynamic routes adapt to topology changes.',
    ],
    definitions: [
      { term: 'Metric', meaning: 'The cost value a protocol uses to compare routes.' },
      { term: 'Convergence', meaning: 'The time for all routers to agree on the topology after a change.' },
      { term: 'Autonomous System', meaning: 'A network under one administrative routing policy.' },
      { term: 'Default route', meaning: '0.0.0.0/0 — used when no more specific route matches.' },
    ],
    examples: ['A router prefers the longest matching prefix, so /28 wins over /24 for the same destination.'],
    relatedTerms: ['rip', 'ospf', 'bgp', 'router', 'dijkstra'],
  },

  // ---------------- Unit 5 ----------------
  {
    id: 'transport-tcp',
    unitId: 'unit-5',
    title: 'TCP — Reliable Transport',
    description: 'The three-way handshake, sequence numbers, flow control and teardown.',
    order: 1,
    estimatedMinutes: 13,
    overview:
      'TCP provides a connection-oriented, reliable, ordered byte stream. It numbers every byte, acknowledges what it receives, retransmits what is lost, and uses a sliding window advertised by the receiver to avoid overwhelming it.',
    keyPoints: [
      'Connection setup is a three-way handshake: SYN, SYN-ACK, ACK.',
      'Teardown normally takes four segments: FIN, ACK, FIN, ACK.',
      'Sequence numbers count bytes, not segments.',
      'Flow control uses the receiver-advertised window (rwnd) — it protects the receiver.',
      'Congestion control protects the network; flow control protects the receiver.',
      'TCP header is 20 bytes without options; UDP’s is 8 bytes.',
      'A socket is an IP address and port pair; a TCP connection is identified by four values.',
    ],
    definitions: [
      { term: 'Three-way handshake', meaning: 'SYN → SYN-ACK → ACK, establishing a TCP connection.' },
      { term: 'Sliding window', meaning: 'The set of bytes a sender may transmit without acknowledgement.' },
      { term: 'MSS', meaning: 'Maximum Segment Size — the largest payload a TCP segment may carry.' },
    ],
    examples: ['Loading a web page opens a TCP connection to port 80 or 443 before any HTTP is sent.'],
    relatedTerms: ['tcp', 'three-way-handshake', 'socket', 'port'],
  },
  {
    id: 'transport-udp',
    unitId: 'unit-5',
    title: 'UDP & Ports',
    description: 'Connectionless transport, the 8-byte header, and well-known port numbers.',
    order: 2,
    estimatedMinutes: 8,
    overview:
      'UDP is a thin wrapper over IP: connectionless, unreliable and unordered, with no congestion control. That minimalism makes it fast and ideal for real-time media, DNS lookups and broadcasts where a late packet is worse than a lost one.',
    keyPoints: [
      'The UDP header is 8 bytes: source port, destination port, length and checksum.',
      'No handshake, no acknowledgements, no retransmission, no ordering.',
      'Used by DNS, DHCP, TFTP, SNMP, and most voice and video streaming.',
      'Well-known ports run 0-1023; registered 1024-49151; dynamic 49152-65535.',
      'Key ports: FTP 20/21, SSH 22, Telnet 23, SMTP 25, DNS 53, DHCP 67/68, HTTP 80, POP3 110, IMAP 143, HTTPS 443.',
    ],
    definitions: [
      { term: 'Connectionless', meaning: 'Data is sent without establishing a session first.' },
      { term: 'Port number', meaning: 'A 16-bit value identifying an application endpoint on a host.' },
    ],
    examples: ['A DNS query fits in one UDP datagram to port 53, avoiding TCP setup cost.'],
    relatedTerms: ['udp', 'port', 'dns', 'socket'],
  },
  {
    id: 'congestion-control',
    unitId: 'unit-5',
    title: 'Congestion Control',
    description: 'Slow start, congestion avoidance, fast retransmit and AIMD.',
    order: 3,
    estimatedMinutes: 10,
    overview:
      'Congestion occurs when demand exceeds network capacity, causing queuing delay and loss. TCP infers congestion from loss and reacts by shrinking its congestion window, following an additive-increase, multiplicative-decrease pattern that keeps the network stable and roughly fair.',
    keyPoints: [
      'The sender is limited by min(congestion window, receiver window).',
      'Slow start grows cwnd exponentially — doubling each RTT until the threshold.',
      'Congestion avoidance then grows cwnd linearly, by about one MSS per RTT.',
      'Three duplicate ACKs trigger fast retransmit and fast recovery.',
      'A timeout is treated as severe congestion: cwnd drops to one MSS and slow start restarts.',
      'AIMD — additive increase, multiplicative decrease — is what makes TCP fair.',
      'Leaky bucket and token bucket are traffic-shaping algorithms; the token bucket permits bursts.',
    ],
    definitions: [
      { term: 'cwnd', meaning: 'Congestion window — the sender’s estimate of safe in-flight data.' },
      { term: 'RTT', meaning: 'Round Trip Time — send-to-acknowledgement delay.' },
      { term: 'Fast retransmit', meaning: 'Resending a segment after three duplicate ACKs, without waiting for a timeout.' },
    ],
    examples: ['With ssthresh = 8 MSS, cwnd goes 1, 2, 4, 8 in slow start, then rises linearly.'],
    relatedTerms: ['congestion-control', 'slow-start', 'aimd', 'tcp'],
  },

  // ---------------- Unit 6 ----------------
  {
    id: 'dns',
    unitId: 'unit-6',
    title: 'DNS',
    description: 'Name resolution, the hierarchy, record types and caching.',
    order: 1,
    estimatedMinutes: 10,
    overview:
      'DNS is a distributed hierarchical database that maps human-readable names to IP addresses. A resolver queries a root server, then the TLD server, then the authoritative server for the domain. Caching with a TTL keeps the load manageable.',
    keyPoints: [
      'DNS uses UDP port 53 for queries, and TCP port 53 for zone transfers and large responses.',
      'Hierarchy: root (.) → top-level domain (.com) → second level (example.com) → subdomain.',
      'Recursive resolution: the resolver does the work. Iterative: each server returns a referral.',
      'A record maps a name to IPv4; AAAA maps to IPv6.',
      'MX designates a mail server; CNAME is an alias; NS names the authoritative servers; PTR does reverse lookup.',
      'TTL controls how long a record may be cached.',
    ],
    definitions: [
      { term: 'FQDN', meaning: 'Fully Qualified Domain Name — the complete name including the TLD.' },
      { term: 'Authoritative server', meaning: 'The server that holds the original records for a zone.' },
      { term: 'TTL', meaning: 'Time To Live — how long a cached DNS record stays valid.' },
    ],
    examples: ['A browser resolving example.com asks its recursive resolver, which may answer from cache.'],
    relatedTerms: ['dns', 'udp', 'ttl'],
  },
  {
    id: 'http-web',
    unitId: 'unit-6',
    title: 'HTTP & The Web',
    description: 'Request methods, status codes, HTTPS, cookies and statelessness.',
    order: 2,
    estimatedMinutes: 11,
    overview:
      'HTTP is the stateless request-response protocol of the web, running over TCP port 80. HTTPS wraps it in TLS on port 443, providing confidentiality, integrity and server authentication. Because HTTP is stateless, cookies and sessions carry state between requests.',
    keyPoints: [
      'Methods: GET reads, POST creates, PUT replaces, PATCH partially updates, DELETE removes.',
      'GET should be safe and idempotent; POST is neither.',
      'Status classes: 1xx informational, 2xx success, 3xx redirect, 4xx client error, 5xx server error.',
      'Common codes: 200 OK, 301 Moved Permanently, 304 Not Modified, 400, 401, 403, 404, 500.',
      'HTTP/1.1 added persistent connections; HTTP/2 added multiplexing over one connection.',
      'HTTPS = HTTP over TLS on port 443, using certificates issued by a certificate authority.',
    ],
    definitions: [
      { term: 'Stateless', meaning: 'Each request is independent; the server keeps no memory of the last one.' },
      { term: 'Idempotent', meaning: 'Repeating the request has the same effect as making it once.' },
      { term: 'TLS', meaning: 'Transport Layer Security — the encryption layer beneath HTTPS.' },
    ],
    examples: ['401 means "not authenticated"; 403 means "authenticated but not allowed".'],
    relatedTerms: ['http', 'https', 'tls', 'port'],
  },
  {
    id: 'network-security',
    unitId: 'unit-6',
    title: 'Network Security Basics',
    description: 'The CIA triad, encryption, firewalls and common attacks.',
    order: 3,
    estimatedMinutes: 12,
    overview:
      'Network security aims to preserve confidentiality, integrity and availability. Symmetric encryption is fast and shares one key; asymmetric encryption uses a public/private key pair and solves key distribution. Firewalls filter traffic at the boundary, and IDS/IPS watch for attack patterns.',
    keyPoints: [
      'CIA triad: Confidentiality, Integrity, Availability.',
      'Symmetric (AES, DES) uses one shared key; asymmetric (RSA) uses a public and a private key.',
      'You encrypt with the recipient’s public key; only their private key can decrypt it.',
      'A digital signature is made with the sender’s private key and verified with their public key.',
      'Hashing (SHA-256) is one-way and gives integrity, not confidentiality.',
      'A stateful firewall tracks connections; a packet filter judges each packet alone.',
      'DoS/DDoS attacks availability; man-in-the-middle attacks confidentiality and integrity.',
      'A VPN builds an encrypted tunnel across an untrusted network.',
    ],
    definitions: [
      { term: 'CIA triad', meaning: 'Confidentiality, Integrity and Availability — the three security goals.' },
      { term: 'Firewall', meaning: 'A device or software filtering traffic against a rule set.' },
      { term: 'DMZ', meaning: 'A perimeter subnet exposing public servers while shielding the internal LAN.' },
      { term: 'IDS', meaning: 'Intrusion Detection System — alerts on suspicious traffic.' },
    ],
    examples: ['A SYN flood exhausts a server’s half-open connection table — an availability attack.'],
    relatedTerms: ['firewall', 'encryption', 'vpn', 'ddos'],
  },
];
