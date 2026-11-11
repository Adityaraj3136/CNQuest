/**
 * Packet Runner's 3D view. Draws only — every decision comes from the engine via the page.
 *
 * Built to run on anything with WebGL, including low-end phones:
 * - Unlit MeshBasicMaterial plus additive "glow" shells instead of post-processing bloom.
 * - Shared geometries and cached materials; ~30 meshes on screen at most.
 * - Pixel ratio capped at 2, and dropped to 1 if the first seconds run under 40 fps.
 * - The render loop stops while the tab is hidden, and the GL context is released on dispose,
 *   so replaying many runs never hits the browser's context limit.
 * - Taps are picked through large invisible hit spheres; the page also offers plain buttons,
 *   so the 3D targets are a convenience, never the only way to play.
 *
 * The scene never knows the correct interface. Every branch looks the same until the packet
 * has travelled it, so the geometry cannot leak the answer.
 */

import * as THREE from 'three';

export type SendOutcome = 'forward' | 'bounce' | 'deliver';

export interface PacketSceneOptions {
  /** Colour per interface name, shared with the DOM panel so chip and link match. */
  colors: Record<string, string>;
  reducedMotion: boolean;
  onPick: (iface: string) => void;
}

export interface PacketScene {
  /** Builds the branch fan at the current router. */
  showHop(routerName: string, interfaces: readonly string[]): void;
  /** Animates the packet down one branch and resolves when it lands. */
  sendPacket(iface: string, outcome: SendOutcome): Promise<void>;
  /** Stops a branch being picked again (a wrong interface at this router). */
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

const BRANCH_LENGTH = 6;
const PACKET_HEIGHT = 0.35;
const CAMERA_OFFSET = new THREE.Vector3(0, 6.5, 7.5);
const LOOK_AHEAD = new THREE.Vector3(0, 0, -3);
const TAP_MAX_MOVE_PX = 10;
const TAP_MAX_MS = 600;
const LOW_FPS = 40;
const FPS_SAMPLE_MS = 2500;
const UP = new THREE.Vector3(0, 1, 0);

const NEON_ROUTER = 0x8b5cf6;
const NEON_FAIL = 0xef4444;
const NEON_HOST = 0x22c55e;

interface Branch {
  iface: string;
  color: THREE.Color;
  end: THREE.Vector3;
  group: THREE.Group;
  node: THREE.Mesh;
  hit: THREE.Mesh;
  linkMat: THREE.MeshBasicMaterial;
  glowMat: THREE.MeshBasicMaterial;
  dead: boolean;
}

interface Tween {
  duration: number;
  elapsed: number;
  step: (t: number) => void;
  done: () => void;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(6, 8, 12, 0.85)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(6, 6, 244, 84, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 48px "Share Tech Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

/** Throws when WebGL is unavailable; the page catches that and plays without the 3D view. */
export function createPacketScene(host: HTMLElement, options: PacketSceneOptions): PacketScene {
  const lowDpr = window.devicePixelRatio < 2;
  const renderer = new THREE.WebGLRenderer({
    antialias: lowDpr, // high-DPR screens are sharp enough without paying for MSAA
    alpha: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x05060a);
  const canvas = renderer.domElement;
  canvas.className = 'cn-pr__canvas';
  canvas.setAttribute('aria-hidden', 'true'); // the panel carries every piece of information
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05060a, 14, 34);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);

  const grid = new THREE.GridHelper(400, 200, 0x3b1d6e, 0x1a1033);
  grid.position.y = -0.6;
  scene.add(grid);

  // ---- shared resources
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };
  const routerGeo = keep(new THREE.OctahedronGeometry(0.6, 0));
  const routerEdges = keep(new THREE.EdgesGeometry(routerGeo));
  const hitGeo = keep(new THREE.SphereGeometry(1.3, 8, 6));
  const linkGeo = keep(new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true));
  const glowLinkGeo = keep(new THREE.CylinderGeometry(0.2, 0.2, 1, 8, 1, true));
  const packetGeo = keep(new THREE.IcosahedronGeometry(0.26, 0));
  const glowTex = keep(glowTexture());
  const hitMat = keep(new THREE.MeshBasicMaterial({ visible: false }));

