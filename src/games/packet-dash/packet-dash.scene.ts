/**
 * Packet Dash's 3D view: a neon fibre tunnel, three lanes, the packet, and whatever the engine
 * spawned. Draws only. The page owns the clock and feeds update() one snapshot per frame.
 *
 * Kept cheap enough for budget phones:
 * - Unlit materials and additive glow sprites, no post-processing.
 * - Tunnel rings and lane dashes are two InstancedMeshes (one draw call each), recycled by
 *   wrapping their positions instead of being created and destroyed.
 * - Shared geometries; only gate labels get per-object textures, freed when they despawn.
 */

import * as THREE from 'three';
import { createThreeStage, glowTexture, labelTexture } from '@/games/shared/three-stage';
import type { Category, DashEntity, DashEvent, DashSnapshot, GateRow } from './packet-dash.engine';
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

const COLOR = {
  bg: 0x04040a,
  floor: 0x080816,
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

const CATEGORY_STYLE: Record<Category, { word: string; color: string }> = {
  port: { word: 'port', color: '#67e8f9' },
  layer: { word: 'OSI layer', color: '#c4b5fd' },
  subnet: { word: 'subnet', color: '#fcd34d' },
};

const laneX = (lane: number): number => (lane - 1) * LANE_WIDTH;

interface GateView {
  kind: 'gate';
  group: THREE.Group;
  frameMat: THREE.MeshBasicMaterial;
  portalMat: THREE.MeshBasicMaterial;
  label: THREE.Sprite;
  shown?: DashEntity['outcome'];
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
    fov: { landscape: 62, portrait: 78 },
    far: 200,
  });
  const { renderer, scene, camera, canvas, keep } = stage;
  canvas.className = 'cn-dash__canvas';

  // ---- track
  const floor = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(LANE_WIDTH * 3 + 1.4, TRACK_LENGTH)),
    keep(new THREE.MeshBasicMaterial({ color: COLOR.floor })),
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

  const rings = new THREE.InstancedMesh(
    keep(new THREE.TorusGeometry(5.6, 0.05, 4, 8)), // eight sides: reads as a low-poly tunnel
    keep(new THREE.MeshBasicMaterial({ color: 0xffffff })),
    RING_COUNT,
  );
  for (let i = 0; i < RING_COUNT; i += 1) {
    rings.setColorAt(i, new THREE.Color(i % 2 ? COLOR.ringA : COLOR.ringB));
  }
  scene.add(rings);

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
  const glowTex = keep(glowTexture());
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
  const wallGeo = keep(new THREE.BoxGeometry(2.0, 1.5, 0.4));
  const wallEdges = keep(new THREE.EdgesGeometry(wallGeo));
  const wallMat = keep(new THREE.MeshBasicMaterial({ color: COLOR.firewall, transparent: true, opacity: 0.32 }));
  const wallEdgeMat = keep(new THREE.LineBasicMaterial({ color: 0xff8080 }));
  const bitGeo = keep(new THREE.OctahedronGeometry(0.22, 0));
  const bitMat = keep(new THREE.MeshBasicMaterial({ color: COLOR.bit }));
  const shieldGeo = keep(new THREE.TorusGeometry(0.38, 0.09, 6, 14));
  const shieldMat = keep(new THREE.MeshBasicMaterial({ color: COLOR.shield }));

  function gateView(entity: DashEntity): GateView {
    const frameMat = new THREE.MeshBasicMaterial({ color: COLOR.gate });
    const portalMat = new THREE.MeshBasicMaterial({
      color: COLOR.gate, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const group = new THREE.Group();
    const left = new THREE.Mesh(postGeo, frameMat);
    const right = new THREE.Mesh(postGeo, frameMat);
    const bar = new THREE.Mesh(barGeo, frameMat);
    left.position.set(-0.95, 1.2, 0);
    right.position.set(0.95, 1.2, 0);
    bar.position.set(0, 2.4, 0);
    const portal = new THREE.Mesh(portalGeo, portalMat);
    portal.position.y = 1.2;
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: labelTexture(entity.label ?? '', '#e0f2fe', { width: 512, height: 160, font: 76 }), depthWrite: false }),
    );
    label.scale.set(1.75, 0.55, 1);
    label.position.y = 1.25;
    group.add(left, right, bar, portal, label);
    return { kind: 'gate', group, frameMat, portalMat, label };
  }

  function wallView(): PropView {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.add(new THREE.LineSegments(wallEdges, wallEdgeMat));
    wall.position.y = 0.75;
    const group = new THREE.Group();
    group.add(wall);
    return { kind: 'prop', group, spin: 0 };
  }

  function propView(geometry: THREE.BufferGeometry, material: THREE.Material, spin: number): PropView {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.6;
    return { kind: 'prop', group: mesh, spin };
  }

  const views = new Map<number, EntityView>();
  const banners = new Map<number, THREE.Sprite>();

  function createView(entity: DashEntity): EntityView {
    if (entity.kind === 'gate') return gateView(entity);
    if (entity.kind === 'firewall') return wallView();
    if (entity.kind === 'bit') return propView(bitGeo, bitMat, 3);
    return propView(shieldGeo, shieldMat, 2);
  }

  function disposeView(view: EntityView): void {
    scene.remove(view.group);
    if (view.kind !== 'gate') return;
    view.frameMat.dispose();
    view.portalMat.dispose();
    view.label.material.map?.dispose();
    view.label.material.dispose();
  }

  function bannerFor(row: GateRow): THREE.Sprite {
    const style = CATEGORY_STYLE[row.question.category];
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
    const color = outcome === 'correct' ? COLOR.right : outcome === 'wrong' ? COLOR.wrong : outcome === 'missed' ? 0x334155 : COLOR.gate;
    view.frameMat.color.setHex(color);
    view.portalMat.color.setHex(color);
    view.portalMat.opacity = outcome === 'correct' || outcome === 'wrong' ? 0.4 : 0.1;
  }

  function syncEntities(snapshot: DashSnapshot, time: number): void {
    const live = new Set<number>();
    for (const entity of snapshot.entities) {
      live.add(entity.id);
      let view = views.get(entity.id);
      if (!view) {
        view = createView(entity);
        views.set(entity.id, view);
        scene.add(view.group);
      }
      view.group.position.x = laneX(entity.lane);
      view.group.position.z = -(entity.z - snapshot.distance);
      if (view.kind === 'gate') {
        paintGate(view, entity.outcome);
      } else {
        view.group.visible = entity.outcome !== 'collected';
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

    for (const event of events) {
      if (event.type === 'firewall' || (event.type === 'gate' && !event.isCorrect)) shake = 1;
      if (event.type === 'shield-saved') shake = 0.5;
      if (event.type === 'gate' && event.isCorrect) pulse = 1;
    }

    // Recycled track pieces.
    const ringOffset = snapshot.distance % RING_SPACING;
    for (let i = 0; i < RING_COUNT; i += 1) {
      ringRotation.setFromAxisAngle(zAxis, options.reducedMotion ? 0 : time * 0.15 + i * 0.1);
      position.set(0, 2.2, ringOffset - i * RING_SPACING + 8);
      rings.setMatrixAt(i, matrix.compose(position, ringRotation, unitScale));
    }
    rings.instanceMatrix.needsUpdate = true;

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

    // Player: glide between lanes, bank into the turn, blink while invulnerable.
    const targetX = laneX(snapshot.lane);
    const glide = 1 - Math.exp(-dt * (options.reducedMotion ? 30 : 16));
    playerX += (targetX - playerX) * glide;
    player.position.x = playerX;
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
    camera.position.set(playerX * 0.55 + (Math.random() - 0.5) * jolt, 3.3 + (Math.random() - 0.5) * jolt, 6.8);
    camera.lookAt(playerX * 0.75, 0.9, -14);

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
