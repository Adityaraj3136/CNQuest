/**
 * "In depth" sections for every topic: the mechanisms, worked numericals and comparisons the
 * revision notes in topics.ts only state. Each section is a heading and one paragraph, which
 * is also how the admin editor stores them (one "Heading | Body" line per section).
 *
 * Kept apart from topics.ts so neither file grows past a comfortable size; topics.ts merges
 * them in. Keys are topic ids — content.test.ts fails the build if one does not exist.
 */

import type { TopicSection } from '../models/content.ts';

export const TOPIC_SECTIONS: Readonly<Record<string, readonly TopicSection[]>> = {
  // ---------------------------------------------------------------- Unit 1

  'network-basics': [
    {
      heading: 'The five components and three directions of data flow',
      body: "Every data communication system has five parts: the message, a sender, a receiver, the transmission medium and the protocol that both ends agree on. Remove any one and nothing is communicated. The direction of flow is classified three ways. Simplex is one-way only, like a keyboard feeding a computer or a TV broadcast. Half-duplex allows both directions but one at a time, like a walkie-talkie where you must release the button to listen. Full-duplex carries both directions at once, like a phone call or modern switched Ethernet, which uses separate wire pairs (or separate time and frequency) for each direction. Links are also either point-to-point, a dedicated link between two devices, or multipoint, where several devices share one link.",
    },
    {
      heading: 'Working out delay with numbers',
      body: "Transmission delay is the time to push all the bits onto the link: packet length divided by bandwidth. A 1,500-byte frame is 12,000 bits, so on a 10 Mbps link it takes 12,000 / 10,000,000 = 1.2 ms. Propagation delay is the time for one bit to cross the medium: distance divided by propagation speed. Over 2,000 km of fibre at about 2 × 10^8 m/s that is 10 ms. Doubling the bandwidth halves transmission delay but leaves propagation untouched, which is why a faster connection to a distant server still feels laggy. The bandwidth-delay product, bandwidth multiplied by propagation delay, tells you how many bits are in flight on the link at once: 10 Mbps × 10 ms = 100,000 bits.",
    },
    {
      heading: 'Client-server and peer-to-peer',
      body: "In the client-server model, an always-on server with a fixed, known address provides a service and many clients request it; web, email and DNS all work this way. It is easy to manage and secure, but the server is a bottleneck and a single point of failure, which is why large services spread one logical server across data centres. In peer-to-peer, every machine is both client and server and talks directly to others, as in BitTorrent. It scales naturally, because each new peer brings capacity as well as demand, but it is harder to manage, secure and keep consistent, since peers come and go and change addresses.",
    },
    {
      heading: 'Who writes the rules: standards bodies',
      body: "Protocols only work if every vendor implements them the same way, so standards matter. De facto standards win by adoption; de jure standards are ratified by an official body. ISO produced the OSI model. ITU-T standardises telecommunications. IEEE writes the 802 family for LANs and wireless: 802.3 is Ethernet and 802.11 is Wi-Fi. The IETF standardises the Internet's own protocols, publishing them as Requests for Comments (RFCs); TCP, IP, HTTP and DNS are all defined in RFCs. The Internet grew out of ARPANET, which began in 1969 and adopted TCP/IP in 1983.",
    },
  ],

  'network-topologies': [
    {
      heading: 'Counting cables and ports',
      body: "Topology questions are often numericals, and the counts follow from the shape. A full mesh of n devices needs n(n-1)/2 links and every device needs n-1 ports: 10 devices means 45 cables and 9 ports each. A star needs n links and n ports on the central device, but only one port per node. A bus needs one backbone cable plus a short drop line per device. A ring needs n links, with every device having exactly two connections. The mesh numbers grow with the square of n, which is the arithmetic reason full meshes are used only between a handful of critical routers.",
    },
    {
      heading: 'What happens when something breaks',
      body: "Fault isolation is where topologies really differ. In a star, a faulty cable affects one device and is easy to find, because every link runs back to one place; only the central device is critical. In a bus, a break or a missing terminator stops the whole segment, and signals reflect off an unterminated end, so both ends need terminators and faults are hard to locate. In a ring, one break interrupts circulation, which is why FDDI used a dual ring: when a link fails, the stations either side wrap traffic onto the second ring and the network keeps running. A mesh survives multiple link failures because there are always alternative paths.",
    },
    {
      heading: 'Physical and logical in real equipment',
      body: "The physical/logical split is not theoretical. Hub-based Ethernet was a physical star, since every cable ran to the hub, but a logical bus, because the hub repeated every signal to every port and all hosts shared one collision domain. Token Ring was wired as a physical star to a multistation access unit (MAU), but the MAU passed the token around a logical ring. Modern switched Ethernet is a star both physically and logically, because the switch delivers each frame only to its destination port. When an exam asks for the topology of a network, check whether it wants the cable layout or the data path.",
    },
    {
      heading: 'Choosing a topology in practice',
      body: "Real choices weigh cost, scalability, fault tolerance and ease of installation together. Adding a device to a star means one cable to the switch, while adding to a mesh means a cable to everyone. A tree topology is a hierarchy of stars, the usual campus design: an access switch per floor, distribution switches per building, and a core. Wireless has its own two shapes: infrastructure mode, where every device talks through an access point in a logical star, and ad hoc mode, where devices talk to each other directly. Data centres use spine-leaf designs, a partial mesh where every leaf switch connects to every spine switch, so any two servers are always exactly two hops apart.",
    },
  ],

  'osi-model': [
    {
      heading: 'Following one request down and back up',
      body: "When a browser sends a request, the application layer produces the HTTP message. The transport layer adds a header with source and destination port numbers, making a segment. The network layer adds source and destination IP addresses, making a packet. The data link layer adds source and destination MAC addresses plus a trailer with an error-check (FCS), making a frame, and the physical layer sends it as bits. At each router the frame is opened up to layer 3: the router reads the destination IP, chooses the next hop, and builds a new frame with new MAC addresses. The IP addresses stay the same end to end, while the MAC addresses change at every hop. That one fact answers a large share of layering questions.",
    },
    {
      heading: 'Four kinds of address, one per layer',
      body: "The layers address different things. The data link layer uses physical (MAC) addresses, which identify an interface on the local link only. The network layer uses logical (IP) addresses, which identify a host anywhere on the internetwork and are hierarchical so they can be routed. The transport layer uses port numbers, which identify the process on that host: port 80 for a web server, for example. The application layer has its own specific addresses, such as a URL or an email address, which DNS and other services turn into the lower-level ones. A full delivery needs all four: the right process, on the right host, reached through the right interface on each link.",
    },
    {
      heading: 'Session and presentation, the thin layers',
      body: "The session layer manages the dialogue: it establishes, maintains and ends sessions, and decides whether both sides may talk at once or must take turns. Its most examinable job is synchronisation. It inserts checkpoints into a long transfer, so a 100 MB file that fails at 90 MB can resume from the last checkpoint instead of starting again. The presentation layer deals with syntax: it translates between data representations (ASCII, EBCDIC, Unicode), and handles encryption and compression. In real stacks both layers are thin or absent. Their jobs are done inside applications or by TLS, which is one of the standard criticisms of the OSI model.",
    },
    {
      heading: 'Services, interfaces and protocols, and the criticism of OSI',
      body: "OSI's lasting contribution is separating three ideas. A service is what a layer does for the layer above. An interface is how that layer's services are accessed, through service access points. A protocol is the set of rules peers at the same layer use to talk to each other. Keeping them apart means a protocol can be replaced without changing the service. OSI is criticised on timing (its standards arrived after TCP/IP was deployed), on technology (session and presentation are nearly empty while data link and network are overloaded), and on implementation (early versions were large and slow). It survives as the reference vocabulary rather than as running software.",
    },
  ],

  'tcp-ip-model': [
    {
      heading: 'OSI and TCP/IP compared',
      body: "Both models are layered, both put end-to-end delivery in the transport layer, and both have a layer that routes between networks. The differences are what exams ask for. OSI was defined first as a model, and protocols were written to fit it; in TCP/IP the protocols came first and the model described them afterwards. OSI distinguishes service, interface and protocol explicitly, while TCP/IP blurs them. OSI's network layer supports both connection-oriented and connectionless communication but its transport layer is connection-oriented only. TCP/IP is the reverse: connectionless only at the internet layer (IP), but both kinds at transport (TCP and UDP). OSI has seven layers, TCP/IP four.",
    },
    {
      heading: 'Which protocol lives where',
      body: "The link layer holds Ethernet, Wi-Fi and PPP; ARP sits on the boundary, carried directly in frames to map IP addresses to MAC addresses. The internet layer holds IPv4 and IPv6, ICMP for errors and diagnostics, and IGMP for multicast group membership. The transport layer holds TCP, UDP and the newer SCTP. The application layer holds HTTP, DNS, SMTP, FTP, SSH and DHCP. Routing protocols show the model is a guide, not a rule: OSPF runs directly over IP, RIP runs over UDP, and BGP runs over TCP, yet all three do a network-layer job.",
    },
    {
      heading: 'How a packet finds its process: demultiplexing',
      body: "Each header carries a field telling the receiver which protocol comes next, so the stack can unwrap a packet without guessing. The Ethernet type field says what the payload is: 0x0800 for IPv4, 0x86DD for IPv6, 0x0806 for ARP. The IP protocol field does the same one layer up: 1 is ICMP, 6 is TCP, 17 is UDP. Finally the destination port picks the process: 53 hands the data to the DNS server, 443 to the HTTPS server. This chain of next-protocol fields is what makes the hourglass work. Any number of protocols can sit above or below IP, as long as each header names what is inside it.",
    },
    {
      heading: 'Why TCP/IP won',
      body: "TCP/IP rested on the end-to-end principle: keep the network core simple and put intelligence such as reliability, ordering and security at the edges, in the hosts. A simple best-effort IP could run over any link technology and let new applications appear without changing the routers. It also had working, free implementations early, most famously in Berkeley Unix (BSD), and an engineering culture of rough consensus and running code. OSI standards were late, large and expensive to implement. By the time they were ready, TCP/IP was already carrying real traffic, and networks that work are rarely replaced.",
    },
  ],

  // ---------------------------------------------------------------- Unit 2

  'transmission-media': [
    {
      heading: 'Twisted pair categories and why the twist matters',
      body: "A twisted pair is two insulated copper wires twisted together. Interference picked up by one wire is matched by the other, and because the receiver reads the difference between them, the noise largely cancels. The twist also reduces crosstalk between neighbouring pairs. Categories rate what the cable supports over 100 m: Cat 5e carries 1 Gbps, Cat 6 carries 1 Gbps (and 10 Gbps up to about 55 m), and Cat 6a carries 10 Gbps for the full 100 m. Cables end in RJ-45 connectors. Straight-through cables used to connect unlike devices and crossover cables like devices, but auto-MDIX on modern ports has made the distinction mostly historical.",
    },
    {
      heading: 'How fibre keeps light inside',
      body: "An optical fibre has a glass core surrounded by cladding with a slightly lower refractive index. Light striking the boundary at more than the critical angle is totally reflected back into the core, so it zig-zags along the fibre with very little loss. In multi-mode fibre the core is wide (50 or 62.5 µm), so many rays (modes) take paths of different lengths and arrive spread out in time. This modal dispersion limits distance and speed. Graded-index multi-mode reduces it by slowing the central rays. Single-mode fibre has a core of only 8–10 µm, so one mode travels straight down the middle. Lasers drive single-mode fibre over tens of kilometres, while cheaper LEDs or VCSELs drive multi-mode over hundreds of metres.",
    },
    {
      heading: 'The wireless spectrum: radio, microwave and infrared',
      body: "Unguided media are grouped by frequency. Radio waves (roughly 3 kHz to 1 GHz) are omnidirectional and pass through walls, which suits broadcast radio and is why they interfere so easily. Microwaves (about 1 to 300 GHz) are directional and need line of sight, which suits point-to-point terrestrial links, satellites and cellular backhaul; Wi-Fi's 2.4 and 5 GHz bands sit at the low end. Infrared (300 GHz to 400 THz) works only over short distances and cannot pass through walls, which is why a TV remote does not change the channel in the next room. Satellites in geostationary orbit sit about 36,000 km up, so one trip up and down covers some 72,000 km and takes about 240 ms. That delay is noticeable in a conversation.",
    },
    {
      heading: 'Nyquist and Shannon worked',
      body: "Nyquist gives the maximum bit rate of a noiseless channel: C = 2B log2(L), where B is bandwidth in hertz and L is the number of signal levels. A 3,000 Hz channel with 4 levels gives 2 × 3,000 × 2 = 12,000 bps, and more levels raise the rate. Shannon adds noise and gives the true upper limit: C = B log2(1 + SNR), with SNR as a plain ratio. Convert from decibels with SNR = 10^(dB/10), so 30 dB means 1,000. The same 3,000 Hz channel at 30 dB caps out at 3,000 × log2(1,001), about 30 kbps, however clever the modem. In practice, Shannon gives the ceiling, and Nyquist then tells you how many levels you need to approach it.",
    },
  ],

  'switching-multiplexing': [
    {
      heading: 'Circuit switching in three phases',
      body: "A circuit-switched connection has three phases. Setup reserves a channel on every link along the path, using signalling, before any data moves. Data transfer then flows with only propagation delay, because nothing queues at the switches. Teardown releases the resources at the end. The reserved capacity belongs to that one conversation for its whole duration, whether anyone is speaking or not. Inside the switches, early space-division switches connected inputs to outputs with physical crosspoints: a crossbar for n lines needs n^2 crosspoints, and multistage designs exist to cut that number. Time-division switches instead rearrange time slots.",
    },
    {
      heading: 'Packet switching delay, and why splitting a message helps',
      body: "Packet switches use store-and-forward: a router must receive a whole packet before it can send it on, so every link adds one transmission delay. Over N links, one packet of transmission time t takes N × t, ignoring propagation and queuing. Splitting a message into P packets lets the links work in parallel (pipelining), so the total becomes (N + P - 1) × t, with t now per packet. Send an 8,000-bit message across 3 links at 1 Mbps as one packet and it takes 3 × 8 ms = 24 ms. Split it into 8 packets of 1,000 bits and it takes (3 + 8 - 1) × 1 ms = 10 ms. This is the same reason message switching is slow: a huge message cannot be pipelined.",
    },
    {
      heading: 'FDM, TDM and WDM in practice',
      body: "Frequency-division multiplexing gives each signal its own frequency band, separated by unused guard bands so neighbours do not bleed into each other; radio stations and old telephone trunks work this way. Time-division multiplexing gives each source a recurring time slot in a frame. Synchronous TDM gives every source its slot even when it has nothing to send. The classic example is the T1 line: 24 voice channels of 64 kbps plus 8 kbps of framing makes 1.544 Mbps. Statistical TDM assigns slots only to sources with data, so each slot must carry an address, but the link can be smaller than the sum of all inputs. Wavelength-division multiplexing is FDM for light: dense WDM carries dozens of wavelengths, each a separate channel, on one fibre.",
    },
    {
      heading: 'Spread spectrum',
      body: "Spread spectrum deliberately uses far more bandwidth than the data needs, which buys resistance to interference, jamming and eavesdropping. Frequency hopping (FHSS) changes carrier frequency many times a second in a pseudorandom pattern known to both ends. A narrowband interferer only spoils the occasional hop, and Bluetooth hops 1,600 times a second. Direct sequence (DSSS) replaces each data bit with a longer chip sequence: 802.11b used an 11-chip Barker code. The receiver correlates against the same code, which recovers the data and spreads interference out into low-level noise. CDMA builds on the same idea: users share one band simultaneously, separated only by their different codes.",
    },
  ],

  // ---------------------------------------------------------------- Unit 3

  'data-link-error-control': [
    {
      heading: 'CRC worked step by step',
      body: "To send data 1101 with generator 1011 (x^3 + x + 1), first append three zeros, one fewer than the generator's length, giving 1101000. Divide using modulo-2 arithmetic, where subtraction is XOR and there are no carries. 1101 XOR 1011 = 0110; bring down the next bit to get 1100, and 1100 XOR 1011 = 0111; bring down to get 1110, and 1110 XOR 1011 = 0101; bring down to get 1010, and 1010 XOR 1011 = 0001. The remainder is 001, so the transmitted frame is 1101001. The receiver divides the whole frame by 1011. A remainder of zero means no error was detected, and any non-zero remainder means the frame was corrupted and is discarded or retransmitted.",
    },
    {
      heading: 'Hamming (7,4) worked: finding the wrong bit',
      body: "Parity bits sit at positions 1, 2 and 4, and data bits at 3, 5, 6 and 7. Each parity bit covers the positions whose binary number includes it: p1 checks 1, 3, 5, 7; p2 checks 2, 3, 6, 7; p4 checks 4, 5, 6, 7. To send data 1011 (positions 3, 5, 6, 7 = 1, 0, 1, 1) with even parity: p1 covers 1, 0, 1, so p1 = 0; p2 covers 1, 1, 1, so p2 = 1; p4 covers 0, 1, 1, so p4 = 0. The codeword is 0110011. If bit 6 flips, giving 0110001, the receiver recomputes the checks: c1 = 0, c2 = 1, c4 = 1. Reading c4 c2 c1 as binary gives 110 = 6, which points straight at the wrong bit. The number of parity bits r must satisfy 2^r ≥ m + r + 1 for m data bits.",
    },
    {
      heading: 'Efficiency of the sliding-window protocols',
      body: "Let a = propagation delay / transmission time. Stop-and-Wait sends one frame per round trip, so efficiency is 1 / (1 + 2a). Take a 1,000-bit frame on a 1 Mbps link (1 ms to transmit) with 20 ms propagation: a = 20, so efficiency is 1/41, about 2.4%. The link sits idle 97% of the time. A sliding window of W frames gives W / (1 + 2a), capped at 100%, so keeping this link full needs W ≥ 41. With Go-Back-N the window can be 2^m - 1, so m = 6 bits (63 frames) is enough. Selective Repeat allows only 2^(m-1), so it needs m = 7. Go-Back-N also wastes capacity resending good frames after an error, which is why Selective Repeat wins on noisy links despite its extra buffering.",
    },
    {
      heading: 'HDLC and PPP, the real data link protocols',
      body: "HDLC is a bit-oriented protocol that frames data between 01111110 flags, with bit stuffing so the flag never appears inside the data. It has three frame types. I-frames carry data with piggybacked sequence numbers. S-frames carry supervision: Receive Ready, Receive Not Ready, Reject (Go-Back-N) and Selective Reject. U-frames manage the link, such as setup and disconnect. It runs in normal response mode (primary and secondary stations) or asynchronous balanced mode (peers). PPP, used on point-to-point links such as dial-up and many DSL connections, is byte-oriented with byte stuffing. Its Link Control Protocol (LCP) negotiates the link, PAP or CHAP authenticate the user, and Network Control Protocols such as IPCP configure IP over the link.",
    },
  ],

  'mac-ethernet': [
    {
      heading: 'Where ALOHA’s 18% and 37% come from',
      body: "In pure ALOHA a frame collides with any other frame started up to one frame time before or after it, a vulnerable period of 2 frame times. With G frames attempted per frame time, throughput is S = G × e^(-2G), which peaks at G = 0.5 giving 1/(2e) ≈ 0.184: at best 18.4% of the channel carries successful frames. Slotted ALOHA allows transmissions only at slot boundaries, halving the vulnerable period to one frame time. That gives S = G × e^(-G), which peaks at G = 1 giving 1/e ≈ 0.368, or 36.8%. Both curves fall as load rises past the peak, because more attempts mean more collisions. This is the basic weakness of uncoordinated access.",
    },
    {
      heading: 'CSMA/CD numbers: minimum frame size and backoff',
      body: "For a sender to detect a collision, it must still be transmitting when the collision signal returns from the far end of the cable. So frame transmission time must be at least twice the propagation delay, giving L_min = 2 × Tp × R. Classic 10 Mbps Ethernet allowed a 51.2 µs round trip, which is 512 bits or 64 bytes, the familiar minimum frame. At 1 Gbps over 1 km of cable (Tp = 5 µs), the same rule would demand 10,000 bits, which is why faster Ethernet shortened cable lengths, added carrier extension, and finally relied on full-duplex switching with no collisions at all. After the nth collision a station waits a random number of slot times between 0 and 2^n - 1 (capped at 1,023), and gives up after 16 attempts. This is binary exponential backoff.",
    },
    {
      heading: 'The Ethernet frame and MAC address format',
      body: "An Ethernet frame starts with a 7-byte preamble and a 1-byte start frame delimiter for clock synchronisation. Then come the 6-byte destination MAC address, the 6-byte source MAC address, a 2-byte type/length field, a payload of 46 to 1,500 bytes, and a 4-byte frame check sequence (a CRC-32). The minimum frame is 6 + 6 + 2 + 46 + 4 = 64 bytes, and shorter payloads are padded; the maximum is 1,518 bytes. A MAC address's first 24 bits are the manufacturer's Organisationally Unique Identifier (OUI). The lowest bit of the first byte marks a group (multicast) address, and the broadcast address is FF:FF:FF:FF:FF:FF.",
    },
    {
      heading: 'CSMA/CA, the hidden terminal and RTS/CTS',
      body: "Wireless cannot use collision detection: a radio cannot listen while it transmits at full power, and a collision that matters happens at the receiver, not the sender. The hidden terminal problem makes this concrete. A and C are both in range of B but out of range of each other, so each senses a free channel, both transmit, and their frames collide at B without either knowing. CSMA/CA waits for the channel to be idle for an interframe space (DIFS), then counts down a random backoff before sending, and expects an acknowledgement for every frame. Optionally a sender first sends a short Request to Send; the receiver answers Clear to Send, and every station that hears the CTS, hidden ones included, stays quiet for the duration it announces.",
    },
    {
      heading: 'How a switch forwards, VLANs, and spanning tree',
      body: "For every frame, a switch records the source MAC against the incoming port in its table. Then it decides. If the destination is known on another port, it forwards only there. If it is known on the same port, it filters (drops) the frame. If it is unknown or broadcast, it floods out of every other port. Store-and-forward switches check the CRC first; cut-through switches start forwarding after reading the destination address, which lowers latency but passes on corrupt frames. VLANs split one switch into several broadcast domains using a 4-byte 802.1Q tag with a 12-bit VLAN ID (4,094 usable). Spanning Tree elects the switch with the lowest bridge ID as root. Every other switch picks its lowest-cost root port, each segment gets one designated port, and all remaining ports are blocked, leaving a loop-free tree.",
    },
  ],

  // ---------------------------------------------------------------- Unit 4

  'ipv4-addressing': [
    {
      heading: 'Reading the IPv4 header',
      body: "The IPv4 header is 20 bytes without options and up to 60 with them. Version (4) is followed by the header length (IHL, in 32-bit words, so 5 means 20 bytes) and the type of service byte, now used for DiffServ codes. Total length covers header plus data, up to 65,535 bytes. Identification, flags (DF = don't fragment, MF = more fragments) and fragment offset support fragmentation. TTL is decremented by each router, and the packet is dropped at zero, which stops routing loops lasting forever. The protocol field gives the payload type (1 ICMP, 6 TCP, 17 UDP), and the header checksum covers the header only, so it is recomputed at every hop because TTL changes. Then come the 32-bit source and destination addresses.",
    },
    {
      heading: 'Fragmentation worked',
      body: "A 4,000-byte datagram (20-byte header plus 3,980 bytes of data) must cross a link with an MTU of 1,500. Each fragment can carry at most 1,500 - 20 = 1,480 data bytes, which is conveniently a multiple of 8, as offsets require. The data splits into 1,480 + 1,480 + 1,020 bytes. Offsets are counted in 8-byte units, so they are 0, 185 and 370. The MF flag is 1, 1 and 0, and total lengths are 1,500, 1,500 and 1,040. Fragments may take different routes and are reassembled only at the destination, never by routers along the way. Losing any one fragment loses the whole datagram, which is why fragmentation is avoided. IPv6 routers never fragment at all, and senders use path MTU discovery instead.",
    },
    {
      heading: 'Classful ranges and special addresses',
      body: "Classes were identified by the first bits, which fix the first octet's range. Class A runs 1–126 with a default /8, about 16.7 million hosts per network. Class B runs 128–191 with /16, 65,534 hosts. Class C runs 192–223 with /24, 254 hosts. Class D (224–239) is multicast and class E (240–255) is reserved. Some addresses are special everywhere. 127.0.0.0/8 is loopback (127.0.0.1 is the host itself). 0.0.0.0 means this host, or any address in a routing table. 255.255.255.255 is the limited broadcast, never forwarded by routers. 169.254.0.0/16 is link-local, the address a machine gives itself when DHCP fails, which makes it a useful clue when troubleshooting.",
    },
    {
      heading: 'IPv6 notation and the transition',
      body: "An IPv6 address is eight groups of four hex digits. Two rules shorten it. Leading zeros in a group may be dropped, and one run of consecutive all-zero groups may be replaced by ::, but only once, or the address becomes ambiguous. So 2001:0db8:0000:0000:0000:ff00:0042:8329 becomes 2001:db8::ff00:42:8329. IPv6 has unicast, multicast and anycast addresses (delivered to the nearest of a group) but no broadcast. Optional features move into extension headers chained after the fixed 40-byte header. Because the two protocols are not compatible, three transition methods are used: dual stack (running both), tunnelling (carrying IPv6 inside IPv4 packets across IPv4-only networks), and translation (NAT64 for IPv6-only clients reaching IPv4 servers).",
    },
    {
      heading: 'DHCP and ARP step by step',
      body: "DHCP takes four messages, remembered as DORA. The client broadcasts a Discover from 0.0.0.0, since it has no address yet. Servers reply with an Offer of an address. The client broadcasts a Request for one offer, which also tells the other servers they lost. The chosen server confirms with an Acknowledge carrying the address, mask, gateway, DNS server and lease time. The client tries to renew at half the lease. ARP works on demand. To reach 192.168.1.20, a host checks its ARP cache, and if the entry is missing it broadcasts 'who has 192.168.1.20? tell 192.168.1.10'. The owner replies by unicast with its MAC, and both sides cache the mapping. For a destination on another network, the host ARPs for its default gateway's MAC instead, never for the remote host's.",
    },
  ],

  subnetting: [
    {
      heading: 'Network, broadcast and host range for any address',
      body: "Take 172.16.45.130/27. A /27 leaves 5 host bits, so the mask is 255.255.255.224 and the interesting octet is the fourth. The block size is 256 - 224 = 32, so subnets start at 0, 32, 64, 96, 128, 160 and so on. The address's fourth octet, 130, falls in the 128–159 block. The network address is therefore 172.16.45.128, the broadcast is 172.16.45.159, and usable hosts run from .129 to .158, which is 30 hosts (2^5 - 2). The method never changes: find the octet where the mask stops being 255, work out the block size, and find which block the address falls into.",
    },
    {
      heading: 'Subnetting in the third octet',
      body: "When the prefix is shorter than /24, the same method applies one octet earlier. For 172.16.0.0/20, the mask is 255.255.240.0, so the third octet has block size 256 - 240 = 16. Subnets begin at 172.16.0.0, 172.16.16.0, 172.16.32.0, 172.16.48.0, and each holds 2^12 - 2 = 4,094 hosts. For the address 172.16.37.9/20, the third octet 37 falls in the 32–47 block. The network is 172.16.32.0, the broadcast is 172.16.47.255, and hosts run from 172.16.32.1 to 172.16.47.254. Students often stop at 172.16.32.255 as the broadcast, forgetting that the block spans sixteen values of the third octet.",
    },
    {
      heading: 'A complete VLSM allocation',
      body: "Allocate 192.168.10.0/24 to departments needing 100, 50 and 20 hosts plus two point-to-point links. Sort by size and allocate largest first. 100 hosts needs 7 host bits (126 usable), so a /25: 192.168.10.0–127. 50 hosts needs 6 bits (62 usable), so a /26: .128–.191. 20 hosts needs 5 bits (30 usable), so a /27: .192–.223. Each link needs 2 hosts, so a /30 (2 usable): .224–.227 and .228–.231. Addresses .232–.255 remain free for growth. Each block starts on a multiple of its own size, which is why largest-first works: the big blocks claim aligned space before the small ones can fragment it.",
    },
    {
      heading: 'Choosing a mask from the requirements',
      body: "If a question gives a host count, find the smallest h with 2^h - 2 ≥ hosts. If it gives a subnet count, find the smallest b with 2^b ≥ subnets. For example, split 200.10.5.0/24 into at least 6 subnets. Borrowing 3 bits gives 8 subnets, so the prefix becomes /27, the mask 255.255.255.224, and each subnet has 30 usable hosts. Always check both constraints: borrowing more bits for subnets leaves fewer host bits, so a requirement of 6 subnets with 40 hosts each cannot be met from one /24. That would need at least 6 × 64 = 384 addresses.",
    },
    {
      heading: 'Supernetting and route summarisation',
      body: "Supernetting combines contiguous blocks into one shorter prefix, so one route replaces many. Four networks 192.168.0.0/24 to 192.168.3.0/24 summarise to 192.168.0.0/22, because they share their first 22 bits. Three conditions must hold. The blocks must be contiguous, their number must be a power of two, and the first block must be aligned: for four /24s, the third octet of the first must be divisible by 4. So 192.168.4.0 to 192.168.7.0 summarise to 192.168.4.0/22, but 192.168.1.0 to 192.168.4.0 cannot become a single /22. This aggregation is what keeps Internet routing tables manageable.",
    },
  ],

  'routing-algorithms': [
    {
      heading: 'Distance vector and the Bellman-Ford equation',
      body: "Each router keeps a vector of its best known cost to every destination and periodically sends it to its neighbours. On receiving vectors, it applies the Bellman-Ford equation: D_x(y) = min over neighbours v of [ c(x,v) + D_v(y) ], the cost to reach the neighbour plus the neighbour's cost to the destination. Suppose router A reaches B at cost 2 and C at cost 5, and B advertises destination D at cost 4 while C advertises it at 2. Via B costs 6, via C costs 7, so A records D at cost 6 with next hop B. No router ever sees the whole topology. Good news (a cheaper path) spreads one hop per exchange, but bad news spreads slowly.",
    },
    {
      heading: 'Count-to-infinity, step by step',
      body: "Take three routers in a line, A - B - C, each link cost 1. B reaches C at cost 1, and A reaches C via B at cost 2. Now the B–C link fails. B looks for an alternative and hears A advertising C at cost 2, not knowing that route runs back through B itself. So B sets C to 3 via A. A then hears B say 3 and updates to 4, B updates to 5, and they climb together until they hit the defined infinity, 16 in RIP. Split horizon breaks the loop by having A never advertise its route to C back to B, the neighbour it learned it from. Poison reverse goes further: A advertises C to B with infinite cost, explicitly killing the bogus path. Hold-down timers make routers ignore claims of a better route for a short time after a failure.",
    },
    {
      heading: 'Dijkstra worked on a small network',
      body: "Links: A–B cost 4, A–C cost 2, C–B cost 1, B–D cost 5, C–D cost 8. Starting from A, the tentative distances are C = 2, B = 4 and D = ∞. Make the closest, C at 2, permanent. Through C, B costs 2 + 1 = 3, which beats 4, and D costs 2 + 8 = 10. Next make B (3) permanent. Through B, D costs 3 + 5 = 8, which beats 10. Finally D is permanent at 8. The shortest paths are A→C (2), A→C→B (3) and A→C→B→D (8). Every OSPF router runs exactly this on its full link-state map. It needs all link costs to be non-negative, and with a binary heap it runs in O((V + E) log V).",
    },
    {
      heading: 'RIP, OSPF and BGP side by side',
      body: "RIP is distance vector. Its metric is hop count with 15 as the maximum, so 16 means unreachable; it sends the whole table every 30 seconds over UDP port 520, which makes it simple but slow and suitable only for small networks. OSPF is link state. Its cost is based on link bandwidth; routers discover neighbours with Hello packets and flood link-state advertisements (LSAs). Large networks divide into areas around a backbone area 0, which limits flooding. It runs directly over IP (protocol 89) and converges in seconds. BGP is path vector and runs over TCP port 179. It advertises the list of autonomous systems a route passes through (AS-PATH), rejects any route already containing its own AS, and chooses routes by policy, using eBGP between ASes and iBGP within one.",
    },
    {
      heading: 'Leaky bucket and token bucket worked',
      body: "A leaky bucket outputs at a constant rate r no matter how bursty the input, queuing or discarding the excess, so the output is perfectly smooth. A token bucket adds tokens at rate r up to a capacity b, and a packet may be sent only by spending tokens. After a quiet period the bucket is full, so a burst can go out at the full line speed M until the tokens run out. The maximum burst duration is S = b / (M - r). With b = 1,000 KB, r = 1 MB/s and M = 6 MB/s, S = 1,000 KB / 5,000 KB/s = 0.2 s. After that the output falls back to the token rate. Combining the two, a token bucket feeding a leaky bucket, allows bursts while capping the peak rate.",
    },
  ],

  // ---------------------------------------------------------------- Unit 5

  'transport-tcp': [
    {
      heading: 'The TCP header, field by field',
      body: "The header is 20 bytes without options and up to 60 with them. It carries the source and destination ports (16 bits each), a 32-bit sequence number (the byte number of the first data byte) and a 32-bit acknowledgement number (the next byte expected). The header length is in 32-bit words. Six classic flags follow: URG, ACK, PSH, RST, SYN and FIN. The 16-bit window field advertises free buffer space, and the window scale option multiplies it for fast links. The checksum covers the header, the data and a pseudo-header of IP addresses, protocol and length, so a misdelivered segment is caught. Common options are MSS, window scale, SACK permitted and timestamps, all negotiated in the SYN segments.",
    },
    {
      heading: 'The handshake and data transfer with real numbers',
      body: "Suppose the client picks initial sequence number 1000. It sends SYN with seq = 1000. The server picks 5000 and replies SYN-ACK with seq = 5000, ack = 1001; the SYN consumed one sequence number even though it carried no data. The client replies ACK with seq = 1001, ack = 5001. If the client now sends 500 bytes, they occupy sequence numbers 1001–1500, and the server acknowledges with ack = 1501. FIN also consumes one sequence number. Initial sequence numbers are chosen unpredictably, not from zero, so segments from an old connection between the same ports cannot be mistaken for new ones, and so an attacker cannot easily forge a segment that fits.",
    },
    {
      heading: 'Closing the connection and the state machine',
      body: "The side that closes first (the active closer) sends FIN and enters FIN_WAIT_1. When its FIN is acknowledged it moves to FIN_WAIT_2, and it can still receive data, which is the half-close. The other side, on receiving FIN, enters CLOSE_WAIT until its application finishes, then sends its own FIN and waits in LAST_ACK. When the active closer receives that FIN, it acknowledges it and enters TIME_WAIT for twice the maximum segment lifetime (2 × MSL) before reaching CLOSED. TIME_WAIT exists for two reasons: the final ACK may be lost and the other side's FIN retransmitted, and stray duplicate segments from this connection must expire before the same port pair is reused.",
    },
    {
      heading: 'Estimating RTT and setting the timeout',
      body: "TCP measures a SampleRTT for segments and smooths it. Per RFC 6298, it first updates the deviation DevRTT = 0.75 × DevRTT + 0.25 × |SampleRTT - EstimatedRTT|, then the estimate EstimatedRTT = 0.875 × EstimatedRTT + 0.125 × SampleRTT, and sets RTO = EstimatedRTT + 4 × DevRTT. Starting from an estimate of 100 ms and a deviation of 10 ms, a sample of 120 ms gives DevRTT = 7.5 + 5 = 12.5 ms and EstimatedRTT = 87.5 + 15 = 102.5 ms, so RTO = 102.5 + 50 = 152.5 ms. Karn's algorithm ignores samples from retransmitted segments, because it is unclear which copy the ACK answers, and doubles the RTO after each timeout (exponential backoff). TCP also runs a persist timer, a keepalive timer and the TIME_WAIT timer.",
    },
    {
      heading: 'Flow control and silly window syndrome',
      body: "The receiver advertises rwnd = buffer size - (data received but not yet read by the application). With a 4,000-byte buffer, 3,000 bytes received and 1,000 read, it advertises 4,000 - 2,000 = 2,000 bytes. The sender may never have more than that outstanding. Silly window syndrome is what happens when tiny windows produce tiny segments: a 40-byte header carrying 1 byte of data. On the sender side, Nagle's algorithm sends the first small piece immediately, then holds further small pieces until either an ACK arrives or a full segment's worth has collected. On the receiver side, Clark's solution waits until it can advertise a full segment or half its buffer before announcing a window again.",
    },
  ],

  'transport-udp': [
    {
      heading: 'The UDP header and checksum',
      body: "UDP's header has four 16-bit fields: source port, destination port, length (header plus data, minimum 8) and checksum. The checksum is a one's-complement sum over a pseudo-header (source IP, destination IP, protocol 17 and UDP length), the UDP header and the data. Including the IP addresses catches datagrams delivered to the wrong host. In IPv4 a checksum of zero means none was computed; in IPv6 it is mandatory, because IPv6 dropped its own header checksum. The largest UDP payload over IPv4 is 65,535 - 20 - 8 = 65,507 bytes. In practice applications stay under the path MTU to avoid fragmentation, which is why DNS kept answers to 512 bytes for so long.",
    },
    {
      heading: 'Multiplexing and demultiplexing with sockets',
      body: "Many processes share one IP address, and port numbers keep their traffic apart. A UDP socket is identified by just the destination IP and destination port. Datagrams from any number of senders to port 53 all land in the same DNS server socket, and the application reads each sender's address from the datagram. A TCP socket is identified by the full four-tuple of source IP, source port, destination IP and destination port. A web server listening on port 80 therefore creates a separate socket for every client connection, all on port 80, distinguished by the clients' addresses and ports. Clients use ephemeral ports, picked by the operating system from the dynamic range for each new connection.",
    },
    {
      heading: 'Building only the reliability you need on top of UDP',
      body: "Applications that use UDP often add back just the features they need. RTP, used for voice and video, runs over UDP and adds sequence numbers to detect loss and reordering, plus timestamps so the receiver can play media at the right pace. A playout buffer at the receiver absorbs jitter by delaying playback slightly. TFTP adds simple stop-and-wait acknowledgements for file transfer. QUIC, the transport under HTTP/3, implements reliability, congestion control and encryption over UDP inside the application. That lets it avoid TCP's head-of-line blocking and be updated without changing operating system kernels.",
    },
    {
      heading: 'QoS techniques that make promises possible',
      body: "Promising quality takes several cooperating techniques. Scheduling decides which queued packet goes next: FIFO treats all traffic alike, priority queuing always serves the high-priority queue first (which can starve low-priority traffic), and weighted fair queuing shares the link in proportion to weights. Traffic shaping with leaky or token buckets smooths what enters the network. Admission control refuses a new flow that would break existing guarantees. IntServ uses RSVP to reserve resources along the path for each flow. DiffServ instead marks each packet with a 6-bit DSCP value in the IP header, and every router applies a per-hop behaviour: Expedited Forwarding for low-latency voice, Assured Forwarding classes for business traffic, and default best effort for everything else.",
    },
  ],

  'congestion-control': [
    {
      heading: 'A full congestion window trace',
      body: "Start with cwnd = 1 MSS and ssthresh = 16. Slow start doubles cwnd each round trip: 1, 2, 4, 8, 16. At 16 it reaches the threshold and congestion avoidance adds one per round trip: 17, 18, 19, 20. Suppose a timeout occurs at 20. TCP sets ssthresh to half the current window, 10, resets cwnd to 1, and slow starts again: 1, 2, 4, 8, then 10 (capped at the threshold), then 11, 12 and so on. If instead three duplicate ACKs arrive at 20, TCP Reno also sets ssthresh to 10 but sets cwnd to 10, not 1, after fast retransmit, and continues linearly. TCP Tahoe, the older version, resets to 1 on both signals. Plotting these numbers gives the sawtooth graph exams ask you to draw.",
    },
    {
      heading: 'Open-loop and closed-loop congestion control',
      body: "Open-loop methods prevent congestion before it starts. A good retransmission policy uses sensible timers. A window policy, such as Selective Repeat, avoids resending data that arrived. An acknowledgement policy can ACK less often to reduce load. A discarding policy drops less important packets first, and admission control refuses new flows when resources are short. Closed-loop methods react once congestion appears. Backpressure has a congested router stop accepting from its upstream neighbours, hop by hop. A choke packet is sent straight back to the source; ICMP Source Quench did this but is now deprecated. Implicit signalling infers congestion from loss or rising delay, as TCP does. Explicit signalling marks packets: ECN sets bits in the IP header, and the receiver echoes them back with TCP's ECE flag.",
    },
    {
      heading: 'Throughput, RTT and fairness',
      body: "A TCP sender transmits about one window per round trip, so throughput ≈ cwnd / RTT. A 64 KB window over a 100 ms RTT gives about 640 KB/s, roughly 5 Mbps, whatever the link speed. Long-distance or high-speed paths therefore need large windows, hence the window scale option. AIMD is fair: when two flows share a bottleneck, additive increase moves both up equally, while multiplicative decrease cuts the larger flow by more in absolute terms. Over time their shares converge to equal. The fairness is per connection, though, so an application that opens ten parallel connections gets roughly ten shares.",
    },
    {
      heading: 'What routers do: tail drop, RED and modern algorithms',
      body: "A router whose queue fills simply drops new arrivals (tail drop). Because many flows lose packets at the same moment, they all back off together and then grow together, so the link swings between overloaded and idle. This is global synchronisation. Random Early Detection (RED) watches the average queue length and starts dropping packets at random as it rises between a minimum and maximum threshold, signalling a few flows early instead of all of them at once. ECN can mark those packets instead of dropping them. On the sender side, Linux now uses CUBIC, which grows the window as a cubic function of time since the last loss to suit fast, long paths. Google's BBR estimates bottleneck bandwidth and RTT directly instead of treating loss as the only signal.",
    },
  ],

  // ---------------------------------------------------------------- Unit 6

  dns: [
    {
      heading: 'The resolution walk in detail',
      body: "An application asks the operating system's stub resolver, which asks a recursive resolver, typically the ISP's or a public one such as 8.8.8.8. On a cache miss, the recursive resolver makes iterative queries. A root server, one of 13 named identities (a to m), each served by many machines via anycast, refers it to the .com servers. The .com server refers it to the authoritative servers for example.com, which return the A record. The resolver caches every answer for its TTL, including the referrals, so the next lookup for anything under .com skips the root entirely. It also caches failures (negative caching), so a mistyped name is not re-queried at once. Most lookups are answered from a cache within milliseconds.",
    },
    {
      heading: 'Inside a DNS message',
      body: "Queries and replies share one format. The header carries a 16-bit ID, which matches a reply to its query, and flags. QR marks a query or response. AA marks an authoritative answer. TC marks a truncated message. RD asks for recursion and RA says recursion is available. A response code (rcode) reports outcomes such as NXDOMAIN, meaning the name does not exist. Four sections follow: question, answer, authority (which servers are authoritative) and additional (helpful extras, such as the IP addresses of those servers, called glue records). Classic DNS over UDP limited messages to 512 bytes. EDNS0 raises that limit, and a reply with TC set tells the client to retry over TCP.",
    },
    {
      heading: 'Records, zones and delegation',
      body: "Each zone has one SOA (start of authority) record naming its primary server, an administrator contact and a serial number, with refresh, retry, expire and minimum timers. NS records delegate a subdomain to other servers. MX records list mail servers with a preference value, where lower is tried first. A CNAME makes a name an alias and cannot coexist with other records at that name. TXT records carry text such as SPF mail policies. Reverse lookups use PTR records under in-addr.arpa with the octets reversed: 93.184.216.34 is looked up as 34.216.184.93.in-addr.arpa. Secondary servers copy the zone from the primary with a zone transfer (AXFR, over TCP) whenever the SOA serial number increases.",
    },
    {
      heading: 'Attacks on DNS and the defences',
      body: "Classic DNS has no authentication, so an attacker who forges a reply matching a pending query's ID and port can plant a false record in a resolver's cache: cache poisoning, which silently redirects everyone using that resolver. Resolvers defend by randomising both the query ID and the source port, which makes guessing far harder. DNSSEC adds digital signatures: zones sign their records (RRSIG) and publish keys (DNSKEY), and each parent vouches for its child's key with a DS record, forming a chain of trust up to the root. DNSSEC provides integrity and authenticity but not secrecy. DNS over HTTPS (DoH) and DNS over TLS (DoT) encrypt queries so on-path observers cannot read them. DNS servers are also popular DDoS targets, because taking one down breaks every service that depends on it.",
    },
  ],

  'http-web': [
    {
      heading: 'Anatomy of an HTTP request and response',
      body: "A request starts with a request line such as 'GET /index.html HTTP/1.1', followed by headers, one per line: Host (mandatory in HTTP/1.1, so one IP address can host many sites), User-Agent, Accept and Cookie. A blank line comes next, then an optional body. The response starts with a status line such as 'HTTP/1.1 200 OK', followed by headers such as Content-Type, Content-Length, Set-Cookie and Cache-Control, a blank line and the body. Methods have defined properties. GET and HEAD are safe, so they must not change server state. PUT and DELETE are idempotent, so repeating them has the same effect as doing them once. POST is neither, which is why a browser warns before resubmitting a form.",
    },
    {
      heading: 'Persistent connections and the HTTP versions',
      body: "HTTP/1.0 opened a new TCP connection for every object, costing one round trip for the handshake and one for the request each time. A page with 10 images (11 objects) fetched one after another costs about 22 round trips. HTTP/1.1 made connections persistent: one handshake, then about one round trip per object, around 12 in total. Pipelining (sending requests without waiting for replies) cuts that further, but responses must return in order, so one slow object holds up the rest. This is head-of-line blocking. HTTP/2 sends binary frames for many requests as parallel streams over one connection and compresses headers (HPACK). HTTP/3 runs over QUIC on UDP, so a lost packet stalls only its own stream rather than the whole TCP connection.",
    },
    {
      heading: 'Caching, conditional requests and cookies',
      body: "A web cache, in the browser or in a proxy server near the users, keeps copies of responses so repeated requests skip the trip to the origin server. That saves both time and upstream bandwidth. Cache-Control: max-age tells caches how long a response stays fresh. Once it is stale, the cache sends a conditional GET with If-Modified-Since (or If-None-Match with an ETag). If nothing changed, the server replies 304 Not Modified with no body, and the cached copy is reused. Cookies give stateless HTTP a memory, using four pieces: the Set-Cookie header in a response, the Cookie header in later requests, the browser's cookie store, and the site's database that maps the cookie value to a user or session.",
    },
    {
      heading: 'How an email travels',
      body: "Alice's user agent (a mail client) sends the message by SMTP to her own mail server. That server looks up the MX record for Bob's domain and delivers by SMTP to Bob's mail server, which stores it in his mailbox. Bob later retrieves it with POP3, IMAP or webmail over HTTP. SMTP is a push protocol, so a separate pull protocol is needed at the end. An SMTP session is a text dialogue: HELO or EHLO, MAIL FROM, RCPT TO, DATA (the message, ended by a line containing a single dot), then QUIT. SMTP was designed for 7-bit ASCII. MIME adds headers such as Content-Type and encodings such as base64, so the same channel can carry attachments, images and non-English text.",
    },
    {
      heading: 'FTP modes, remote login and SNMP',
      body: "FTP keeps a control connection on port 21 open for the whole session and opens a new data connection for each file or directory listing. In active mode the client sends a PORT command and the server connects back from port 20 to the client, which client-side firewalls and NAT usually block. In passive mode the client sends PASV, the server replies with a port number, and the client opens the data connection itself, which is why passive mode is the default today. FTP also distinguishes ASCII from binary transfers. Telnet gave remote terminals using a Network Virtual Terminal, but in clear text, while SSH (port 22) encrypts and authenticates the session and also carries SFTP and SCP. SNMP lets a manager query agents on devices for variables defined in a MIB over UDP port 161, and agents send traps on port 162.",
    },
  ],

  'network-security': [
    {
      heading: 'From classical ciphers to AES',
      body: "A substitution cipher replaces each symbol with another. The Caesar cipher shifts letters by a fixed amount, so with a shift of 3, HELLO becomes KHOOR. With only 25 possible keys it falls to brute force, and any monoalphabetic substitution falls to frequency analysis, because E is still the most common letter, just disguised. A transposition cipher keeps the letters but rearranges their order. Modern block ciphers combine both ideas over many rounds. DES used a 64-bit block with a 56-bit key, short enough that it was brute-forced in the late 1990s, so Triple DES applied it three times. AES, the current standard, uses 128-bit blocks with 128, 192 or 256-bit keys, and remains the cipher that encrypts nearly all bulk traffic.",
    },
    {
      heading: 'RSA worked with small numbers',
      body: "Choose primes p = 3 and q = 11, so n = 33 and φ(n) = (p - 1)(q - 1) = 20. Choose a public exponent e = 3, which has no common factor with 20. Find the private exponent d with e × d ≡ 1 (mod 20): d = 7, since 3 × 7 = 21. The public key is (e, n) = (3, 33) and the private key is (d, n) = (7, 33). To encrypt the message m = 4: c = 4^3 mod 33 = 64 mod 33 = 31. To decrypt: 31^7 mod 33. Since 31 ≡ -2 (mod 33), this is (-2)^7 = -128, and -128 + 4 × 33 = 4, which recovers the message. Real RSA uses primes hundreds of digits long. Its security rests on how hard it is to factor n back into p and q.",
    },
    {
      heading: 'Diffie-Hellman key exchange',
      body: "Diffie-Hellman lets two parties agree a shared secret over a public channel without ever sending it. They agree publicly on a prime p = 23 and a base g = 5. Alice picks a secret a = 4 and sends A = 5^4 mod 23 = 625 mod 23 = 4. Bob picks a secret b = 3 and sends B = 5^3 mod 23 = 125 mod 23 = 10. Alice computes B^a = 10^4 mod 23 = 18, and Bob computes A^b = 4^3 mod 23 = 64 mod 23 = 18, the same secret. An eavesdropper sees 23, 5, 4 and 10 but would have to solve a discrete logarithm to find a or b. On its own, DH is open to a man-in-the-middle who runs a separate exchange with each side, which is why the exchanged values are signed and backed by certificates.",
    },
    {
      heading: 'How TLS puts the pieces together',
      body: "In a TLS handshake the client sends ClientHello with the protocol versions and cipher suites it supports and a random value. The server replies with its choice, its own random value and its certificate. The client checks the certificate chain up to a certificate authority it already trusts, and checks that the name matches the site. Both sides then perform an ephemeral Diffie-Hellman exchange (ECDHE), signed by the server's private key, and derive symmetric session keys from it. Finished messages confirm that nobody tampered with the handshake. From then on, traffic is protected with a fast authenticated cipher such as AES-GCM, providing confidentiality and integrity together. TLS 1.3 completes this in a single round trip, and the ephemeral keys give forward secrecy: stealing the server's private key later cannot decrypt recorded sessions.",
    },
    {
      heading: 'Firewalls, IDS and VPNs in more depth',
      body: "A packet-filtering firewall checks each packet against rules on addresses, ports and protocol, statelessly. A stateful firewall tracks connections, so it can allow replies to traffic that started inside while blocking unsolicited connections from outside. An application gateway (proxy) understands the protocol itself and can filter on content. Public servers usually sit in a DMZ, a separate segment between the Internet and the internal network. An intrusion detection system (IDS) watches traffic and raises alerts, either by matching known attack signatures or by spotting anomalies against normal behaviour. An intrusion prevention system (IPS) sits inline and blocks. VPNs commonly use IPsec, where AH provides authentication and integrity and ESP adds encryption, in transport mode (protecting the payload) or tunnel mode (wrapping the whole packet). TLS-based VPNs are the other common option.",
    },
  ],
};