  const routerMaterial = (hex: number): THREE.MeshBasicMaterial =>
    keep(new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.35 }));
  const edgeMaterial = (hex: number): THREE.LineBasicMaterial =>
    keep(new THREE.LineBasicMaterial({ color: hex }));

  function makeNode(hex: number): THREE.Mesh {
    const node = new THREE.Mesh(routerGeo, routerMaterial(hex));
    node.add(new THREE.LineSegments(routerEdges, edgeMaterial(hex)));
    return node;
  }

  function makeLabel(text: string, color: string, scale = 1): THREE.Sprite {
    const material = keep(
      new THREE.SpriteMaterial({ map: keep(labelTexture(text, color)), depthWrite: false, fog: false }),
    );
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.6 * scale, 0.6 * scale, 1);
    return sprite;
  }

  // ---- packet
  const packet = new THREE.Mesh(packetGeo, keep(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  const halo = new THREE.Sprite(
    keep(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0x67e8f9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    ),
  );
  halo.scale.setScalar(1.6);
  packet.add(halo);
  packet.position.set(0, PACKET_HEIGHT, 0);
  scene.add(packet);

  // ---- world state
  const routerPos = new THREE.Vector3();
  let routerGroup: THREE.Group | null = null;
  let branches: Branch[] = [];
  let enabled = true;
  let packetTravelling = false;
  const camTarget = new THREE.Vector3().copy(CAMERA_OFFSET);
  const lookTarget = new THREE.Vector3().copy(LOOK_AHEAD);
  const lookCurrent = lookTarget.clone();
  camera.position.copy(camTarget);
  const tweens: Tween[] = [];

  function retarget(snap: boolean): void {
    camTarget.copy(routerPos).add(CAMERA_OFFSET);
    lookTarget.copy(routerPos).add(LOOK_AHEAD);
    if (snap || options.reducedMotion) {
      camera.position.copy(camTarget);
      lookCurrent.copy(lookTarget);
    }
  }

  function disposeGroup(group: THREE.Object3D): void {
    scene.remove(group);
    group.traverse((object) => {
      if (object instanceof THREE.Sprite) {
        object.material.map?.dispose();
        object.material.dispose();
      }
    });
  }

  function tween(duration: number, step: (t: number) => void): Promise<void> {
    if (options.reducedMotion || duration <= 0) {
      step(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => tweens.push({ duration, elapsed: 0, step, done: resolve }));
  }

  function setLink(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
    const dir = new THREE.Vector3().subVectors(to, from);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.scale.set(1, dir.length(), 1);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  }

  function showHop(routerName: string, interfaces: readonly string[]): void {
    branches.forEach((b) => disposeGroup(b.group));
    branches = [];

    if (!routerGroup) {
      routerGroup = new THREE.Group();
      routerGroup.add(makeNode(NEON_ROUTER));
      scene.add(routerGroup);
    }
    const label = makeLabel(routerName, '#c4b5fd', 0.8);
    label.position.set(routerPos.x, 1.4, routerPos.z);
    scene.add(label);

    // Fan the branches forward, spread wider the more there are.
    const spread = interfaces.length >= 4 ? 120 : 90;
    interfaces.forEach((iface, index) => {
      const angle = THREE.MathUtils.degToRad(
        interfaces.length === 1 ? 0 : -spread / 2 + (spread * index) / (interfaces.length - 1),
      );
      const end = new THREE.Vector3(
        routerPos.x + Math.sin(angle) * BRANCH_LENGTH,
        0,
        routerPos.z - Math.cos(angle) * BRANCH_LENGTH,
      );
      const hex = options.colors[iface] ?? '#ffffff';
      const color = new THREE.Color(hex);
      const group = new THREE.Group();

      const linkMat = keep(new THREE.MeshBasicMaterial({ color }));
      const glowMat = keep(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const link = new THREE.Mesh(linkGeo, linkMat);
      const glow = new THREE.Mesh(glowLinkGeo, glowMat);
      setLink(link, routerPos, end);
      setLink(glow, routerPos, end);

      // Every branch end is an identical router: nothing here says which way is right.
      const node = makeNode(NEON_ROUTER);
      node.position.copy(end);
      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.copy(end);
      hit.userData.iface = iface;

      const tag = makeLabel(iface, hex);
      tag.position.copy(routerPos).lerp(end, 0.62).setY(0.9);

      group.add(link, glow, node, hit, tag);
      scene.add(group);
      branches.push({ iface, color, end, group, node, hit, linkMat, glowMat, dead: false });
    });

    enabled = true;
  }

  async function sendPacket(iface: string, outcome: SendOutcome): Promise<void> {
    const branch = branches.find((b) => b.iface === iface);
    if (!branch) return;
    enabled = false;
    packetTravelling = true;
    const from = new THREE.Vector3(routerPos.x, PACKET_HEIGHT, routerPos.z);
    const to = branch.end.clone().setY(PACKET_HEIGHT);

    await tween(650, (t) => packet.position.lerpVectors(from, to, easeInOut(t)));

    if (outcome === 'bounce') {
      branch.dead = true;
      (branch.node.material as THREE.MeshBasicMaterial).color.setHex(NEON_FAIL);
      branch.linkMat.color.setHex(NEON_FAIL);
      branch.glowMat.opacity = 0.08;
      await tween(550, (t) => packet.position.lerpVectors(to, from, easeInOut(t)));
      packetTravelling = false;
      enabled = true;
      return;
    }

    if (outcome === 'deliver') {
      (branch.node.material as THREE.MeshBasicMaterial).color.setHex(NEON_HOST);
      (branch.node.material as THREE.MeshBasicMaterial).opacity = 0.7;
      await tween(500, (t) => branch.node.scale.setScalar(1 + t * 0.8));
      packetTravelling = false;
      return;
    }

    // Forward: the far router becomes the current one; the losing branches fade out.
    routerPos.copy(branch.end);
    if (routerGroup) routerGroup.position.copy(routerPos);
    for (const other of branches) {
      if (other !== branch) disposeGroup(other.group);
    }
    // Keep the travelled link as a trail. Its end node goes: the live router now sits there.
    branch.group.remove(branch.hit, branch.node);
    branches = [];
    retarget(false);
    packetTravelling = false;
  }

  // ---- picking
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down: { x: number; y: number; at: number } | null = null;

  function pick(clientX: number, clientY: number): Branch | null {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const live = branches.filter((b) => !b.dead);
    const hit = raycaster.intersectObjects(live.map((b) => b.hit), false)[0];
    return hit ? (live.find((b) => b.hit === hit.object) ?? null) : null;
  }

  const onPointerDown = (event: PointerEvent): void => {
    down = { x: event.clientX, y: event.clientY, at: performance.now() };
  };
  const onPointerUp = (event: PointerEvent): void => {
    if (!down || !enabled || packetTravelling) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const quick = performance.now() - down.at < TAP_MAX_MS;
    down = null;
    if (moved > TAP_MAX_MOVE_PX || !quick) return; // a scroll or drag, not a tap
    const branch = pick(event.clientX, event.clientY);
    if (branch) options.onPick(branch.iface);
  };
  let hovered: Branch | null = null;
  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    const branch = enabled && !packetTravelling ? pick(event.clientX, event.clientY) : null;
    if (branch === hovered) return;
    hovered?.node.scale.setScalar(1);
    hovered = branch;
    hovered?.node.scale.setScalar(1.3);
    canvas.style.cursor = hovered ? 'pointer' : 'default';
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);

  // A lost context (GPU reset, backgrounded tab on mobile) is restored by three on its own
  // only if the default "lose it for good" behaviour is cancelled.
  const onContextLost = (event: Event): void => event.preventDefault();
  canvas.addEventListener('webglcontextlost', onContextLost);

  // ---- sizing
  function resize(): void {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Portrait phones need a wider view or the outer branches fall off screen.
    camera.fov = camera.aspect < 1 ? 72 : 55;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  // ---- loop
  const clock = new THREE.Clock();
  let sampleFrames = 0;
  let sampleMs = 0;
  let sampled = false;

  function tick(): void {
    const dt = Math.min(clock.getDelta(), 0.1);

    if (!sampled) {
      sampleFrames += 1;
      sampleMs += dt * 1000;
      if (sampleMs >= FPS_SAMPLE_MS) {
        sampled = true;
        if ((sampleFrames * 1000) / sampleMs < LOW_FPS && renderer.getPixelRatio() > 1) {
          renderer.setPixelRatio(1);
          resize();
        }
      }
    }

    for (let i = tweens.length - 1; i >= 0; i -= 1) {
      const active = tweens[i];
      active.elapsed += dt * 1000;
      const t = Math.min(1, active.elapsed / active.duration);
      active.step(t);
      if (t >= 1) {
        tweens.splice(i, 1);
        active.done();
      }
    }

    if (!options.reducedMotion) {
      const time = clock.elapsedTime;
      packet.rotation.x += dt * 1.4;
      packet.rotation.y += dt * 2;
      halo.scale.setScalar(1.5 + Math.sin(time * 4) * 0.15);
      if (routerGroup) routerGroup.rotation.y += dt * 0.6;
      if (!packetTravelling) packet.position.y = PACKET_HEIGHT + Math.sin(time * 3) * 0.08;
      const smoothing = 1 - Math.exp(-dt * 4);
      camera.position.lerp(camTarget, smoothing);
      lookCurrent.lerp(lookTarget, smoothing);
    }
    camera.lookAt(lookCurrent);
    renderer.render(scene, camera);
  }

  const onVisibility = (): void => {
    if (document.hidden) {
      renderer.setAnimationLoop(null);
    } else {
      clock.getDelta(); // swallow the time spent hidden
      renderer.setAnimationLoop(tick);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  retarget(true);
  renderer.setAnimationLoop(tick);

  return {
    showHop,
    sendPacket,
    setEnabled(value: boolean) {
      enabled = value;
    },
    dispose() {
      renderer.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', onVisibility);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      tweens.forEach((t) => t.done());
      tweens.length = 0;
      disposables.forEach((item) => item.dispose());
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // frees the context now, not whenever GC gets round to it
      canvas.remove();
    },
  };
}
