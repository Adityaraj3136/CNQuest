/**
 * Networking dictionary.
 *
 * SEED DATA. Ids are referenced by `Topic.relatedTerms`, so keep them stable.
 */

import type { DictionaryTerm } from '../models/content.ts';

export const DICTIONARY: readonly DictionaryTerm[] = [
  { id: 'protocol', term: 'Protocol', category: 'General',
    definition: 'An agreed set of rules governing communication, covering syntax, semantics and timing.',
    examples: ['HTTP, TCP and IP are all protocols.'], relatedTerms: ['tcp-ip'] },

  { id: 'lan', term: 'LAN', category: 'General',
    definition: 'Local Area Network — a privately owned network covering a limited area such as a building or campus.',
    relatedTerms: ['wan', 'switch'] },

  { id: 'wan', term: 'WAN', category: 'General',
    definition: 'Wide Area Network — a network spanning cities or countries, usually built on leased links.',
    relatedTerms: ['lan', 'router'] },

  { id: 'bandwidth', term: 'Bandwidth', category: 'General',
    definition: 'The maximum data rate a channel can carry, measured in bits per second.',
    relatedTerms: ['latency'] },

  { id: 'latency', term: 'Latency', category: 'General',
    definition: 'The time taken for data to travel from sender to receiver, usually measured in milliseconds.',
    relatedTerms: ['bandwidth', 'rtt'] },

  { id: 'rtt', term: 'RTT', category: 'Transport',
    definition: 'Round Trip Time — the delay between sending data and receiving its acknowledgement.',
    relatedTerms: ['latency', 'tcp'] },

  { id: 'topology', term: 'Topology', category: 'General',
    definition: 'The arrangement of devices and links in a network — bus, star, ring, mesh or hybrid.',
    examples: ['A switched LAN is physically a star.'] },

  { id: 'osi-model', term: 'OSI Model', category: 'OSI',
    definition: 'A seven-layer reference model from ISO describing how communication functions are divided.',
    examples: ['Layer 3 is Network; Layer 4 is Transport.'], relatedTerms: ['tcp-ip', 'encapsulation'] },

  { id: 'tcp-ip', term: 'TCP/IP Model', category: 'OSI',
    definition: 'The four-layer model the Internet implements: Application, Transport, Internet and Network Access.',
    relatedTerms: ['osi-model', 'ip'] },

  { id: 'encapsulation', term: 'Encapsulation', category: 'OSI',
    definition: 'Wrapping data with a header at each layer as it moves down the protocol stack.',
    relatedTerms: ['osi-model', 'frame'] },

  { id: 'router', term: 'Router', category: 'Devices',
    definition: 'A Layer 3 device that forwards packets between different networks using a routing table.',
    relatedTerms: ['switch', 'ip', 'default-gateway'] },

  { id: 'switch', term: 'Switch', category: 'Devices',
    definition: 'A Layer 2 device that learns MAC addresses and forwards frames only to the correct port.',
    relatedTerms: ['hub', 'mac-address', 'router'] },

  { id: 'hub', term: 'Hub', category: 'Devices',
    definition: 'A Layer 1 device that repeats an incoming signal to every other port, sharing one collision domain.',
    relatedTerms: ['switch'] },

  { id: 'nic', term: 'NIC', category: 'Devices',
    definition: 'Network Interface Card — the hardware that connects a host to the network and carries its MAC address.',
    relatedTerms: ['mac-address'] },

  { id: 'mac-address', term: 'MAC Address', category: 'Addressing',
    definition: 'A 48-bit hardware address burned into a network interface, written as 12 hexadecimal digits.',
    examples: ['00:1A:2B:3C:4D:5E'], relatedTerms: ['switch', 'arp'] },

  { id: 'ip', term: 'IP', category: 'Protocols',
    definition: 'Internet Protocol — the connectionless, best-effort Layer 3 protocol that addresses and routes packets.',
    relatedTerms: ['ipv4', 'ipv6', 'router'] },

  { id: 'ipv4', term: 'IPv4', category: 'Addressing',
    definition: 'A 32-bit addressing scheme written as four dotted decimal octets.',
    examples: ['192.168.1.1'], relatedTerms: ['ipv6', 'subnet-mask', 'nat'] },

  { id: 'ipv6', term: 'IPv6', category: 'Addressing',
    definition: 'A 128-bit addressing scheme written as eight groups of hexadecimal digits, with no broadcast.',
    examples: ['2001:0db8:85a3::8a2e:0370:7334'], relatedTerms: ['ipv4'] },

  { id: 'subnet-mask', term: 'Subnet Mask', category: 'Addressing',
    definition: 'A 32-bit value that separates the network portion of an IP address from the host portion.',
    examples: ['255.255.255.0 equals /24.'], relatedTerms: ['cidr', 'vlsm', 'broadcast-address'] },

  { id: 'cidr', term: 'CIDR', category: 'Addressing',
    definition: 'Classless Inter-Domain Routing — writing addresses as a.b.c.d/prefix instead of using classes.',
    examples: ['10.0.0.0/8'], relatedTerms: ['subnet-mask', 'vlsm'] },

  { id: 'vlsm', term: 'VLSM', category: 'Addressing',
    definition: 'Variable Length Subnet Masking — using different prefix lengths within one address block.',
    relatedTerms: ['subnet-mask', 'cidr'] },

  { id: 'broadcast-address', term: 'Broadcast Address', category: 'Addressing',
    definition: 'The address with all host bits set to 1, reaching every host on that subnet.',
    examples: ['For 192.168.1.0/24 it is 192.168.1.255.'], relatedTerms: ['subnet-mask'] },

  { id: 'default-gateway', term: 'Default Gateway', category: 'Routing',
    definition: 'The router a host sends packets to when the destination is outside its own subnet.',
    relatedTerms: ['router', 'ip'] },

  { id: 'nat', term: 'NAT', category: 'Addressing',
    definition: 'Network Address Translation — rewriting private addresses to a public one so many hosts can share it.',
    relatedTerms: ['ipv4'] },

  { id: 'arp', term: 'ARP', category: 'Protocols',
    definition: 'Address Resolution Protocol — finds the MAC address matching a known IPv4 address on a LAN.',
    relatedTerms: ['mac-address', 'ipv4'] },

  { id: 'rip', term: 'RIP', category: 'Routing',
    definition: 'Routing Information Protocol — a distance-vector protocol using hop count, with a maximum of 15 hops.',
    relatedTerms: ['ospf', 'bgp'] },

  { id: 'ospf', term: 'OSPF', category: 'Routing',
    definition: 'Open Shortest Path First — a link-state interior protocol that runs Dijkstra’s algorithm over a topology map.',
    relatedTerms: ['rip', 'dijkstra'] },

  { id: 'bgp', term: 'BGP', category: 'Routing',
    definition: 'Border Gateway Protocol — the path-vector protocol that routes between autonomous systems.',
    relatedTerms: ['ospf', 'rip'] },

  { id: 'dijkstra', term: 'Dijkstra’s Algorithm', category: 'Routing',
    definition: 'A shortest-path algorithm that grows a tree of least-cost paths from a source node.',
    relatedTerms: ['ospf'] },

  { id: 'tcp', term: 'TCP', category: 'Transport',
    definition: 'Transmission Control Protocol — connection-oriented, reliable, ordered byte-stream delivery.',
    relatedTerms: ['udp', 'three-way-handshake', 'port'] },

  { id: 'udp', term: 'UDP', category: 'Transport',
    definition: 'User Datagram Protocol — connectionless, unreliable transport with an 8-byte header.',
    relatedTerms: ['tcp', 'port'] },

  { id: 'three-way-handshake', term: 'Three-Way Handshake', category: 'Transport',
    definition: 'The SYN, SYN-ACK, ACK exchange that establishes a TCP connection.',
    relatedTerms: ['tcp'] },

  { id: 'port', term: 'Port Number', category: 'Transport',
    definition: 'A 16-bit number identifying an application endpoint; 0-1023 are well known.',
    examples: ['80 for HTTP, 443 for HTTPS, 53 for DNS.'], relatedTerms: ['socket', 'tcp'] },

  { id: 'socket', term: 'Socket', category: 'Transport',
    definition: 'The combination of an IP address and a port number, identifying one endpoint of a connection.',
    relatedTerms: ['port', 'tcp'] },

  { id: 'congestion-control', term: 'Congestion Control', category: 'Transport',
    definition: 'Mechanisms that stop a sender from overloading the network, as opposed to overloading the receiver.',
    relatedTerms: ['slow-start', 'aimd', 'tcp'] },

  { id: 'slow-start', term: 'Slow Start', category: 'Transport',
    definition: 'The TCP phase where the congestion window doubles each round trip until the threshold is reached.',
    relatedTerms: ['congestion-control', 'aimd'] },

  { id: 'aimd', term: 'AIMD', category: 'Transport',
    definition: 'Additive Increase, Multiplicative Decrease — TCP’s fair way of probing for available bandwidth.',
    relatedTerms: ['congestion-control'] },

  { id: 'frame', term: 'Frame', category: 'OSI',
    definition: 'The Layer 2 protocol data unit — a packet wrapped in a data link header and trailer.',
    relatedTerms: ['crc', 'encapsulation'] },

  { id: 'crc', term: 'CRC', category: 'General',
    definition: 'Cyclic Redundancy Check — polynomial-division error detection appended to a frame.',
    relatedTerms: ['frame', 'hamming-code'] },

  { id: 'hamming-code', term: 'Hamming Code', category: 'General',
    definition: 'An error-correcting code whose redundant bits locate and fix a single-bit error.',
    relatedTerms: ['crc', 'arq'] },

  { id: 'arq', term: 'ARQ', category: 'General',
    definition: 'Automatic Repeat reQuest — error recovery by retransmission: Stop-and-Wait, Go-Back-N or Selective Repeat.',
    relatedTerms: ['crc'] },

  { id: 'csma-cd', term: 'CSMA/CD', category: 'Protocols',
    definition: 'Carrier Sense Multiple Access with Collision Detection — the access method of classic shared Ethernet.',
    relatedTerms: ['ethernet', 'mac-address'] },

  { id: 'ethernet', term: 'Ethernet', category: 'Protocols',
    definition: 'The dominant wired LAN family (IEEE 802.3), using MAC addressing and a CRC-protected frame.',
    relatedTerms: ['switch', 'csma-cd', 'mac-address'] },

  { id: 'packet-switching', term: 'Packet Switching', category: 'General',
    definition: 'Splitting data into packets routed independently, sharing links efficiently without reservation.',
    relatedTerms: ['multiplexing'] },

  { id: 'multiplexing', term: 'Multiplexing', category: 'General',
    definition: 'Combining several signals onto one medium, by frequency (FDM), time (TDM) or wavelength (WDM).',
    relatedTerms: ['tdm', 'packet-switching'] },

  { id: 'tdm', term: 'TDM', category: 'General',
    definition: 'Time Division Multiplexing — each source gets the whole channel during its own time slot.',
    relatedTerms: ['multiplexing'] },

  { id: 'twisted-pair', term: 'Twisted Pair', category: 'General',
    definition: 'Copper cable whose pairs are twisted to cancel crosstalk; the standard LAN cabling.',
    relatedTerms: ['fibre-optic', 'attenuation'] },

  { id: 'fibre-optic', term: 'Optical Fibre', category: 'General',
    definition: 'A glass or plastic strand carrying data as light, offering huge bandwidth and immunity to EMI.',
    relatedTerms: ['twisted-pair', 'attenuation'] },

  { id: 'attenuation', term: 'Attenuation', category: 'General',
    definition: 'The weakening of a signal as it travels through a medium.',
    relatedTerms: ['twisted-pair'] },

  { id: 'dns', term: 'DNS', category: 'Application Layer',
    definition: 'Domain Name System — the distributed hierarchy that resolves names to IP addresses, usually over UDP 53.',
    examples: ['An A record maps a name to IPv4.'], relatedTerms: ['ttl', 'udp'] },

  { id: 'ttl', term: 'TTL', category: 'Application Layer',
    definition: 'Time To Live — how long a DNS record may be cached, or the hop limit carried in an IP header.',
    relatedTerms: ['dns', 'ip'] },

  { id: 'http', term: 'HTTP', category: 'Application Layer',
    definition: 'HyperText Transfer Protocol — the stateless request-response protocol of the web, on TCP port 80.',
    relatedTerms: ['https', 'port'] },

  { id: 'https', term: 'HTTPS', category: 'Application Layer',
    definition: 'HTTP carried inside a TLS session on port 443, adding confidentiality and server authentication.',
    relatedTerms: ['http', 'tls'] },

  { id: 'tls', term: 'TLS', category: 'Security',
    definition: 'Transport Layer Security — the protocol encrypting data between client and server, successor to SSL.',
    relatedTerms: ['https', 'encryption'] },

  { id: 'encryption', term: 'Encryption', category: 'Security',
    definition: 'Transforming data so only a holder of the correct key can read it; symmetric or asymmetric.',
    relatedTerms: ['tls', 'firewall'] },

  { id: 'firewall', term: 'Firewall', category: 'Security',
    definition: 'A device or program filtering traffic against a rule set; stateful firewalls track connections.',
    relatedTerms: ['dmz', 'ids'] },

  { id: 'dmz', term: 'DMZ', category: 'Security',
    definition: 'A perimeter network hosting public servers, isolating them from the internal LAN.',
    relatedTerms: ['firewall'] },

  { id: 'ids', term: 'IDS', category: 'Security',
    definition: 'Intrusion Detection System — monitors traffic and raises alerts on suspicious patterns.',
    relatedTerms: ['firewall'] },

  { id: 'vpn', term: 'VPN', category: 'Security',
    definition: 'Virtual Private Network — an encrypted tunnel carrying private traffic across a public network.',
    relatedTerms: ['encryption', 'tls'] },

  { id: 'ddos', term: 'DDoS', category: 'Security',
    definition: 'Distributed Denial of Service — many hosts flooding a target to exhaust its resources.',
    relatedTerms: ['firewall'] },
];
