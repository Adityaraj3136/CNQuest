/**
 * Third dictionary bank.
 *
 * Fills the gaps the first two left: signalling and encoding, the vocabulary of medium access,
 * the parts of an IP and TCP header a student is asked to name, and the remaining application
 * and security terms.
 */

import type { DictionaryTerm } from '../models/content.ts';

export const DICTIONARY_EXTRA2: readonly DictionaryTerm[] = [
  // ---------------------------------------------------------------- signalling

  { id: 'analog-signal', term: 'Analog signal', category: 'General',
    definition: 'A continuously varying signal. Infinitely many values between two points, unlike a digital signal which steps between levels.',
    relatedTerms: ['digital-signal', 'modulation'] },

  { id: 'digital-signal', term: 'Digital signal', category: 'General',
    definition: 'A signal taking a finite set of levels. Two levels carry one bit each; more levels carry more bits per change but tolerate less noise.',
    relatedTerms: ['analog-signal', 'nyquist-rate'] },

  { id: 'modulation', term: 'Modulation', category: 'General',
    definition: 'Altering a carrier wave by amplitude, frequency or phase so it carries data.',
    examples: ['ASK, FSK and PSK.'], relatedTerms: ['analog-signal', 'bandwidth'] },

  { id: 'manchester', term: 'Manchester encoding', category: 'General',
    definition: 'Line coding where every bit contains a mid-bit transition, so the receiver recovers the clock from the data itself.',
    relatedTerms: ['digital-signal', 'ethernet'] },

  { id: 'baud-rate', term: 'Baud rate', category: 'General',
    definition: 'Signal changes per second. Equal to bit rate only when each change carries exactly one bit.',
    relatedTerms: ['bandwidth', 'nyquist-rate'] },

  { id: 'crosstalk', term: 'Crosstalk', category: 'General',
    definition: 'Signal from one conductor bleeding into a neighbouring one. Twisting the pair is the cheap defence.',
    relatedTerms: ['noise', 'twisted-pair'] },

  { id: 'repeater', term: 'Repeater', category: 'Devices',
    definition: 'A layer-1 device that regenerates a signal to extend a segment. It understands nothing above voltage.',
    relatedTerms: ['hub', 'attenuation'] },

  { id: 'transceiver', term: 'Transceiver', category: 'Devices',
    definition: 'The component that both transmits and receives on a medium.',
    relatedTerms: ['nic'] },

  { id: 'simplex-duplex', term: 'Half duplex', category: 'General',
    definition: 'Both ends may transmit, but only one at a time. Classic shared Ethernet and walkie-talkies work this way.',
    relatedTerms: ['full-duplex', 'csma-cd'] },

  // ---------------------------------------------------------------- link layer

  { id: 'preamble', term: 'Preamble', category: 'General',
    definition: 'The alternating bit pattern at the start of an Ethernet frame that lets the receiver synchronise its clock.',
    relatedTerms: ['ethernet', 'frame'] },

  { id: 'backoff', term: 'Backoff', category: 'General',
    definition: 'Waiting a random interval after a collision so the colliding stations do not retry together. Ethernet doubles the range each attempt.',
    relatedTerms: ['csma-cd', 'collision-domain'] },

  { id: 'hidden-terminal', term: 'Hidden terminal problem', category: 'General',
    definition: 'Two wireless stations that cannot hear each other but both reach the access point, so they collide at the receiver without ever detecting it.',
    relatedTerms: ['csma-ca'] },

  { id: 'polling', term: 'Polling', category: 'General',
    definition: 'Controlled access where a primary station invites each secondary in turn to transmit.',
    relatedTerms: ['token-passing', 'aloha'] },

  { id: 'ppp', term: 'PPP', category: 'Protocols',
    definition: 'Point-to-Point Protocol. Framing, authentication and link configuration for a direct link between two nodes.',
    relatedTerms: ['framing'] },

  { id: 'switching-table', term: 'Switching table', category: 'Devices',
    definition: 'The map of MAC address to port a switch builds by watching source addresses. Entries age out so a moved device is relearned.',
    relatedTerms: ['bridge', 'mac-address'] },

  { id: 'store-and-forward', term: 'Store and forward', category: 'General',
    definition: 'Receiving a whole frame and checking it before sending it on. Adds delay, but corrupt frames never propagate.',
    relatedTerms: ['switch', 'crc'] },

  // ---------------------------------------------------------------- network layer

  { id: 'ttl-field', term: 'Hop limit', category: 'Addressing',
    definition: 'The IPv6 name for the field IPv4 calls TTL. Decremented per hop; at zero the packet is discarded and ICMP reports it.',
    relatedTerms: ['ttl', 'traceroute'] },

  { id: 'header-checksum', term: 'Header checksum', category: 'Addressing',
    definition: 'The IPv4 field verifying the header at every hop. IPv6 removed it, because layer 2 and layer 4 already check.',
    relatedTerms: ['ipv6', 'checksum'] },

  { id: 'default-route', term: 'Default route', category: 'Routing',
    definition: 'The 0.0.0.0/0 entry used when nothing more specific matches. The way out of a network that knows little about the world.',
    relatedTerms: ['default-gateway', 'routing-table'] },

  { id: 'routing-table', term: 'Routing table', category: 'Routing',
    definition: 'The set of destination prefixes and next hops a router consults per packet. Longest prefix wins.',
    relatedTerms: ['default-route', 'cidr'] },

  { id: 'longest-prefix', term: 'Longest prefix match', category: 'Routing',
    definition: 'The rule that the most specific matching route is chosen, so a /24 beats a /16 for the same address.',
    relatedTerms: ['routing-table', 'cidr'] },

  { id: 'hold-down', term: 'Hold-down timer', category: 'Routing',
    definition: 'A period after a route fails during which worse news about it is ignored, so stale information cannot revive it.',
    relatedTerms: ['count-to-infinity', 'split-horizon'] },

  { id: 'poison-reverse', term: 'Poison reverse', category: 'Routing',
    definition: 'Advertising a failed route back with an infinite metric, stating the failure outright rather than staying silent.',
    relatedTerms: ['split-horizon', 'count-to-infinity'] },

  { id: 'multicast', term: 'Multicast', category: 'Addressing',
    definition: 'Delivery to a group of interested receivers. One copy travels each link rather than one per recipient.',
    relatedTerms: ['broadcast-address', 'ip'] },

  { id: 'anycast', term: 'Anycast', category: 'Addressing',
    definition: 'One address advertised from many places; the packet goes to the nearest. How large DNS and CDN services stay close to users.',
    relatedTerms: ['multicast', 'bgp'] },

  { id: 'mtu-discovery', term: 'Path MTU discovery', category: 'Addressing',
    definition: 'Finding the smallest MTU along a path by sending unfragmentable packets and reading the ICMP replies.',
    relatedTerms: ['mtu', 'icmp'] },

  // ---------------------------------------------------------------- transport

  { id: 'seq-number', term: 'Sequence number', category: 'Transport',
    definition: 'The byte offset TCP assigns so a receiver can order data and spot what is missing. It counts bytes, not segments.',
    relatedTerms: ['tcp', 'sliding-window'] },

  { id: 'ack-number', term: 'Acknowledgement number', category: 'Transport',
    definition: 'The next byte a TCP receiver expects. Cumulative: it confirms everything before it arrived.',
    relatedTerms: ['seq-number', 'tcp'] },

  { id: 'rto', term: 'Retransmission timeout', category: 'Transport',
    definition: 'How long TCP waits before resending, derived from measured round trip time and its variation rather than fixed.',
    relatedTerms: ['rtt', 'tcp'] },

  { id: 'nagle', term: "Nagle's algorithm", category: 'Transport',
    definition: 'Holds small outgoing writes until the previous data is acknowledged, so a connection does not fill with tiny segments.',
    relatedTerms: ['tcp', 'mss'] },

  { id: 'silly-window', term: 'Silly window syndrome', category: 'Transport',
    definition: 'A degenerate state where tiny window updates cause tiny segments, wasting most of every packet on headers.',
    relatedTerms: ['flow-control', 'nagle'] },

  { id: 'sack', term: 'Selective acknowledgement', category: 'Transport',
    definition: 'A TCP option letting the receiver report exactly which blocks arrived, so the sender resends only the gaps.',
    relatedTerms: ['ack-number', 'selective-repeat'] },

  { id: 'ephemeral-port', term: 'Ephemeral port', category: 'Transport',
    definition: 'A short-lived source port the operating system assigns to a client, taken from the 49152 to 65535 range.',
    relatedTerms: ['port', 'socket'] },

  { id: 'three-way-close', term: 'Four-way handshake', category: 'Transport',
    definition: 'TCP connection release. Each direction is closed independently with its own FIN and ACK, which is why it takes four segments.',
    relatedTerms: ['three-way-handshake', 'tcp'] },

  // ---------------------------------------------------------------- application

  { id: 'root-server', term: 'Root name server', category: 'Application Layer',
    definition: 'The servers at the top of the DNS tree. They answer with referrals to top-level domain servers rather than final addresses.',
    relatedTerms: ['dns', 'recursive-query'] },

  { id: 'recursive-query', term: 'Recursive query', category: 'Application Layer',
    definition: 'A request that the server do all the work and return a final answer, rather than a referral to ask elsewhere.',
    relatedTerms: ['dns', 'ttl'] },

  { id: 'zone-transfer', term: 'Zone transfer', category: 'Application Layer',
    definition: 'Copying a zone from a primary name server to a secondary. Uses TCP, because the data exceeds one datagram.',
    relatedTerms: ['dns', 'root-server'] },

  { id: 'keep-alive', term: 'Persistent connection', category: 'Application Layer',
    definition: 'Reusing one TCP connection for several HTTP requests, avoiding a handshake per resource.',
    relatedTerms: ['http', 'three-way-handshake'] },

  { id: 'proxy', term: 'Proxy server', category: 'Application Layer',
    definition: 'An intermediary that forwards requests on a client behalf, often caching responses or filtering them.',
    relatedTerms: ['http', 'firewall'] },

  { id: 'cdn', term: 'CDN', category: 'Application Layer',
    definition: 'Content Delivery Network. Copies of content held near users so requests travel a short distance.',
    relatedTerms: ['anycast', 'proxy'] },

  { id: 'webmail', term: 'Webmail', category: 'Application Layer',
    definition: 'Reading mail through HTTP while the server still speaks SMTP, POP3 or IMAP behind it.',
    relatedTerms: ['smtp', 'imap'] },

  { id: 'mib', term: 'MIB', category: 'Application Layer',
    definition: 'Management Information Base. The tree of values SNMP can read or set on a managed device.',
    relatedTerms: ['snmp'] },

  { id: 'lossless', term: 'Lossless compression', category: 'General',
    definition: 'Compression that restores the original exactly. Required for text, code and archives.',
    relatedTerms: ['data-compression', 'lossy'] },

  { id: 'lossy', term: 'Lossy compression', category: 'General',
    definition: 'Compression that discards detail people are unlikely to notice, trading fidelity for size. Used for images, audio and video.',
    relatedTerms: ['data-compression', 'lossless'] },

  // ---------------------------------------------------------------- security

  { id: 'des', term: 'DES', category: 'Security',
    definition: 'Data Encryption Standard. A 56-bit symmetric cipher, now broken by brute force and replaced by AES.',
    relatedTerms: ['aes', 'symmetric-encryption'] },

  { id: 'key-exchange', term: 'Key exchange', category: 'Security',
    definition: 'Agreeing a shared secret over a channel someone may be watching. The problem public key cryptography exists to solve.',
    relatedTerms: ['asymmetric-encryption', 'rsa'] },

  { id: 'session-key', term: 'Session key', category: 'Security',
    definition: 'A symmetric key used for one conversation and then discarded, agreed using public key cryptography.',
    relatedTerms: ['key-exchange', 'tls'] },

  { id: 'authentication', term: 'Authentication', category: 'Security',
    definition: 'Establishing that a party is who they claim to be, as distinct from authorisation, which is what they may then do.',
    relatedTerms: ['digital-signature', 'certificate'] },

  { id: 'replay-attack', term: 'Replay attack', category: 'Security',
    definition: 'Capturing valid traffic and sending it again later. Defeated by nonces, timestamps or sequence numbers.',
    relatedTerms: ['mitm', 'spoofing'] },

  { id: 'dos', term: 'Denial of service', category: 'Security',
    definition: 'Exhausting a resource so legitimate users cannot be served. Attacks availability alone, reading and altering nothing.',
    relatedTerms: ['ddos', 'integrity'] },

  { id: 'ips', term: 'IPS', category: 'Security',
    definition: 'Intrusion Prevention System. Detects malicious traffic like an IDS and blocks it inline rather than only reporting.',
    relatedTerms: ['ids', 'firewall'] },

  { id: 'packet-filter', term: 'Packet filtering', category: 'Security',
    definition: 'Firewall rules applied per packet on addresses, ports and flags, with no memory of the connection.',
    relatedTerms: ['stateful-firewall', 'firewall'] },

  { id: 'stateful-firewall', term: 'Stateful firewall', category: 'Security',
    definition: 'A firewall tracking connection state, so replies to a permitted outbound request are allowed without a matching inbound rule.',
    relatedTerms: ['packet-filter', 'firewall'] },

  { id: 'ipsec', term: 'IPsec', category: 'Security',
    definition: 'Authentication and encryption at the network layer, so every protocol above is protected without changing any of them.',
    relatedTerms: ['vpn', 'encryption'] },
];
