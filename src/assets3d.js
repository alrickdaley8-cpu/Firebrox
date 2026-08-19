// Shared 3D asset builders: planet textures, sky, sprites, starfield, ships, ruins.
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

// ---------------------------------------------------------------- planets
export function planetTextures(planet, W = 640, H = 320) {
  const key = 'p' + planet.seed;
  if (texCache.has(key)) return texCache.get(key);

  const noise = new Noise(planet.seed);
  const rng = new RNG(planet.seed ^ 0x5f5f);
  const pal = planet.biome.ground.map((h) => new THREE.Color(h));
  const rock = new THREE.Color(planet.biome.rock);
  const isOcean = planet.biomeKey === 'ocean';
  const water = new THREE.Color(planet.biome.water);
  const ice = new THREE.Color('#eef6ff');
  const iceCaps = rng.float(0.6, 0.97);
  const seaLevel = isOcean ? 0.2 : rng.float(-0.34, 0.04);
  const warp = rng.float(0.4, 1.4);

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;

  // bump/roughness map alongside colour
  const bc = document.createElement('canvas');
  bc.width = W; bc.height = H;
  const bctx = bc.getContext('2d');
  const bimg = bctx.createImageData(W, H);
  const bd = bimg.data;

  const col = new THREE.Color();

  for (let y = 0; y < H; y++) {
    const lat = (y / (H - 1)) * Math.PI;
    const sy = Math.cos(lat);
    const sr = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2;
      const sx = sr * Math.cos(lon);
      const sz = sr * Math.sin(lon);
      const w = noise.noise3D(sx * 3 + 11, sy * 3, sz * 3) * warp * 0.3;
      let h = 0, amp = 1, freq = 1.8, norm = 0;
      for (let o = 0; o < 7; o++) {
        h += amp * noise.noise3D((sx + w) * freq, (sy + w) * freq, (sz + w) * freq);
        norm += amp;
        amp *= 0.52; freq *= 2.05;
      }
      h /= norm;

      let land = 1;
      if (h < seaLevel) {
        const depth = THREE.MathUtils.clamp((seaLevel - h) * 3, 0, 1);
        col.copy(water).multiplyScalar(1 - depth * 0.55);
        land = 0;
      } else {
        const t = (h - seaLevel) / (1 - seaLevel);
        col.copy(pal[0]).lerp(pal[1], Math.min(1, t * 1.6));
        if (t > 0.42) col.lerp(rock, Math.min(1, (t - 0.42) * 2.2));
        if (t > 0.76) col.lerp(pal[2], (t - 0.76) * 3);
        // biome banding by latitude
        const band = Math.abs(sy);
        col.lerp(pal[2], Math.max(0, band - 0.5) * 0.4);
      }
      const polar = Math.abs(sy);
      if (polar > iceCaps) col.lerp(ice, Math.min(1, (polar - iceCaps) / (1 - iceCaps)));

      const i = (y * W + x) * 4;
      d[i] = col.r * 255; d[i + 1] = col.g * 255; d[i + 2] = col.b * 255; d[i + 3] = 255;
      const bump = THREE.MathUtils.clamp((h - seaLevel) * 220 + 120, 0, 255) * land + (1 - land) * 90;
      bd[i] = bd[i + 1] = bd[i + 2] = bump; bd[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(bc);
  bump.wrapS = THREE.RepeatWrapping;

  // cloud layer
  const cc = document.createElement('canvas');
  cc.width = W / 2; cc.height = H / 2;
  const cctx = cc.getContext('2d');
  const cimg = cctx.createImageData(cc.width, cc.height);
  const cd = cimg.data;
  const cloudiness = rng.float(-0.15, 0.45);
  for (let y = 0; y < cc.height; y++) {
    const lat = (y / (cc.height - 1)) * Math.PI;
    const sy = Math.cos(lat), sr = Math.sin(lat);
    for (let x = 0; x < cc.width; x++) {
      const lon = (x / cc.width) * Math.PI * 2;
      const sx = sr * Math.cos(lon), sz = sr * Math.sin(lon);
      let v = 0, amp = 1, freq = 2.4, norm = 0;
      for (let o = 0; o < 5; o++) {
        v += amp * noise.noise3D(sx * freq + 50, sy * freq * 2.2, sz * freq);
        norm += amp; amp *= 0.5; freq *= 2.1;
      }
      v = v / norm + cloudiness;
      const a = THREE.MathUtils.clamp(v * 2.4, 0, 1) * 255;
      const i = (y * cc.width + x) * 4;
      cd[i] = cd[i + 1] = cd[i + 2] = 255;
      cd[i + 3] = a;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  const clouds = new THREE.CanvasTexture(cc);
  clouds.colorSpace = THREE.SRGBColorSpace;
  clouds.wrapS = THREE.RepeatWrapping;

  const out = { map, bump, clouds, hasClouds: cloudiness > -0.05 };
  texCache.set(key, out);
  return out;
}

// Fresnel atmosphere shell
export function atmosphereMaterial(color, power = 3.0, intensity = 1.1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uIntensity: { value: intensity },
    },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir))), uPower);
        gl_FragColor = vec4(uColor, f * uIntensity);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

