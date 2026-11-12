/**
 * Packet Dash's 3D view: a neon fibre tunnel, three lanes, the packet, and whatever the engine
 * spawned. Draws only. The page owns the clock and feeds update() one snapshot per frame.
 *
 * Kept cheap enough for budget phones:
 * - Unlit materials and additive glow sprites, no post-processing.
 * - Tunnel rings and lane dashes are two InstancedMeshes (one draw call each), recycled by
 *   wrapping their positions instead of being created and destroyed.
 * - Shared geometries; only gate labels get per-object textures, freed when they despawn.
 * - Floor grid, firewall bricks and portal gradient are tiny canvas textures drawn once.
 * - Hit/collect bursts come from one fixed pool of points (one draw call), never allocated per frame.
 */

import * as THREE from 'three';
import { createThreeStage, glowTexture, labelTexture } from '@/games/shared/three-stage';
import type { DashEntity, DashEvent, DashSnapshot, GateRow } from './packet-dash.engine';
import { CATEGORY_META } from './packet-dash.categories';
import { SPEED_MAX, SPEED_START } from './packet-dash.engine';

export interface DashScene {
  update(snapshot: DashSnapshot, events: readonly DashEvent[], dt: number): void;
  dispose(): void;
}

export const LANE_WIDTH = 2.4;
const TRACK_LENGTH = 220;
const RING_SPACING = 12;
const RING_COUNT = Math.ceil(TRACK_LENGTH / RING_SPACING);
const DASH_SPACING = 6;
const DASH_COUNT = Math.ceil(TRACK_LENGTH / DASH_SPACING);
const STREAKS = 160;
const TRAIL = 6;
const FOV_SPEED_KICK = 9;
/** Relative z beyond which passed objects are hidden (the camera sits at about +6.8). */
const PASSED_HIDE_Z = 1.5;
const LANE_GLOW_LENGTH = 70;
/** Floor grid cell, in metres. */
const GRID_CELL = 3;
const BURST_POOL = 120;
const BURST_GRAVITY = 5;
const BURST_FADE = 1.7;

const COLOR = {
  bg: 0x04040a,
  edge: 0xd946ef,
  dash: 0x6d28d9,
  ringA: 0x8b5cf6,
  ringB: 0x22d3ee,
  gate: 0x22d3ee,
  right: 0x22c55e,
  wrong: 0xef4444,
  firewall: 0xef4444,
  bit: 0xfbbf24,
  shield: 0x60a5fa,
} as const;

const laneX = (lane: number): number => (lane - 1) * LANE_WIDTH;

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** One floor cell: dark glass with a bright violet seam and a faint centre cross. */
function gridTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#070714';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(64, 0); ctx.lineTo(64, 128);
    ctx.moveTo(0, 64); ctx.lineTo(128, 64);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.75)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 128, 128);
  });
}

/** Glowing brickwork: a firewall that reads as one. */
function brickTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 96, (ctx) => {
    ctx.fillStyle = '#3b0a0a';
    ctx.fillRect(0, 0, 128, 96);
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    for (let row = 0; row < 4; row += 1) {
      const y = row * 24;
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(128, y);
      for (let x = row % 2 ? 0 : 32; x < 128; x += 64) {
        ctx.moveTo(x, y); ctx.lineTo(x, y + 24);
      }
      ctx.stroke();
    }
  });
}

/** Vertical fade, bright at the bottom: the shimmer inside a gate. */
function portalTexture(): THREE.CanvasTexture {
  return canvasTexture(4, 128, (ctx) => {
    const fade = ctx.createLinearGradient(0, 0, 0, 128);
    fade.addColorStop(0, 'rgba(255,255,255,0.15)');
    fade.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    fade.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 4, 128);
  });
}

interface GateView {
  kind: 'gate';
  group: THREE.Group;
  frameMat: THREE.MeshBasicMaterial;
  portalMat: THREE.MeshBasicMaterial;
  glowMat: THREE.SpriteMaterial;
  label: THREE.Sprite;
  /** Category colour, shown while the gate is still ahead. */
  baseColor: number;
  shown?: DashEntity['outcome'] | 'init';
}

interface PropView {
  kind: 'prop';
  group: THREE.Object3D;
  spin: number;
}

type EntityView = GateView | PropView;

