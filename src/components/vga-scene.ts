/**
 * The VGA overworld scene: router, relay towers and the OSI fortress joined by a packet route.
 * Shared by the landing hero and the auth screens so the signature art is drawn in one place.
 * Purely decorative: callers own the accessible label.
 */
export function vgaSceneSvg(): string {
  return `
        <svg class="cn-vga-world__scene" viewBox="0 0 800 460" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
          <rect width="800" height="460" fill="#55a8ff" />

          <g fill="#dff6ff">
            <rect x="66" y="62" width="116" height="24" />
            <rect x="90" y="38" width="68" height="24" />
            <rect x="594" y="76" width="132" height="24" />
            <rect x="626" y="52" width="64" height="24" />
          </g>

          <path d="M0 292 L92 178 L166 254 L258 126 L366 270 L454 184 L564 276 L678 134 L800 266 L800 360 L0 360 Z" fill="#237aa1" />
          <path d="M0 320 L112 236 L218 318 L326 218 L448 322 L562 240 L674 316 L800 220 L800 372 L0 372 Z" fill="#37b58c" />

          <g fill="#0d3345">
            <rect x="0" y="354" width="800" height="106" />
            <rect x="0" y="338" width="800" height="16" fill="#65d46e" />
            <rect x="0" y="370" width="800" height="8" fill="#164e5e" />
            <rect x="0" y="402" width="800" height="8" fill="#164e5e" />
            <rect x="54" y="354" width="8" height="106" fill="#164e5e" />
            <rect x="118" y="354" width="8" height="106" fill="#164e5e" />
            <rect x="182" y="354" width="8" height="106" fill="#164e5e" />
            <rect x="246" y="354" width="8" height="106" fill="#164e5e" />
            <rect x="310" y="354" width="8" height="106" fill="#164e5e" />
            <rect x="374" y="354" width="8" height="106" fill="#164e5e" />
            <rect x="438" y="354" width="8" height="106" fill="#164e5e" />
            <rect x="502" y="354" width="8" height="106" fill="#164e5e" />
            <rect x="566" y="354" width="8" height="106" fill="#164e5e" />
            <rect x="630" y="354" width="8" height="106" fill="#164e5e" />
            <rect x="694" y="354" width="8" height="106" fill="#164e5e" />
            <rect x="758" y="354" width="8" height="106" fill="#164e5e" />
          </g>

          <g class="cn-vga-world__router">
            <rect x="38" y="286" width="86" height="52" fill="#f2f4e8" />
            <rect x="46" y="294" width="70" height="26" fill="#15233a" />
            <rect x="54" y="301" width="8" height="8" fill="#55e6c1" />
            <rect x="70" y="301" width="8" height="8" fill="#ffd447" />
            <rect x="86" y="301" width="22" height="8" fill="#55a8ff" />
            <rect x="54" y="328" width="54" height="10" fill="#9aa7b8" />
          </g>

          <g fill="#f2f4e8">
            <rect x="264" y="258" width="30" height="80" />
            <rect x="248" y="276" width="62" height="12" />
            <rect x="271" y="238" width="16" height="20" fill="#ffd447" />
            <rect x="422" y="220" width="34" height="118" />
            <rect x="404" y="242" width="70" height="12" />
            <rect x="431" y="198" width="16" height="22" fill="#ffd447" />
          </g>

          <g class="cn-vga-world__fortress">
            <rect x="638" y="228" width="122" height="110" fill="#702f68" />
            <rect x="626" y="204" width="38" height="134" fill="#8e3f78" />
            <rect x="734" y="204" width="38" height="134" fill="#8e3f78" />
            <rect x="626" y="188" width="14" height="16" fill="#c6618e" />
            <rect x="650" y="188" width="14" height="16" fill="#c6618e" />
            <rect x="734" y="188" width="14" height="16" fill="#c6618e" />
            <rect x="758" y="188" width="14" height="16" fill="#c6618e" />
            <rect x="680" y="286" width="38" height="52" fill="#1b1330" />
            <rect x="646" y="236" width="18" height="22" fill="#ffd447" />
            <rect x="734" y="236" width="18" height="22" fill="#ffd447" />
          </g>

          <path class="cn-preview__route cn-preview__route--muted" d="M82 312 H280 V274 H438 V234 H696" />
          <path class="cn-preview__route cn-preview__route--active" d="M82 312 H280 V274 H438" />
          <rect class="cn-preview__packet" width="14" height="14" x="-7" y="-7">
            <animateMotion dur="3.2s" repeatCount="indefinite" path="M82 312 H280 V274 H438" />
          </rect>
        </svg>
  `;
}