// ---------------------------------------------------------------- sky / stars
export function makeStarfield(count = 9000, radius = 400000, seed = 7) {
  const rng = new RNG(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = rng.float(-1, 1);
    const th = rng.float(0, Math.PI * 2);
    const s = Math.sqrt(1 - u * u);
    const r = radius * rng.float(0.75, 1);
    pos[i * 3] = Math.cos(th) * s * r;
    pos[i * 3 + 1] = u * r;
    pos[i * 3 + 2] = Math.sin(th) * s * r;
    c.setHSL(rng.float(0.5, 0.75), rng.float(0, 0.6), rng.float(0.6, 1));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    sizes[i] = rng.chance(0.06) ? rng.float(3, 5.5) : rng.float(1, 2.2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 } },
    vertexShader: `
      attribute float aSize;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize;
      }`,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float a = smoothstep(0.5, 0.0, d) * uOpacity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
      }`,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// Painted nebula cube-ish backdrop rendered as a large inverted sphere.
export function makeNebula(seed = 3, colors = ['#5b2f8a', '#1f4c8a', '#8a2f5b']) {
  const n = new Noise(seed);
  const W = 640, H = 320;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const cols = colors.map((x) => new THREE.Color(x));
  const out = new THREE.Color();
  for (let y = 0; y < H; y++) {
    const lat = (y / (H - 1)) * Math.PI;
    const sy = Math.cos(lat), sr = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2;
      const sx = sr * Math.cos(lon), sz = sr * Math.sin(lon);
      let v = 0, amp = 1, freq = 1.2, norm = 0;
      for (let o = 0; o < 5; o++) {
        v += amp * Math.abs(n.noise3D(sx * freq, sy * freq, sz * freq));
        norm += amp; amp *= 0.55; freq *= 2.1;
      }
      v = Math.pow(v / norm, 2.1);
      const band = 0.55 + 0.45 * Math.sin(lon * 2 + sy * 3);
      out.copy(cols[0]).lerp(cols[1], band).lerp(cols[2], v);
      const i = (y * W + x) * 4;
      const k = v * 1.5;
      d[i] = out.r * 255 * k; d[i + 1] = out.g * 255 * k; d[i + 2] = out.b * 255 * k; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

// ---------------------------------------------------------------- ships
export function buildShip(palette = {}) {
  const hullColor = palette.hull || '#d9e3ee';
  const trimColor = palette.trim || '#ff7a3d';
  const g = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: hullColor, metalness: 0.6, roughness: 0.3 });
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, metalness: 0.45, roughness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#0d2b3d', metalness: 0.95, roughness: 0.06, emissive: '#1a5f7f', emissiveIntensity: 0.8 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 3.2, 8, 18), hullMat);
  body.rotation.x = Math.PI / 2;
  g.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.8, 18), hullMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.5;
  g.add(nose);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 5.4), trimMat);
  spine.position.set(0, 0.9, 0.4);
  g.add(spine);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.78, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
  canopy.position.set(0, 0.62, -1.1);
  canopy.scale.set(1, 0.82, 1.75);
  g.add(canopy);

  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.22, 1.9), hullMat);
    wing.position.set(s * 2.3, -0.1, 0.5);
    wing.rotation.z = s * 0.12;
    wing.rotation.y = s * 0.22;
    g.add(wing);

    const strut = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.16, 0.5), trimMat);
    strut.position.set(s * 2.1, 0.22, -0.4);
    strut.rotation.y = s * 0.3;
    g.add(strut);

    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 1.4), trimMat);
    tip.position.set(s * 4.0, 0.3, 0.6);
    g.add(tip);

    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 1.8, 14), trimMat);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(s * 1.5, -0.15, 1.95);
    g.add(engine);

    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 8), hullMat);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(s * 2.6, -0.18, -1.0);
    g.add(gun);
  }

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4, 1.5), trimMat);
  fin.position.set(0, 0.95, 2.0);
  g.add(fin);

  const thruster = new THREE.Group();
  for (const s of [-1, 1]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialSprite(palette.flame || '#66d9ff', 128, 2), blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false,
    }));
    sp.position.set(s * 1.5, -0.15, 3.0);
    sp.scale.set(1.6, 1.6, 1);
    thruster.add(sp);
  }
  g.add(thruster);
  g.userData.thruster = thruster;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildPirate(seed = 1) {
  const rng = new RNG(seed);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#3a2b32', metalness: 0.7, roughness: 0.4 });
  const trim = new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#8a0f0f', emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.4 });

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), mat);
  core.scale.set(1, 0.6, 1.8);
  g.add(core);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.4, 4), mat);
    wing.rotation.z = s * Math.PI / 2;
    wing.position.set(s * 2.6, 0, 0.4);
    g.add(wing);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 8), trim);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(s * 1.4, 0, -1.6);
    g.add(pod);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), trim);
  eye.position.z = -2.4;
  g.add(eye);
  g.rotation.y = rng.float(0, 6);
  return g;
}

export function buildStation(colorA = '#c8d4e0') {
  const st = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: colorA, metalness: 0.75, roughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: '#5c6672', metalness: 0.8, roughness: 0.3 });
  const lit = new THREE.MeshStandardMaterial({ color: '#ffb066', emissive: '#ff8a3d', emissiveIntensity: 2.2 });

  const ring = new THREE.Mesh(new THREE.TorusGeometry(160, 30, 16, 60), hull);
  st.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(96, 12, 12, 40), dark);
  st.add(inner);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(44, 44, 190, 18), hull);
  core.rotation.x = Math.PI / 2;
  st.add(core);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(150, 12, 14), dark);
    spoke.position.set(Math.cos(a) * 80, Math.sin(a) * 80, 0);
    spoke.rotation.z = a;
    st.add(spoke);
    const light = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 6), lit);
    light.position.set(Math.cos(a) * 160, Math.sin(a) * 160, 0);
    st.add(light);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(46, 8, 10, 24), lit);
  mouth.position.z = -96;
  st.add(mouth);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialSprite('#ff8a3d', 128, 2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  glow.position.z = -96;
  glow.scale.set(320, 320, 1);
  st.add(glow);
  return st;
}

// ---------------------------------------------------------------- surface props
export function buildMonolith(rng, color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#2b2b33', roughness: 0.6, metalness: 0.4 });
  const glowMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.4, roughness: 0.2 });
  const h = rng.float(9, 17);
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, h, 1.4), mat);
  body.position.y = h / 2;
  g.add(body);
  const top = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.28, 8, 20), glowMat);
  top.position.y = h * 0.86;
  g.add(top);
  for (let i = 0; i < 4; i++) {
    const rune = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.1), glowMat);
    rune.position.set(rng.float(-0.4, 0.4), h * (0.25 + i * 0.12), 0.75);
    g.add(rune);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.2, 0.8, 8), mat);
  g.add(base);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildCrashedShip(rng) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#7a7f86', metalness: 0.6, roughness: 0.7 });
  const burnt = new THREE.MeshStandardMaterial({ color: '#33302e', metalness: 0.3, roughness: 1 });
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(2.4, 8, 6, 12), mat);
  hull.rotation.set(rng.float(-0.4, 0.4), rng.float(0, 3), Math.PI / 2 + rng.float(-0.3, 0.3));
  hull.position.y = 2;
  g.add(hull);
  for (let i = 0; i < 5; i++) {
    const shard = new THREE.Mesh(new THREE.BoxGeometry(rng.float(1, 4), rng.float(0.2, 0.6), rng.float(1, 3)), burnt);
    shard.position.set(rng.float(-9, 9), rng.float(0.2, 1.4), rng.float(-9, 9));
    shard.rotation.set(rng.float(0, 3), rng.float(0, 3), rng.float(0, 3));
    g.add(shard);
  }
  const wing = new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 3), mat);
  wing.position.set(rng.float(-4, 4), 0.6, rng.float(-4, 4));
  wing.rotation.set(0.2, rng.float(0, 3), 0.6);
  g.add(wing);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildOutpost(rng, accent) {
  const g = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: '#d8d3c6', roughness: 0.8, metalness: 0.1 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.4, roughness: 0.4 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.6, 3.4, 10), wall);
  base.position.y = 1.7;
  g.add(base);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), wall);
  dome.position.y = 3.4;
  g.add(dome);
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 0.3), accentMat);
  door.position.set(0, 1.5, 6.4);
  g.add(door);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 8, 6), wall);
  mast.position.set(4.4, 5, 0);
  g.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), accentMat);
  beacon.position.set(4.4, 9.2, 0);
  g.add(beacon);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