/** Throws when WebGL is unavailable; the page shows a fallback message. */
export function createDashScene(host: HTMLElement, options: { reducedMotion: boolean }): DashScene {
  const stage = createThreeStage(host, {
    clearColor: COLOR.bg,
    fog: { near: 30, far: 150 },
    fov: { landscape: 54, portrait: 76 },
    far: 200,
  });
  const { renderer, scene, camera, canvas, keep } = stage;
  canvas.className = 'cn-dash__canvas';

  // ---- track
  const floorWidth = LANE_WIDTH * 3 + 1.4;
  const gridTex = keep(gridTexture());
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.repeat.set(floorWidth / GRID_CELL, TRACK_LENGTH / GRID_CELL);
  gridTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); // keeps far lines from shimmering
  const floor = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(floorWidth, TRACK_LENGTH)),
    keep(new THREE.MeshBasicMaterial({ map: gridTex })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -TRACK_LENGTH / 2 + 10;
  scene.add(floor);

  const edgeGeo = keep(new THREE.BoxGeometry(0.08, 0.08, TRACK_LENGTH));
  const edgeMat = keep(new THREE.MeshBasicMaterial({ color: COLOR.edge }));
  const edgeGlowGeo = keep(new THREE.BoxGeometry(0.5, 0.02, TRACK_LENGTH));
  const edgeGlowMat = keep(
    new THREE.MeshBasicMaterial({ color: COLOR.edge, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  for (const side of [-1, 1]) {
    const x = side * (LANE_WIDTH * 1.5 + 0.3);
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    const glow = new THREE.Mesh(edgeGlowGeo, edgeGlowMat);
    edge.position.set(x, 0.04, floor.position.z);
    glow.position.set(x, 0.02, floor.position.z);
    scene.add(edge, glow);
  }

  const dashes = new THREE.InstancedMesh(
    keep(new THREE.BoxGeometry(0.06, 0.02, 2.2)),
    keep(new THREE.MeshBasicMaterial({ color: COLOR.dash })),
    DASH_COUNT * 2,
  );
  scene.add(dashes);

  // A glowing strip under the packet's lane, fading out ahead: which lane you are in, at a glance.
  const fadeCanvas = document.createElement('canvas');
  fadeCanvas.width = 4;
  fadeCanvas.height = 128;
  const fadeCtx = fadeCanvas.getContext('2d')!;
  const fade = fadeCtx.createLinearGradient(0, 0, 0, 128);
  fade.addColorStop(0, 'rgba(255,255,255,0)');
  fade.addColorStop(0.7, 'rgba(255,255,255,0.55)');
  fade.addColorStop(1, 'rgba(255,255,255,0.9)');
  fadeCtx.fillStyle = fade;
  fadeCtx.fillRect(0, 0, 4, 128);
  const laneGlowMat = keep(
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      map: keep(new THREE.CanvasTexture(fadeCanvas)),
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const laneGlow = new THREE.Mesh(keep(new THREE.PlaneGeometry(LANE_WIDTH * 0.94, LANE_GLOW_LENGTH)), laneGlowMat);
  laneGlow.rotation.x = -Math.PI / 2;
  laneGlow.position.set(0, 0.012, -LANE_GLOW_LENGTH / 2 + 3);
  scene.add(laneGlow);

  const rings = new THREE.InstancedMesh(
    keep(new THREE.TorusGeometry(5.6, 0.05, 4, 8)), // eight sides: reads as a low-poly tunnel
    keep(new THREE.MeshBasicMaterial({ color: 0xffffff })),
    RING_COUNT,
  );
  // A fat, faint copy of each ring, added on top: fake bloom for one extra draw call.
  const ringGlows = new THREE.InstancedMesh(
    keep(new THREE.TorusGeometry(5.6, 0.28, 4, 8)),
    keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false })),
    RING_COUNT,
  );
  for (let i = 0; i < RING_COUNT; i += 1) {
    const color = new THREE.Color(i % 2 ? COLOR.ringA : COLOR.ringB);
    rings.setColorAt(i, color);
    ringGlows.setColorAt(i, color);
  }
  scene.add(rings, ringGlows);

  // The vanishing point glows, so the tunnel always leads somewhere.
  const glowTex = keep(glowTexture());
  const horizon = new THREE.Sprite(
    keep(new THREE.SpriteMaterial({ map: glowTex, color: 0xa855f7, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })),
  );
  horizon.scale.set(70, 34, 1);
  horizon.position.set(0, 2.2, -175);
  scene.add(horizon);

  // ---- speed streaks
  const streakPositions = new Float32Array(STREAKS * 3);
  for (let i = 0; i < STREAKS; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 4.2 + Math.random() * 1.2;
    streakPositions[i * 3] = Math.cos(angle) * radius;
    streakPositions[i * 3 + 1] = 2.2 + Math.sin(angle) * radius * 0.7;
    streakPositions[i * 3 + 2] = 8 - Math.random() * TRACK_LENGTH;
  }
  const streakGeo = keep(new THREE.BufferGeometry());
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  const streaks = new THREE.Points(
    streakGeo,
    keep(new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.09, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })),
  );
  scene.add(streaks);

  // ---- player
  const player = new THREE.Group();
  const core = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.32, 0)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  const coreEdges = new THREE.LineSegments(
    keep(new THREE.EdgesGeometry(core.geometry)),
    keep(new THREE.LineBasicMaterial({ color: 0x67e8f9 })),
  );
  core.add(coreEdges);
  const haloMat = keep(new THREE.SpriteMaterial({ map: glowTex, color: 0x67e8f9, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(1.9);
  const shieldBubble = new THREE.Mesh(
    keep(new THREE.IcosahedronGeometry(0.75, 1)),
    keep(new THREE.MeshBasicMaterial({ color: COLOR.shield, wireframe: true, transparent: true, opacity: 0.55 })),
  );
  player.add(halo, core, shieldBubble);
  player.position.y = 0.6;
  scene.add(player);

  const trail = Array.from({ length: TRAIL }, (_, i) => {
    const sprite = new THREE.Sprite(
      keep(new THREE.SpriteMaterial({ map: glowTex, color: 0x22d3ee, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 * (1 - i / TRAIL) })),
    );
    sprite.scale.setScalar(0.9 * (1 - i / (TRAIL + 2)));
    sprite.position.set(0, 0.6, 0.45 * (i + 1));
    scene.add(sprite);
    return sprite;
  });

  // ---- entity pieces
  const postGeo = keep(new THREE.BoxGeometry(0.12, 2.4, 0.12));
  const barGeo = keep(new THREE.BoxGeometry(2.0, 0.12, 0.12));
  const portalGeo = keep(new THREE.PlaneGeometry(1.8, 2.3));
  const portalTex = keep(portalTexture());
  const wallGeo = keep(new THREE.BoxGeometry(2.0, 1.5, 0.4));
  const wallEdges = keep(new THREE.EdgesGeometry(wallGeo));
  const wallMat = keep(new THREE.MeshBasicMaterial({ map: keep(brickTexture()), transparent: true, opacity: 0.85 }));
  const wallEdgeMat = keep(new THREE.LineBasicMaterial({ color: 0xff8080 }));
  const wallGlowMat = keep(
    new THREE.SpriteMaterial({ map: glowTex, color: COLOR.firewall, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  const bitGeo = keep(new THREE.OctahedronGeometry(0.22, 0));
  const bitMat = keep(new THREE.MeshBasicMaterial({ color: COLOR.bit }));
  const bitGlowMat = keep(
    new THREE.SpriteMaterial({ map: glowTex, color: COLOR.bit, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  const shieldGeo = keep(new THREE.TorusGeometry(0.38, 0.09, 6, 14));
  const shieldMat = keep(new THREE.MeshBasicMaterial({ color: COLOR.shield }));
  const shieldGlowMat = keep(
    new THREE.SpriteMaterial({ map: glowTex, color: COLOR.shield, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
  );

  function gateView(entity: DashEntity, baseColor: number): GateView {
    const frameMat = new THREE.MeshBasicMaterial({ color: baseColor });
    const portalMat = new THREE.MeshBasicMaterial({
      color: baseColor, map: portalTex, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: baseColor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const group = new THREE.Group();
    const left = new THREE.Mesh(postGeo, frameMat);
    const right = new THREE.Mesh(postGeo, frameMat);
    const bar = new THREE.Mesh(barGeo, frameMat);
    left.position.set(-0.95, 1.2, 0);
    right.position.set(0.95, 1.2, 0);
    bar.position.set(0, 2.4, 0);
    const portal = new THREE.Mesh(portalGeo, portalMat);
    portal.position.y = 1.2;
    // Glow at the two top corners: the gate's silhouette survives the fog.
    const glows = [-0.95, 0.95].map((x) => {
      const glow = new THREE.Sprite(glowMat);
      glow.scale.setScalar(1.1);
      glow.position.set(x, 2.4, 0);
      return glow;
    });
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTexture(entity.label ?? '', '#e0f2fe', { width: 512, height: 160, font: 76 }), depthWrite: false }),
    );
    label.scale.set(2.35, 0.74, 1);
    label.position.y = 1.3;
    group.add(left, right, bar, portal, ...glows, label);
    return { kind: 'gate', group, frameMat, portalMat, glowMat, label, baseColor, shown: 'init' };
  }

  function wallView(): PropView {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.add(new THREE.LineSegments(wallEdges, wallEdgeMat));
    wall.position.y = 0.75;
    const glow = new THREE.Sprite(wallGlowMat);
    glow.scale.set(3.6, 2.6, 1);
    glow.position.set(0, 0.75, -0.3);
    const group = new THREE.Group();
    group.add(glow, wall);
    return { kind: 'prop', group, spin: 0 };
  }

  function propView(geometry: THREE.BufferGeometry, material: THREE.Material, glowMat: THREE.SpriteMaterial, spin: number): PropView {
    const mesh = new THREE.Mesh(geometry, material);
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(1.3);
    const group = new THREE.Group();
    group.add(glow, mesh);
    group.position.y = 0.6;
    return { kind: 'prop', group, spin };
  }

  const views = new Map<number, EntityView>();
  const banners = new Map<number, THREE.Sprite>();

  function createView(entity: DashEntity, snapshot: DashSnapshot): EntityView {
    if (entity.kind === 'gate') {
      const row = snapshot.rows.find((r) => r.id === entity.rowId);
      const color = row ? new THREE.Color(CATEGORY_META[row.question.category].color).getHex() : COLOR.gate;
      return gateView(entity, color);
    }
    if (entity.kind === 'firewall') return wallView();
    if (entity.kind === 'bit') return propView(bitGeo, bitMat, bitGlowMat, 3);
    return propView(shieldGeo, shieldMat, shieldGlowMat, 2);
  }

  function disposeView(view: EntityView): void {
    scene.remove(view.group);
    if (view.kind !== 'gate') return;
    view.frameMat.dispose();
    view.portalMat.dispose();
    view.glowMat.dispose();
    view.label.material.map?.dispose();
    view.label.material.dispose();
  }

  // ---- bursts: one pooled Points cloud. Dead particles are tinted black, which is invisible
  // under additive blending, so nothing has to be added or removed.
  const burstPos = new Float32Array(BURST_POOL * 3);
  const burstVel = new Float32Array(BURST_POOL * 3);
  const burstColor = new Float32Array(BURST_POOL * 3);
  const burstBase = new Float32Array(BURST_POOL * 3);
  const burstLife = new Float32Array(BURST_POOL);
  const burstGeo = keep(new THREE.BufferGeometry());
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
  burstGeo.setAttribute('color', new THREE.BufferAttribute(burstColor, 3));
  const bursts = new THREE.Points(
    burstGeo,
    keep(new THREE.PointsMaterial({ size: 0.32, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })),
  );
  bursts.frustumCulled = false; // positions change every frame; the stale bounding sphere would cull them
  scene.add(bursts);
  let burstNext = 0;
  const burstTint = new THREE.Color();

  function burst(count: number, hex: number, x: number, y: number): void {
    if (options.reducedMotion) return;
    burstTint.setHex(hex);
    for (let n = 0; n < count; n += 1) {
      const i = burstNext;
      burstNext = (burstNext + 1) % BURST_POOL; // ponytail: oldest particle is recycled when the pool is full
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      burstPos.set([x, y, 0], i * 3);
      burstVel.set([Math.cos(angle) * speed, Math.sin(angle) * speed * 0.8 + 2, (Math.random() - 0.3) * 3], i * 3);
      burstBase.set([burstTint.r, burstTint.g, burstTint.b], i * 3);
      burstLife[i] = 0.7 + Math.random() * 0.3;
    }
  }

  function stepBursts(dt: number, flow: number): void {
    for (let i = 0; i < BURST_POOL; i += 1) {
      const life = Math.max(0, burstLife[i] - dt * BURST_FADE);
      burstLife[i] = life;
      if (life > 0) {
        burstVel[i * 3 + 1] -= BURST_GRAVITY * dt;
        burstPos[i * 3] += burstVel[i * 3] * dt;
        burstPos[i * 3 + 1] += burstVel[i * 3 + 1] * dt;
        burstPos[i * 3 + 2] += burstVel[i * 3 + 2] * dt + flow; // drift past with the track
      }
      for (let c = 0; c < 3; c += 1) burstColor[i * 3 + c] = burstBase[i * 3 + c] * life;
    }
    burstGeo.attributes.position.needsUpdate = true;
    burstGeo.attributes.color.needsUpdate = true;
  }

  function bannerFor(row: GateRow): THREE.Sprite {
    const style = CATEGORY_META[row.question.category];
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: labelTexture(`${row.question.prompt}  →  ${style.word}?`, style.color, { width: 1024, height: 150, font: 78 }),
        depthWrite: false,
        fog: false,
      }),
    );
    sprite.scale.set(6.4, 0.94, 1);
    return sprite;
  }

  function paintGate(view: GateView, outcome: DashEntity['outcome']): void {
    if (view.shown === outcome) return;
    view.shown = outcome;
    const color = outcome === 'correct' ? COLOR.right : outcome === 'wrong' ? COLOR.wrong : outcome === 'missed' ? 0x334155 : view.baseColor;
    view.frameMat.color.setHex(color);
    view.portalMat.color.setHex(color);
    view.glowMat.color.setHex(color);
    view.glowMat.opacity = outcome === 'missed' ? 0 : 0.85;
    view.portalMat.opacity = outcome === 'correct' || outcome === 'wrong' ? 0.55 : 0.18;
  }

  function syncEntities(snapshot: DashSnapshot, time: number): void {
    const live = new Set<number>();
    for (const entity of snapshot.entities) {
      live.add(entity.id);
      let view = views.get(entity.id);
      if (!view) {
        view = createView(entity, snapshot);
        views.set(entity.id, view);
        scene.add(view.group);
      }
      view.group.position.x = laneX(entity.lane);
      view.group.position.z = -(entity.z - snapshot.distance);
      // Once past the packet, scenery only blocks the view of what is coming.
      const passed = view.group.position.z > PASSED_HIDE_Z;
      if (view.kind === 'gate') {
        paintGate(view, entity.outcome);
        view.group.visible = !passed;
      } else {
        view.group.visible = entity.outcome !== 'collected' && !passed;
        if (view.spin && !options.reducedMotion) {
          view.group.rotation.y = time * view.spin;
          view.group.position.y = 0.6 + Math.sin(time * 4 + entity.id) * 0.12;
        }
      }
    }
    for (const [id, view] of views) {
      if (!live.has(id)) {
        disposeView(view);
        views.delete(id);
      }
    }

    const liveRows = new Set<number>();
    for (const row of snapshot.rows) {
      liveRows.add(row.id);
      let banner = banners.get(row.id);
      if (!banner) {
        banner = bannerFor(row);
        banners.set(row.id, banner);
        scene.add(banner);
      }
      banner.position.set(0, 3.5, -(row.z - snapshot.distance));
      banner.visible = !row.result;
    }
    for (const [id, banner] of banners) {
      if (!liveRows.has(id)) {
        scene.remove(banner);
        banner.material.map?.dispose();
        banner.material.dispose();
        banners.delete(id);
      }
    }
  }

  // ---- per-frame state
  const matrix = new THREE.Matrix4();
  const ringRotation = new THREE.Quaternion();
  const unitScale = new THREE.Vector3(1, 1, 1);
  const position = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const noRotation = new THREE.Quaternion();
  let playerX = 0;
  let shake = 0;
  let pulse = 0;
  let time = 0;
  const trailX = new Array<number>(TRAIL).fill(0);

  function update(snapshot: DashSnapshot, events: readonly DashEvent[], dt: number): void {
    stage.sampleFrame(dt);
    time += dt;

    const py = player.position.y;
    for (const event of events) {
      if (event.type === 'firewall' || (event.type === 'gate' && !event.isCorrect)) shake = 1;
      if (event.type === 'shield-saved') shake = 0.5;
      if (event.type === 'gate' && event.isCorrect) pulse = 1;

      if (event.type === 'gate') burst(30, event.isCorrect ? COLOR.right : COLOR.wrong, playerX, py);
      else if (event.type === 'firewall') burst(40, COLOR.firewall, playerX, py);
      else if (event.type === 'shield-saved' || event.type === 'shield-pickup') burst(22, COLOR.shield, playerX, py);
      else if (event.type === 'bit') burst(14, COLOR.bit, playerX, py);
    }

    // Recycled track pieces. Rings breathe brighter as the run speeds up.
    gridTex.offset.y = (snapshot.distance / GRID_CELL) % 1;
    const ringOffset = snapshot.distance % RING_SPACING;
    for (let i = 0; i < RING_COUNT; i += 1) {
      ringRotation.setFromAxisAngle(zAxis, options.reducedMotion ? 0 : time * 0.15 + i * 0.1);
      position.set(0, 2.2, ringOffset - i * RING_SPACING + 8);
      matrix.compose(position, ringRotation, unitScale);
      rings.setMatrixAt(i, matrix);
      ringGlows.setMatrixAt(i, matrix);
    }
    rings.instanceMatrix.needsUpdate = true;
    ringGlows.instanceMatrix.needsUpdate = true;
    const glowMat = ringGlows.material as THREE.MeshBasicMaterial;
    glowMat.opacity = 0.1 + Math.min(1, Math.max(0, (snapshot.speed - SPEED_START) / (SPEED_MAX - SPEED_START))) * 0.14;

    const dashOffset = snapshot.distance % DASH_SPACING;
    for (let i = 0; i < DASH_COUNT; i += 1) {
      const z = dashOffset - i * DASH_SPACING + 8;
      dashes.setMatrixAt(i * 2, matrix.compose(position.set(-LANE_WIDTH / 2, 0.01, z), noRotation, unitScale));
      dashes.setMatrixAt(i * 2 + 1, matrix.compose(position.set(LANE_WIDTH / 2, 0.01, z), noRotation, unitScale));
    }
    dashes.instanceMatrix.needsUpdate = true;

    const flow = snapshot.speed * dt * 1.4;
    for (let i = 0; i < STREAKS; i += 1) {
      let z = streakPositions[i * 3 + 2] + flow;
      if (z > 8) z -= TRACK_LENGTH;
      streakPositions[i * 3 + 2] = z;
    }
    streakGeo.attributes.position.needsUpdate = true;

    syncEntities(snapshot, time);
    stepBursts(dt, snapshot.speed * dt);
    if (!options.reducedMotion) wallMat.opacity = 0.75 + Math.sin(time * 9) * 0.12; // firewalls crackle

    // Player: glide between lanes, bank into the turn, blink while invulnerable.
    const targetX = laneX(snapshot.lane);
    const glide = 1 - Math.exp(-dt * (options.reducedMotion ? 30 : 16));
    playerX += (targetX - playerX) * glide;
    player.position.x = playerX;
    laneGlow.position.x = playerX;
    laneGlowMat.color.setHex(shake > 0.2 ? COLOR.wrong : pulse > 0.2 ? COLOR.right : 0x22d3ee);
    player.rotation.z = (playerX - targetX) * 0.25;
    if (!options.reducedMotion) {
      core.rotation.x += dt * 2.5;
      core.rotation.y += dt * 1.7;
    }
    core.visible = !snapshot.invulnerable || Math.floor(time * 12) % 2 === 0;
    shieldBubble.visible = snapshot.hasShield;
    shieldBubble.rotation.y += dt;
    pulse = Math.max(0, pulse - dt * 2.5);
    halo.scale.setScalar(1.9 + pulse * 1.4);
    haloMat.color.setHex(pulse > 0 ? 0x86efac : 0x67e8f9);

    for (let i = 0; i < TRAIL; i += 1) {
      const leader = i === 0 ? playerX : trailX[i - 1];
      trailX[i] += (leader - trailX[i]) * (1 - Math.exp(-dt * 22));
      trail[i].position.x = trailX[i];
    }

    // Camera: follow the lane loosely, widen with speed, shake on hits.
    const speedRatio = (snapshot.speed - SPEED_START) / (SPEED_MAX - SPEED_START);
    const fov = stage.baseFov() + (options.reducedMotion ? 0 : Math.max(0, speedRatio) * FOV_SPEED_KICK);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    shake = Math.max(0, shake - dt * 3);
    const jolt = options.reducedMotion ? 0 : shake * 0.35;
    camera.position.set(playerX * 0.55 + (Math.random() - 0.5) * jolt, 3.0 + (Math.random() - 0.5) * jolt, 6.6);
    camera.lookAt(playerX * 0.75, 0.9, -18);

    renderer.render(scene, camera);
  }

  return {
    update,
    dispose() {
      views.forEach(disposeView);
      views.clear();
      banners.forEach((banner) => {
        banner.material.map?.dispose();
        banner.material.dispose();
      });
      banners.clear();
      stage.dispose();
    },
  };
}
