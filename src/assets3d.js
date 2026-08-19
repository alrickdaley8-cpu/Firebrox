// Shared 3D asset builders: planet textures, sprites, starfield, the ship.
import * as THREE from 'three';
import { Noise } from './noise.js';
import { RNG } from './rng.js';

export function radialSprite(color, size = 128, power = 2) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const col = new THREE.Color(color);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const a = Math.pow(1 - t, power);
    g.addColorStop(t, `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${a})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const texCache = new Map();

export function planetTexture(planet, W = 512, H = 256) {
  const key = 'p' + planet.seed;
  if (texCache.has(key)) return texCache.get(key);

  const noise = new Noise(planet.seed);
  const rng = new RNG(planet.seed ^ 0x5f5f);
  const pal = planet.biome.ground.map((h) => new THREE.Color(h));
  const rock = new THREE.Color(planet.biome.rock);
  const isOcean = planet.biomeKey === 'ocean';
  const water = new THREE.Color(isOcean ? '#1c4f7a' : '#20496b');
  const ice = new THREE.Color('#eef6ff');
  const iceCaps = rng.float(0.55, 0.95);
  const seaLevel = isOcean ? 0.18 : rng.float(-0.32, 0.02);
  const warp = rng.float(0.4, 1.4);

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const col = new THREE.Color();

  for (let y = 0; y < H; y++) {
    const lat = (y / (H - 1)) * Math.PI;      // 0..PI
    const sy = Math.cos(lat);
    const sr = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2;
      const sx = sr * Math.cos(lon);
      const sz = sr * Math.sin(lon);
      const f = 1.8;
      const w = noise.noise3D(sx * 3 + 11, sy * 3, sz * 3) * warp * 0.3;
      let h = 0, amp = 1, freq = f, norm = 0;
      for (let o = 0; o < 6; o++) {
        h += amp * noise.noise3D((sx + w) * freq, (sy + w) * freq, (sz + w) * freq);
        norm += amp;
        amp *= 0.52; freq *= 2.05;
      }
      h /= norm;

      if (h < seaLevel) {
        col.copy(water).lerp(pal[1], Math.max(0, (h - seaLevel + 0.35)) * 0.5);
      } else {
        const t = (h - seaLevel) / (1 - seaLevel);
        col.copy(pal[0]).lerp(pal[1], Math.min(1, t * 1.6));
        if (t > 0.45) col.lerp(rock, Math.min(1, (t - 0.45) * 2.2));
        if (t > 0.78) col.lerp(pal[2], (t - 0.78) * 3);
      }
      // polar caps
      const polar = Math.abs(sy);
      if (polar > iceCaps) col.lerp(ice, Math.min(1, (polar - iceCaps) / (1 - iceCaps)));

      const i = (y * W + x) * 4;
      d[i] = col.r * 255; d[i + 1] = col.g * 255; d[i + 2] = col.b * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  texCache.set(key, tex);
  return tex;
}

export function makeStarfield(count = 6000, radius = 300000, seed = 7) {
  const rng = new RNG(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = rng.float(-1, 1);
    const th = rng.float(0, Math.PI * 2);
    const s = Math.sqrt(1 - u * u);
    const r = radius * rng.float(0.75, 1);
    pos[i * 3] = Math.cos(th) * s * r;
    pos[i * 3 + 1] = u * r;
    pos[i * 3 + 2] = Math.sin(th) * s * r;
    c.setHSL(rng.float(0.5, 0.72), rng.float(0, 0.5), rng.float(0.65, 1));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.2, vertexColors: true, sizeAttenuation: false,
    map: radialSprite('#ffffff', 64, 2.4), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

export function buildShip() {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: '#d9e3ee', metalness: 0.55, roughness: 0.35 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#ff7a3d', metalness: 0.4, roughness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#0d2b3d', metalness: 0.9, roughness: 0.08, emissive: '#123f57', emissiveIntensity: 0.6 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 3.2, 6, 14), hullMat);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.6, 14), hullMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  g.add(nose);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  canopy.position.set(0, 0.62, -1.1);
  canopy.scale.set(1, 0.8, 1.7);
  g.add(canopy);

  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.22, 1.9), hullMat);
    wing.position.set(s * 2.3, -0.1, 0.5);
    wing.rotation.z = s * 0.12;
    wing.rotation.y = s * 0.22;
    g.add(wing);

    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 1.4), trimMat);
    tip.position.set(s * 4.0, 0.25, 0.6);
    g.add(tip);

    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.7, 10), trimMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(s * 1.5, -0.15, 1.9);
    g.add(engine);
  }

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 1.5), trimMat);
  fin.position.set(0, 0.85, 2.0);
  g.add(fin);

  // thruster glow
  const thruster = new THREE.Group();
  for (const s of [-1, 1]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialSprite('#66d9ff', 128, 2), blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false,
    }));
    sp.position.set(s * 1.5, -0.15, 2.9);
    sp.scale.set(1.6, 1.6, 1);
    thruster.add(sp);
  }
  g.add(thruster);
  g.userData.thruster = thruster;
  return g;
}
