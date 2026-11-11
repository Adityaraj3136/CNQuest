/**
 * The device-safety plumbing every three.js game in CN Quest shares.
 *
 * - Pixel ratio capped at 2, MSAA only on low-DPR screens (high-DPR is sharp enough).
 * - Pixel ratio drops to 1 if the first seconds run under 40 fps, for weak phones.
 * - Resizes with its host element; portrait screens get a wider field of view.
 * - Cancels the default "lose the GL context for good" so three can restore it.
 * - dispose() frees the context immediately, so replaying never hits the browser's limit.
 *
 * Only scene modules import this, and they are lazily loaded, so three stays out of the
 * main bundle. Throws when WebGL is unavailable; callers catch that.
 */

import * as THREE from 'three';

const LOW_FPS = 40;
const FPS_SAMPLE_MS = 2500;

export interface ThreeStageOptions {
  clearColor: number;
  fog: { near: number; far: number };
  fov: { landscape: number; portrait: number };
  far?: number;
}

export interface ThreeStage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  /** Field of view for the current orientation, before any per-frame effect. */
  baseFov(): number;
  /** Registers a geometry, material or texture to be freed on dispose. */
  keep<T extends { dispose(): void }>(item: T): T;
  /** Feed every frame's dt for the first seconds; lowers the pixel ratio if the device struggles. */
  sampleFrame(dt: number): void;
  dispose(): void;
}

export function createThreeStage(host: HTMLElement, options: ThreeStageOptions): ThreeStage {
  const renderer = new THREE.WebGLRenderer({
    antialias: window.devicePixelRatio < 2,
    alpha: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(options.clearColor);

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(options.clearColor, options.fog.near, options.fog.far);
  const camera = new THREE.PerspectiveCamera(options.fov.landscape, 1, 0.1, options.far ?? 120);

  const disposables: { dispose(): void }[] = [];
  let fov = options.fov.landscape;

  function resize(): void {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    fov = camera.aspect < 1 ? options.fov.portrait : options.fov.landscape;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  const onContextLost = (event: Event): void => event.preventDefault();
  canvas.addEventListener('webglcontextlost', onContextLost);

  let frames = 0;
  let sampledMs = 0;
  let sampled = false;

  return {
    renderer,
    scene,
    camera,
    canvas,
    baseFov: () => fov,
    keep(item) {
      disposables.push(item);
      return item;
    },
    sampleFrame(dt) {
      if (sampled) return;
      frames += 1;
      sampledMs += dt * 1000;
      if (sampledMs < FPS_SAMPLE_MS) return;
      sampled = true;
      if ((frames * 1000) / sampledMs < LOW_FPS && renderer.getPixelRatio() > 1) {
        renderer.setPixelRatio(1);
        resize();
      }
    },
    dispose() {
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

/** A rounded neon label drawn to a canvas, for sprites. */
export function labelTexture(
  text: string,
  color: string,
  size: { width: number; height: number; font: number } = { width: 256, height: 96, font: 48 },
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d')!;
  const inset = 6;
  ctx.fillStyle = 'rgba(6, 8, 12, 0.85)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(inset, inset, size.width - inset * 2, size.height - inset * 2, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `bold ${size.font}px "Share Tech Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size.width / 2, size.height / 2 + 2, size.width - 28);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft white radial dot; tint it through the sprite material colour. */
export function glowTexture(): THREE.CanvasTexture {
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
