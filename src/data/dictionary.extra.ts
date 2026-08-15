/**
 * Second dictionary bank.
 *
 * Split from `dictionary.ts` to keep both files readable; they are concatenated there and the
 * integrity tests treat the result as one collection. These terms cover the syllabus ground
 * the first bank missed: link-layer protocols, the network layer's supporting cast, quality
 * of service, the application protocols and cryptography.
 */

import type { DictionaryTerm } from '../models/content.ts';

export const DICTIONARY_EXTRA: readonly DictionaryTerm[] = [
  // ---------------------------------------------------------------- General & physical

  { id: 'throughput', term: 'Throughput', category: 'General',
    definition: 'The data rate actually achieved on a link, after headers, errors and contention take their share. Never higher than bandwidth.',
    examples: ['A 100 Mbps link delivering 60 Mbps of file data.'], relatedTerms: ['bandwidth', 'latency'] },

  { id: 'jitter', term: 'Jitter', category: 'General',
    definition: 'Variation in packet delay. Voice and video suffer more from jitter than from steady delay, because a jittery stream cannot be played smoothly.',
    relatedTerms: ['latency', 'qos'] },

  { id: 'isp', term: 'ISP', category: 'General',
    definition: 'Internet Service Provider. Sells connectivity and peers with other providers so its customers can reach the rest of the Internet.',
    relatedTerms: ['wan', 'bgp'] },

  { id: 'pan', term: 'PAN', category: 'General',
    definition: 'Personal Area Network. The few metres around one person, typically Bluetooth between a phone and its accessories.',
    relatedTerms: ['lan'] },

  { id: 'man', term: 'MAN', category: 'General',
    definition: 'Metropolitan Area Network. Larger than a LAN, smaller than a WAN, usually covering a city.',
    relatedTerms: ['lan', 'wan'] },

  { id: 'simplex', term: 'Simplex', category: 'General',
    definition: 'Communication in one direction only, like a keyboard to a computer.',
    relatedTerms: ['full-duplex'] },

  { id: 'full-duplex', term: 'Full duplex', category: 'General',
    definition: 'Both ends transmit simultaneously. Switched Ethernet is full duplex, which is why collisions disappeared from it.',
    relatedTerms: ['simplex', 'switch'] },

  { id: 'distortion', term: 'Distortion', category: 'General',
    definition: 'Change in signal shape because different frequency components travel at different speeds. Distinct from attenuation, which only weakens.',
    relatedTerms: ['attenuation', 'noise'] },

  { id: 'noise', term: 'Noise', category: 'General',
    definition: 'Unwanted energy added to a signal in transit: thermal, induced, crosstalk or impulse.',
    relatedTerms: ['distortion', 'shannon-capacity'] },

  { id: 'shannon-capacity', term: 'Shannon capacity', category: 'General',
    definition: 'The maximum error-free data rate of a noisy channel, C = B log2(1 + S/N). The ceiling no coding scheme beats.',
    examples: ['A 3 kHz voice line at 30 dB SNR caps near 30 kbps.'], relatedTerms: ['nyquist-rate', 'noise'] },

  { id: 'nyquist-rate', term: 'Nyquist rate', category: 'General',
    definition: 'Maximum signalling rate on a noiseless channel, C = 2B log2(L) for L signal levels.',
    relatedTerms: ['shannon-capacity', 'bandwidth'] },

  { id: 'coaxial', term: 'Coaxial cable', category: 'Devices',
    definition: 'A central conductor inside a shield. Better bandwidth and interference resistance than twisted pair, now rare in LANs.',
    relatedTerms: ['twisted-pair', 'fibre-optic'] },

  { id: 'single-mode', term: 'Single-mode fibre', category: 'Devices',
    definition: 'Fibre with a core narrow enough that light takes one path, avoiding modal dispersion and reaching much further than multi-mode.',
    relatedTerms: ['fibre-optic', 'multi-mode'] },

  { id: 'multi-mode', term: 'Multi-mode fibre', category: 'Devices',
    definition: 'Fibre carrying several light paths at once. Cheaper to terminate, limited in distance by modal dispersion.',
    relatedTerms: ['fibre-optic', 'single-mode'] },

  { id: 'fdm', term: 'FDM', category: 'General',
    definition: 'Frequency Division Multiplexing. Each signal gets its own frequency band on a shared medium.',
    relatedTerms: ['tdm', 'wdm', 'multiplexing'] },

  { id: 'wdm', term: 'WDM', category: 'General',
    definition: 'Wavelength Division Multiplexing. FDM applied to light, letting one fibre carry many wavelengths at once.',
    relatedTerms: ['fdm', 'fibre-optic'] },

  { id: 'statistical-tdm', term: 'Statistical TDM', category: 'General',
    definition: 'Time slots allocated on demand rather than by fixed rotation, so an idle source wastes nothing.',
    relatedTerms: ['tdm', 'packet-switching'] },

  { id: 'circuit-switching', term: 'Circuit switching', category: 'General',
    definition: 'Reserving a dedicated end-to-end path for the whole session. Constant delay, capacity wasted when idle.',
    relatedTerms: ['packet-switching', 'virtual-circuit'] },

  { id: 'virtual-circuit', term: 'Virtual circuit', category: 'General',
    definition: 'A pre-established path that packets follow in order, without dedicating bandwidth to it.',
    relatedTerms: ['circuit-switching', 'datagram'] },

  { id: 'datagram', term: 'Datagram', category: 'General',
    definition: 'A packet routed independently, carrying full addressing and free to arrive out of order.',
    relatedTerms: ['virtual-circuit', 'ip'] },

  // ---------------------------------------------------------------- Data link

  { id: 'bit-stuffing', term: 'Bit stuffing', category: 'General',
    definition: 'Inserting a 0 after five consecutive 1s so the frame delimiter 01111110 can never appear inside the data. The receiver removes it.',
    examples: ['0111111010 is transmitted as 01111101010.'], relatedTerms: ['framing', 'frame'] },

  { id: 'framing', term: 'Framing', category: 'General',
    definition: 'Marking where one frame ends and the next begins in a continuous bit stream, by count, flags, stuffing or coding violations.',
    relatedTerms: ['frame', 'bit-stuffing'] },

  { id: 'parity', term: 'Parity bit', category: 'General',
    definition: 'A single bit making the count of 1s odd or even. Detects any odd number of errors and misses every even number.',
    relatedTerms: ['checksum', 'crc'] },

  { id: 'checksum', term: 'Checksum', category: 'General',
    definition: 'Error detection by summing data words and sending the complement of the total. Weaker than CRC, cheap to compute.',
    relatedTerms: ['crc', 'parity'] },

  { id: 'sliding-window', term: 'Sliding window', category: 'General',
    definition: 'Allowing several unacknowledged frames in flight at once, so a long link is not left idle waiting for each acknowledgement.',
    relatedTerms: ['go-back-n', 'selective-repeat', 'stop-and-wait'] },

  { id: 'stop-and-wait', term: 'Stop-and-Wait', category: 'General',
    definition: 'Send one frame, wait for its acknowledgement, then send the next. Correct, and painfully slow on high-delay links.',
    relatedTerms: ['sliding-window', 'arq'] },

  { id: 'go-back-n', term: 'Go-Back-N', category: 'General',
    definition: 'Sliding-window ARQ that retransmits the lost frame and every frame after it. Window size limited to 2^m - 1.',
    relatedTerms: ['selective-repeat', 'sliding-window'] },

  { id: 'selective-repeat', term: 'Selective Repeat', category: 'General',
    definition: 'Sliding-window ARQ that retransmits only the frames actually lost, needing receiver buffering and a window of at most 2^(m-1).',
    relatedTerms: ['go-back-n', 'sliding-window'] },

  { id: 'piggybacking', term: 'Piggybacking', category: 'General',
    definition: 'Carrying an acknowledgement inside a data frame travelling the other way, saving a separate frame.',
    relatedTerms: ['arq', 'sliding-window'] },

  { id: 'aloha', term: 'ALOHA', category: 'General',
    definition: 'The original random-access protocol: transmit when ready, detect collisions by the missing acknowledgement. Slotted ALOHA doubles efficiency to about 37%.',
    relatedTerms: ['csma-cd', 'csma-ca'] },

  { id: 'csma-ca', term: 'CSMA/CA', category: 'Protocols',
    definition: 'Carrier Sense Multiple Access with Collision Avoidance. Used by Wi-Fi, because a wireless node cannot hear a collision happening at the receiver.',
    relatedTerms: ['csma-cd', 'aloha'] },

  { id: 'token-passing', term: 'Token passing', category: 'General',
    definition: 'Controlled access where only the holder of a circulating token may transmit. No collisions, predictable delay.',
    relatedTerms: ['aloha', 'csma-cd'] },

  { id: 'bridge', term: 'Bridge', category: 'Devices',
    definition: 'A layer-2 device joining LAN segments, learning which addresses live on which port and forwarding rather than flooding.',
    relatedTerms: ['switch', 'spanning-tree'] },

  { id: 'spanning-tree', term: 'Spanning Tree Protocol', category: 'Protocols',
    definition: 'Disables redundant links until the layer-2 topology is loop-free. Necessary because frames carry no TTL, so a loop never clears itself.',
    relatedTerms: ['bridge', 'broadcast-storm'] },

  { id: 'broadcast-storm', term: 'Broadcast storm', category: 'General',
    definition: 'Broadcast frames circulating a layer-2 loop indefinitely, multiplying until the LAN is unusable.',
    relatedTerms: ['spanning-tree', 'broadcast-domain'] },

  { id: 'collision-domain', term: 'Collision domain', category: 'General',
    definition: 'The set of devices whose transmissions can collide. Every switch port is its own collision domain; a hub is one for everything attached.',
    relatedTerms: ['broadcast-domain', 'switch', 'hub'] },

  { id: 'broadcast-domain', term: 'Broadcast domain', category: 'General',
    definition: 'The set of devices a broadcast frame reaches. Switches forward broadcasts; only a router or VLAN boundary stops them.',
    relatedTerms: ['collision-domain', 'vlan'] },

  { id: 'vlan', term: 'VLAN', category: 'General',
    definition: 'Virtual LAN. Splits one physical switch into separate broadcast domains, so groups are isolated without extra hardware.',
    relatedTerms: ['broadcast-domain', 'switch'] },

  { id: 'mtu', term: 'MTU', category: 'General',
    definition: 'Maximum Transmission Unit. The largest payload a link will carry, 1500 bytes on standard Ethernet.',
    relatedTerms: ['frame', 'fragmentation'] },

  { id: 'fragmentation', term: 'Fragmentation', category: 'Addressing',
    definition: 'Splitting a packet too large for the next link. IPv4 routers may fragment; IPv6 pushes the job back to the sender.',
    relatedTerms: ['mtu', 'ipv6'] },

  // ---------------------------------------------------------------- Network layer

  { id: 'rarp', term: 'RARP', category: 'Protocols',
    definition: 'Reverse ARP. Finds a host its own IP address from its MAC, for diskless machines. Superseded by DHCP.',
    relatedTerms: ['arp', 'dhcp'] },

  { id: 'dhcp', term: 'DHCP', category: 'Protocols',
    definition: 'Dynamic Host Configuration Protocol. Leases an address, mask, gateway and DNS server to a client that arrives knowing nothing.',
    relatedTerms: ['ip', 'default-gateway'] },

  { id: 'icmp', term: 'ICMP', category: 'Protocols',
    definition: 'Internet Control Message Protocol. Carries the network layer\'s error reports and diagnostics; ping and traceroute are both ICMP.',
    relatedTerms: ['ip', 'ping'] },

  { id: 'ping', term: 'Ping', category: 'Protocols',
    definition: 'A reachability test sending an ICMP echo request and timing the reply.',
    relatedTerms: ['icmp', 'traceroute'] },

  { id: 'traceroute', term: 'Traceroute', category: 'Protocols',
    definition: 'Maps the path to a host by sending packets with increasing TTL and reading the ICMP time-exceeded message each router returns.',
    relatedTerms: ['icmp', 'ttl'] },

  { id: 'autonomous-system', term: 'Autonomous System', category: 'Routing',
    definition: 'A group of routers under one administration with a single routing policy. BGP routes between them; OSPF and RIP inside them.',
    relatedTerms: ['bgp', 'ospf'] },

  { id: 'count-to-infinity', term: 'Count-to-infinity', category: 'Routing',
    definition: 'Distance vector routers incrementing each other\'s stale distances after a failure, converging only when a defined infinity is reached.',
    relatedTerms: ['split-horizon', 'rip'] },

  { id: 'split-horizon', term: 'Split horizon', category: 'Routing',
    definition: 'Never advertising a route back out of the interface it was learned from. Limits count-to-infinity.',
    relatedTerms: ['count-to-infinity', 'rip'] },

  { id: 'link-state', term: 'Link state routing', category: 'Routing',
    definition: 'Every router floods a description of its own links, then computes shortest paths locally with Dijkstra. Fast convergence, higher memory.',
    relatedTerms: ['distance-vector', 'ospf', 'dijkstra'] },

  { id: 'distance-vector', term: 'Distance vector routing', category: 'Routing',
    definition: 'Each router tells its neighbours its whole distance table. Simple, slow to converge, vulnerable to count-to-infinity.',
    relatedTerms: ['link-state', 'rip'] },

  { id: 'leaky-bucket', term: 'Leaky bucket', category: 'General',
    definition: 'Traffic shaping to a constant output rate, discarding whatever overflows. Never permits a burst.',
    relatedTerms: ['token-bucket', 'congestion-control'] },

  { id: 'token-bucket', term: 'Token bucket', category: 'General',
    definition: 'Traffic shaping that accumulates credit while idle, so a burst may be sent later. The difference from leaky bucket is exactly that burst.',
    relatedTerms: ['leaky-bucket', 'qos'] },

  { id: 'supernetting', term: 'Supernetting', category: 'Addressing',
    definition: 'Combining contiguous network blocks into one shorter prefix so routing tables carry fewer entries.',
    relatedTerms: ['cidr', 'subnet-mask'] },

  // ---------------------------------------------------------------- Transport & application

  { id: 'qos', term: 'Quality of Service', category: 'Transport',
    definition: 'Treating traffic differently according to its needs, described by reliability, delay, jitter and bandwidth.',
    relatedTerms: ['diffserv', 'jitter'] },

  { id: 'diffserv', term: 'DiffServ', category: 'Transport',
    definition: 'Differentiated Services. Marks packets into a few classes handled differently at each hop. Scales, unlike per-flow reservation.',
    relatedTerms: ['qos', 'intserv'] },

  { id: 'intserv', term: 'IntServ', category: 'Transport',
    definition: 'Integrated Services. Reserves resources per flow before sending, which gives strong guarantees and does not scale.',
    relatedTerms: ['qos', 'diffserv'] },

  { id: 'flow-control', term: 'Flow control', category: 'Transport',
    definition: 'Stopping a fast sender from overwhelming a slow receiver, driven by the receiver\'s advertised window. Not the same as congestion control.',
    relatedTerms: ['congestion-control', 'sliding-window'] },

  { id: 'mss', term: 'MSS', category: 'Transport',
    definition: 'Maximum Segment Size. The largest payload TCP will put in one segment, derived from the link MTU.',
    relatedTerms: ['mtu', 'tcp'] },

  { id: 'smtp', term: 'SMTP', category: 'Application Layer',
    definition: 'Simple Mail Transfer Protocol, port 25. Pushes mail from client to server and between servers.',
    relatedTerms: ['pop3', 'imap'] },

  { id: 'pop3', term: 'POP3', category: 'Application Layer',
    definition: 'Post Office Protocol v3, port 110. Downloads mail to one device and typically deletes the server copy.',
    relatedTerms: ['smtp', 'imap'] },

  { id: 'imap', term: 'IMAP', category: 'Application Layer',
    definition: 'Internet Message Access Protocol, port 143. Keeps mail on the server and synchronises state across devices.',
    relatedTerms: ['pop3', 'smtp'] },

  { id: 'ftp', term: 'FTP', category: 'Application Layer',
    definition: 'File Transfer Protocol. Uses two connections: control on port 21 and data on port 20, which is what makes it awkward through firewalls.',
    relatedTerms: ['telnet', 'ssh'] },

  { id: 'telnet', term: 'Telnet', category: 'Application Layer',
    definition: 'Remote terminal access on port 23, in clear text including passwords. Replaced by SSH for that reason.',
    relatedTerms: ['ssh', 'ftp'] },

  { id: 'ssh', term: 'SSH', category: 'Application Layer',
    definition: 'Secure Shell, port 22. Encrypted remote login and file transfer, the replacement for Telnet.',
    relatedTerms: ['telnet', 'encryption'] },

  { id: 'snmp', term: 'SNMP', category: 'Application Layer',
    definition: 'Simple Network Management Protocol. Lets a manager poll and configure devices through their management information base.',
    relatedTerms: ['udp'] },

  { id: 'mime', term: 'MIME', category: 'Application Layer',
    definition: 'Multipurpose Internet Mail Extensions. Lets mail carry attachments and non-ASCII text.',
    relatedTerms: ['smtp'] },

  { id: 'cookie', term: 'Cookie', category: 'Application Layer',
    definition: 'A value the server stores in the browser and receives back on later requests, giving continuity to a stateless protocol.',
    relatedTerms: ['http'] },

  { id: 'status-code', term: 'HTTP status code', category: 'Application Layer',
    definition: 'Three digits classifying a response: 1xx informational, 2xx success, 3xx redirect, 4xx client error, 5xx server error.',
    examples: ['404 is the client asking for something absent; 500 is the server failing.'], relatedTerms: ['http'] },

  { id: 'url', term: 'URL', category: 'Application Layer',
    definition: 'Uniform Resource Locator. Scheme, host, optional port and path identifying a resource and how to fetch it.',
    relatedTerms: ['http', 'dns'] },

  { id: 'data-compression', term: 'Data compression', category: 'General',
    definition: 'Encoding data in fewer bits. Lossless compression restores the original exactly; lossy trades fidelity for size.',
    relatedTerms: ['bandwidth'] },

  // ---------------------------------------------------------------- Security

  { id: 'symmetric-encryption', term: 'Symmetric encryption', category: 'Security',
    definition: 'One shared secret key encrypts and decrypts. Fast enough for bulk data; distributing the key is the hard part.',
    examples: ['AES and DES.'], relatedTerms: ['asymmetric-encryption', 'aes'] },

  { id: 'asymmetric-encryption', term: 'Asymmetric encryption', category: 'Security',
    definition: 'A public key encrypts and a private key decrypts. Slow, so it is used to exchange a symmetric key rather than the data itself.',
    examples: ['RSA.'], relatedTerms: ['symmetric-encryption', 'rsa'] },

  { id: 'rsa', term: 'RSA', category: 'Security',
    definition: 'The public-key algorithm whose security rests on the difficulty of factoring the product of two large primes.',
    relatedTerms: ['asymmetric-encryption', 'digital-signature'] },

  { id: 'aes', term: 'AES', category: 'Security',
    definition: 'Advanced Encryption Standard. The symmetric block cipher that replaced DES, with 128, 192 or 256-bit keys.',
    relatedTerms: ['symmetric-encryption', 'encryption'] },

  { id: 'hashing', term: 'Hash function', category: 'Security',
    definition: 'A one-way function producing a fixed-length digest. Provides integrity, not confidentiality, and cannot be reversed.',
    examples: ['MD5 and the SHA family.'], relatedTerms: ['digital-signature', 'integrity'] },

  { id: 'digital-signature', term: 'Digital signature', category: 'Security',
    definition: 'A hash of the message encrypted with the sender\'s private key. Gives authentication, integrity and non-repudiation together.',
    relatedTerms: ['hashing', 'certificate', 'rsa'] },

  { id: 'certificate', term: 'Digital certificate', category: 'Security',
    definition: 'A public key bound to an identity and vouched for by a certificate authority. What stops an attacker supplying their own key.',
    relatedTerms: ['digital-signature', 'tls'] },

  { id: 'integrity', term: 'Integrity', category: 'Security',
    definition: 'The assurance that data arrived unaltered, and that alteration would have been detected.',
    relatedTerms: ['hashing', 'non-repudiation'] },

  { id: 'non-repudiation', term: 'Non-repudiation', category: 'Security',
    definition: 'The sender cannot later deny having sent the message. Provided by digital signatures, not by encryption alone.',
    relatedTerms: ['digital-signature', 'integrity'] },

  { id: 'mitm', term: 'Man-in-the-middle', category: 'Security',
    definition: 'An attacker relaying and possibly altering traffic while both ends believe they talk directly. Certificates exist to defeat it.',
    relatedTerms: ['certificate', 'encryption'] },

  { id: 'phishing', term: 'Phishing', category: 'Security',
    definition: 'Tricking a person into surrendering credentials by impersonating something they trust. Attacks the user, not the protocol.',
    relatedTerms: ['mitm'] },

  { id: 'spoofing', term: 'Spoofing', category: 'Security',
    definition: 'Forging a source address so traffic appears to come from somewhere trusted.',
    relatedTerms: ['ddos', 'mitm'] },
];
