// Procedural universe: galaxy -> star systems -> planets, all derived from seeds.
import { RNG, hashString } from './rng.js';

const SYLL_A = ['ar', 'be', 'ca', 'del', 'e', 'fen', 'gro', 'hy', 'ix', 'ja', 'kor', 'lu', 'mor', 'ny', 'ob', 'pra', 'quo', 'ra', 'sol', 'tya', 'ur', 'vex', 'wa', 'xen', 'yl', 'zor', 'thal', 'esh', 'omi', 'kryv'];
const SYLL_B = ['ban', 'cor', 'dan', 'eth', 'far', 'gal', 'hex', 'ith', 'jan', 'kal', 'lon', 'mus', 'nar', 'oph', 'pin', 'qir', 'ros', 'sem', 'tal', 'uun', 'vor', 'wen', 'xis', 'yon', 'zed', 'drex', 'phos', 'quil'];
const SYLL_C = ['a', 'ia', 'is', 'us', 'ex', 'or', 'um', 'ai', 'oth', 'eus', 'yn', 'ar', 'ux', 'ess'];
const GREEK = ['Prime', 'Secundus', 'Tertius', 'Minor', 'Major', 'Nova', 'Ultra', 'Cluster', 'Anomaly', 'Reach', 'Expanse', 'Verge'];

export function makeName(rng, withSuffix = false) {
  let n = rng.pick(SYLL_A) + rng.pick(SYLL_B);
  if (rng.chance(0.45)) n += rng.pick(SYLL_C);
  n = n[0].toUpperCase() + n.slice(1);
  if (withSuffix && rng.chance(0.5)) n += ' ' + rng.pick(GREEK);
  if (rng.chance(0.25)) n += ' ' + rng.int(2, 99);
  return n;
}

export const BIOMES = {
  lush: {
    label: 'Lush', ground: ['#4a7c3f', '#2f5d2a', '#6d9c4a'], rock: '#6a5a45',
    sky: '#7fc4ff', fog: '#a8dcff', night: '#0a1728', hazard: 'None',
    flora: 1.0, fauna: 0.9, amp: 1.0, water: '#1f6f8f', floraStyle: 'tree',
  },
  desert: {
    label: 'Scorched', ground: ['#c9a15a', '#e0b878', '#a87c3f'], rock: '#8d6a3a',
    sky: '#ffb45e', fog: '#ffd39a', night: '#2a1608', hazard: 'Extreme Heat',
    flora: 0.25, fauna: 0.2, amp: 0.85, water: '#8a6a2f', floraStyle: 'cactus',
  },
  frozen: {
    label: 'Frozen', ground: ['#dceaf2', '#b8d4e6', '#8fb3cc'], rock: '#7d8c99',
    sky: '#bcd8ee', fog: '#dbeaf6', night: '#0c1a2b', hazard: 'Deep Freeze',
    flora: 0.2, fauna: 0.3, amp: 1.2, water: '#4c86a8', floraStyle: 'spike',
  },
  toxic: {
    label: 'Toxic', ground: ['#7fbf3f', '#5c9130', '#9fd94f'], rock: '#54633a',
    sky: '#b6ff6e', fog: '#c9f58c', night: '#12240a', hazard: 'Toxic Rain',
    flora: 0.8, fauna: 0.5, amp: 0.9, water: '#7fbf3f', floraStyle: 'mushroom',
  },
  irradiated: {
    label: 'Irradiated', ground: ['#c8b53f', '#9c8a2e', '#e6d15c'], rock: '#6f6533',
    sky: '#f3e07a', fog: '#f7ecb0', night: '#221d06', hazard: 'Radiation',
    flora: 0.4, fauna: 0.3, amp: 1.05, water: '#a89c3a', floraStyle: 'spike',
  },
  barren: {
    label: 'Barren', ground: ['#8a8378', '#6d675e', '#a49b8d'], rock: '#5b564e',
    sky: '#4b5566', fog: '#6e7a8c', night: '#060a10', hazard: 'None',
    flora: 0.05, fauna: 0.06, amp: 1.35, water: '#3d4654', floraStyle: 'spike',
  },
  volcanic: {
    label: 'Volcanic', ground: ['#4a3230', '#2e1f1e', '#6b3a2c'], rock: '#3a2825',
    sky: '#ff6a3d', fog: '#9c3b22', night: '#1a0603', hazard: 'Firestorms',
    flora: 0.15, fauna: 0.15, amp: 1.55, water: '#ff5a1f', floraStyle: 'spike',
  },
  exotic: {
    label: 'Exotic', ground: ['#a45cd6', '#6f3fbf', '#d67fe8'], rock: '#4c2f6b',
    sky: '#e07dff', fog: '#c79cf0', night: '#160a26', hazard: 'Anomalous',
    flora: 0.7, fauna: 0.6, amp: 1.7, water: '#8a4fd8', floraStyle: 'orb',
  },
  ocean: {
    label: 'Oceanic', ground: ['#3f8f8a', '#2c6b6f', '#5fb0a3'], rock: '#4a6b6b',
    sky: '#63d5ff', fog: '#9fe8f2', night: '#04202b', hazard: 'None',
    flora: 0.8, fauna: 0.85, amp: 0.75, water: '#12708f', floraStyle: 'tree',
  },
  fungal: {
    label: 'Fungal', ground: ['#a8654f', '#7d4436', '#d18a63'], rock: '#5f3b30',
    sky: '#ffb9a0', fog: '#e8b39c', night: '#1d0d0a', hazard: 'Spore Bloom',
    flora: 1.1, fauna: 0.7, amp: 0.8, water: '#7a4a5e', floraStyle: 'mushroom',
  },
  crystalline: {
    label: 'Crystalline', ground: ['#7fa8d6', '#5b7fb0', '#b8d8f2'], rock: '#4a5f7d',
    sky: '#c8e6ff', fog: '#dceeff', night: '#08111f', hazard: 'Shard Storms',
    flora: 0.35, fauna: 0.25, amp: 1.45, water: '#2f6d9c', floraStyle: 'crystal',
  },
  crimson: {
    label: 'Crimson', ground: ['#a83b3b', '#7a2626', '#d16060'], rock: '#5f2020',
    sky: '#ff8080', fog: '#e09a9a', night: '#200606', hazard: 'Blood Storms',
    flora: 0.5, fauna: 0.55, amp: 1.15, water: '#7a1f2f', floraStyle: 'orb',
  },
};

const BIOME_KEYS = Object.keys(BIOMES);

export const RESOURCES = {
  carbon: { label: 'Carbon', color: '#8fdc6a', icon: 'C', value: 12 },
  ferrite: { label: 'Ferrite Dust', color: '#d8a45a', icon: 'Fe', value: 14 },
  sodium: { label: 'Sodium', color: '#ffd85c', icon: 'Na', value: 22 },
  dihydrogen: { label: 'Di-hydrogen', color: '#6ad2ff', icon: 'H', value: 34 },
  platinum: { label: 'Platinum', color: '#e0e6ff', icon: 'Pt', value: 90 },
  chromatic: { label: 'Chromatic Metal', color: '#ff9de0', icon: 'Cr', value: 145 },
  warpcell: { label: 'Warp Cell', color: '#ff7de0', icon: 'W', value: 400 },
};

export const ECONOMIES = {
  Mining: { buy: 0.9, sell: 1.25, wants: ['carbon', 'dihydrogen'] },
  Trading: { buy: 0.8, sell: 1.35, wants: ['platinum', 'chromatic'] },
  Manufacturing: { buy: 1.0, sell: 1.15, wants: ['ferrite', 'platinum'] },
  Research: { buy: 1.1, sell: 1.4, wants: ['chromatic', 'sodium'] },
  'Power Generation': { buy: 0.95, sell: 1.2, wants: ['dihydrogen', 'sodium'] },
  Abandoned: { buy: 1.4, sell: 0.7, wants: [] },
};

export const STAR_CLASSES = {
  Yellow: { color: '#ffd9a0', drive: null, weight: 34 },
  White: { color: '#ffe9c8', drive: null, weight: 22 },
  'Red Giant': { color: '#ff9d6b', drive: 'cadmium', weight: 16 },
  'Green Anomaly': { color: '#9fffe0', drive: 'emeril', weight: 12 },
  Blue: { color: '#a8c8ff', drive: 'indium', weight: 11 },
  'Pink Dwarf': { color: '#ffb0e8', drive: 'indium', weight: 5 },
};

export const DRIVES = {
  cadmium: { label: 'Cadmium Drive', unlocks: 'Red Giant systems', nanites: 250 },
  emeril: { label: 'Emeril Drive', unlocks: 'Green Anomaly systems', nanites: 450 },
  indium: { label: 'Indium Drive', unlocks: 'Blue & Pink Dwarf systems', nanites: 700 },
};

// ---------------------------------------------------------------- galaxies
// Sixteen hand-named galaxies, each with its own shape, palette and character.
export const GALAXIES = [
  { name: 'Euclid-VII', type: 'spiral', arms: 4, hue: ['#5b8cff', '#c48fff', '#0a0f1c'], traits: { hostility: 1.0, richness: 1.0, exotic: 1.0, size: 320 } },
  { name: 'Hilbert Dimension', type: 'barred', arms: 2, hue: ['#ff9f43', '#7d5bff', '#120a1c'], traits: { hostility: 1.25, richness: 1.05, exotic: 1.1, size: 300 } },
  { name: 'Calypso', type: 'spiral', arms: 5, hue: ['#63e6ff', '#2f7dff', '#03121c'], traits: { hostility: 0.75, richness: 1.2, exotic: 0.9, size: 340 } },
  { name: 'Hesperius Dimension', type: 'elliptical', arms: 0, hue: ['#ffd166', '#ff6a3d', '#1a0d05'], traits: { hostility: 1.15, richness: 0.85, exotic: 1.25, size: 280 } },
  { name: 'Hyades', type: 'ring', arms: 0, hue: ['#9dffc4', '#3fbf8f', '#04170f'], traits: { hostility: 0.9, richness: 1.35, exotic: 0.8, size: 300 } },
  { name: 'Ickjamatew', type: 'irregular', arms: 0, hue: ['#ff7de0', '#8a2f5b', '#180310'], traits: { hostility: 1.4, richness: 0.9, exotic: 1.4, size: 260 } },
  { name: 'Budullangr', type: 'spiral', arms: 3, hue: ['#a8c8ff', '#5b2f8a', '#070a18'], traits: { hostility: 1.0, richness: 1.0, exotic: 1.15, size: 320 } },
  { name: 'Kikolgallr', type: 'barred', arms: 2, hue: ['#ffe066', '#ff9f43', '#170f03'], traits: { hostility: 1.3, richness: 1.1, exotic: 0.95, size: 300 } },
  { name: 'Eltiensleen', type: 'ring', arms: 0, hue: ['#c8ffe6', '#4fa8b8', '#04141a'], traits: { hostility: 0.7, richness: 1.25, exotic: 1.0, size: 340 } },
  { name: 'Eissentam', type: 'spiral', arms: 6, hue: ['#b6ff6e', '#4a7c3f', '#08150a'], traits: { hostility: 0.6, richness: 1.5, exotic: 1.2, size: 360 } },
  { name: 'Elkupalos', type: 'elliptical', arms: 0, hue: ['#e0e6ff', '#7f8b99', '#0b0e14'], traits: { hostility: 1.1, richness: 0.8, exotic: 1.05, size: 280 } },
  { name: 'Aptarkaba', type: 'irregular', arms: 0, hue: ['#ff5a3c', '#8a1f1f', '#1a0505'], traits: { hostility: 1.55, richness: 1.0, exotic: 1.3, size: 260 } },
  { name: 'Ontiniangp', type: 'spiral', arms: 4, hue: ['#8fd6ff', '#3f5bbf', '#050b18'], traits: { hostility: 0.95, richness: 1.1, exotic: 1.0, size: 320 } },
  { name: 'Odiwagiri', type: 'barred', arms: 3, hue: ['#ffb066', '#c44f2f', '#150703'], traits: { hostility: 1.2, richness: 1.15, exotic: 1.1, size: 300 } },
  { name: 'Ogtialabi', type: 'ring', arms: 0, hue: ['#d67fe8', '#6f3fbf', '#100320'], traits: { hostility: 1.35, richness: 1.2, exotic: 1.45, size: 320 } },
  { name: 'Muhacksonto', type: 'irregular', arms: 0, hue: ['#ffffff', '#a8c8ff', '#02040a'], traits: { hostility: 1.6, richness: 1.6, exotic: 1.6, size: 380 } },
];

export const GALAXY_NAME = GALAXIES[0].name;

export function galaxyDef(index) {
  return GALAXIES[((index % GALAXIES.length) + GALAXIES.length) % GALAXIES.length];
}

function weightedStar(rng) {
  const entries = Object.entries(STAR_CLASSES);
  const total = entries.reduce((a, [, v]) => a + v.weight, 0);
  let roll = rng.float(0, total);
  for (const [name, def] of entries) {
    roll -= def.weight;
    if (roll <= 0) return { name, ...def };
  }
  return { name: 'Yellow', ...STAR_CLASSES.Yellow };
}

// Shape functions produce a position for star i of count.
function shapePosition(type, arms, rng, t, i, count) {
  switch (type) {
    case 'barred': {
      const arm = i % Math.max(1, arms);
      if (t < 0.28) {
        // central bar
        const along = rng.float(-1, 1);
        return {
          x: along * 420,
          y: rng.float(-1, 1) * 60,
          z: rng.float(-1, 1) * 90,
        };
      }
      const angle = (t - 0.28) * Math.PI * 2.6 + (arm / Math.max(1, arms)) * Math.PI * 2 + rng.float(-0.2, 0.2);
      const radius = 320 + t * 780 + rng.float(-40, 40);
      return { x: Math.cos(angle) * radius, y: rng.float(-1, 1) * 70 * (1.2 - t), z: Math.sin(angle) * radius };
    }
    case 'elliptical': {
      const u = rng.float(-1, 1);
      const th = rng.float(0, Math.PI * 2);
      const r = Math.pow(rng.float(0, 1), 0.55) * 1000;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      return { x: Math.cos(th) * s * r * 1.25, y: u * r * 0.45, z: Math.sin(th) * s * r };
    }
    case 'ring': {
      const angle = rng.float(0, Math.PI * 2);
      const band = rng.chance(0.22) ? rng.float(0, 240) : rng.float(620, 1020);
      return { x: Math.cos(angle) * band, y: rng.float(-1, 1) * 55, z: Math.sin(angle) * band };
    }
    case 'irregular': {
      // clumpy clusters
      const clusterCount = 9;
      const c = i % clusterCount;
      const crng = new RNG(hashString(`cluster:${type}:${c}`));
      const cx = crng.float(-900, 900), cy = crng.float(-160, 160), cz = crng.float(-900, 900);
      return {
        x: cx + rng.float(-1, 1) * 240,
        y: cy + rng.float(-1, 1) * 90,
        z: cz + rng.float(-1, 1) * 240,
      };
    }
    case 'spiral':
    default: {
      const arm = i % Math.max(1, arms);
      const angle = t * Math.PI * 3.4 + (arm / Math.max(1, arms)) * Math.PI * 2 + rng.float(-0.24, 0.24);
      const radius = t * 1000 + rng.float(-45, 45);
      return { x: Math.cos(angle) * radius, y: rng.float(-1, 1) * 80 * (1.15 - t), z: Math.sin(angle) * radius };
    }
  }
}

// Deterministic galaxy generator. `index` selects one of the named galaxies.
export function generateGalaxy(index = 0, countOverride = null) {
  const def = galaxyDef(index);
  const seed = `firebrox:${def.name}`;
  const count = countOverride || def.traits.size;
  const rng = new RNG(seed);
  const systems = [];

  for (let i = 0; i < count; i++) {
    const t = rng.float(0.06, 1.0);
    const pos = shapePosition(def.type, def.arms, rng, t, i, count);
    const sysSeed = hashString(`${seed}:sys:${i}`);
    const srng = new RNG(sysSeed);
    const star = weightedStar(srng);
    const dangerRoll = srng.float(0, 1) * def.traits.hostility;
    const danger = dangerRoll < 0.28 ? 'Low' : dangerRoll < 0.55 ? 'Low'
      : dangerRoll < 0.78 ? 'Moderate' : dangerRoll < 1.05 ? 'High' : 'Extreme';
    const radius = Math.hypot(pos.x, pos.y, pos.z);
    systems.push({
      id: i,
      seed: sysSeed,
      name: makeName(srng, true),
      pos,
      starColor: star.color,
      starClass: star.name,
      drive: star.drive,
      planetCount: srng.int(2, 6),
      economy: srng.pick(Object.keys(ECONOMIES)),
      wealth: srng.pick(['Struggling', 'Developing', 'Comfortable', 'Prosperous', 'Opulent']),
      danger,
      pirates: { Low: 0, Moderate: 2, High: 4, Extreme: 6 }[danger] ?? 0,
      distFromCore: radius,
      hasBlackHole: srng.chance(0.18),
      hasFreighter: srng.chance(0.55),
      hasAnomaly: srng.chance(0.3),
      richness: def.traits.richness,
      exotic: def.traits.exotic,
      wormholeTo: null,
      isCore: false,
    });
  }

  // No star may be stranded: pull isolated systems into hyperdrive range of a neighbour.
  const BASE_RANGE = 200;
  for (const a of systems) {
    let nearest = null, nd = Infinity;
    for (const b of systems) {
      if (a === b) continue;
      const d = distance(a.pos, b.pos);
      if (d < nd) { nd = d; nearest = b; }
    }
    if (nearest && nd > BASE_RANGE) {
      const t = 1 - BASE_RANGE / nd;
      a.pos.x += (nearest.pos.x - a.pos.x) * t;
      a.pos.y += (nearest.pos.y - a.pos.y) * t;
      a.pos.z += (nearest.pos.z - a.pos.z) * t;
      a.distFromCore = Math.hypot(a.pos.x, a.pos.y, a.pos.z);
    }
  }

  // the innermost system is the galactic core
  let core = systems[0];
  for (const s of systems) if (s.distFromCore < core.distFromCore) core = s;
  core.isCore = true;
  core.name = 'The Core';
  core.hasBlackHole = false;
  core.hasAnomaly = true;

  // ---- wormhole network: long-range shortcuts between distant systems
  const wrng = new RNG(seed + ':wormholes');
  const pairCount = Math.max(6, Math.floor(count / 22));
  const used = new Set([core.id]);
  const wormholes = [];
  for (let i = 0; i < pairCount * 6 && wormholes.length < pairCount; i++) {
    const a = systems[wrng.int(0, systems.length - 1)];
    const b = systems[wrng.int(0, systems.length - 1)];
    if (a === b || used.has(a.id) || used.has(b.id)) continue;
    const d = distance(a.pos, b.pos);
    if (d < 600) continue;             // must actually be a shortcut
    a.wormholeTo = b.id;
    b.wormholeTo = a.id;
    used.add(a.id); used.add(b.id);
    wormholes.push({ a: a.id, b: b.id, dist: d });
  }

  // ---- intergalactic wormhole: one rare gate out of the galaxy entirely
  const far = systems
    .filter((s) => !s.isCore && s.wormholeTo == null)
    .sort((x, y) => y.distFromCore - x.distFromCore);
  const gate = far[wrng.int(0, Math.min(5, far.length - 1))];
  if (gate) {
    gate.intergalactic = true;
    gate.name = 'The Gate — ' + gate.name;
  }

  return {
    index: ((index % GALAXIES.length) + GALAXIES.length) % GALAXIES.length,
    seed,
    name: def.name,
    type: def.type,
    hue: def.hue,
    traits: def.traits,
    systems,
    coreId: core.id,
    wormholes,
    gateId: gate ? gate.id : null,
  };
}

export function canWarpTo(system, drives) {
  if (!system.drive) return true;
  return !!drives[system.drive];
}

// Breadth-first route across the jump graph, honouring range and drive gating.
export function planRoute(galaxy, fromId, toId, range, drives) {
  if (fromId === toId) return [];
  const systems = galaxy.systems;
  const prev = new Map([[fromId, null]]);
  const queue = [fromId];
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    const cur = systems[id];
    if (cur.wormholeTo != null && !prev.has(cur.wormholeTo)) {
      prev.set(cur.wormholeTo, id);
      if (cur.wormholeTo === toId) break;
      queue.push(cur.wormholeTo);
    }
    for (const other of systems) {
      if (prev.has(other.id)) continue;
      if (!canWarpTo(other, drives)) continue;
      if (distance(cur.pos, other.pos) > range) continue;
      prev.set(other.id, id);
      if (other.id === toId) { head = queue.length; break; }
      queue.push(other.id);
    }
    if (prev.has(toId)) break;
  }
  if (!prev.has(toId)) return null;
  const path = [];
  let cur = toId;
  while (cur != null && cur !== fromId) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return path;
}

export function buildSystem(sysMeta) {
  const rng = new RNG(sysMeta.seed ^ 0x9e3779b9);
  const planets = [];
  let orbit = 2600;
  for (let i = 0; i < sysMeta.planetCount; i++) {
    const prng = new RNG(sysMeta.seed + i * 7919);
    const biomeKey = prng.pick(BIOME_KEYS);
    const biome = BIOMES[biomeKey];
    const radius = prng.float(320, 680);
    orbit += prng.float(1500, 3400);
    planets.push({
      index: i,
      seed: (sysMeta.seed + i * 7919) >>> 0,
      name: makeName(prng, false),
      biomeKey,
      biome,
      radius,
      orbit,
      orbitAngle: prng.float(0, Math.PI * 2),
      orbitSpeed: prng.float(0.004, 0.014) / (1 + i * 0.4),
      tilt: prng.float(-0.4, 0.4),
      hasRings: prng.chance(0.24),
      moons: prng.int(0, 2),
      weather: prng.pick(['Calm', 'Windy', 'Storms', 'Clear Skies', 'Dust Haze', 'Heavy Rain']),
      sentinels: prng.pick(['Passive', 'Passive', 'Low', 'Aggressive']),
      gravity: prng.float(0.65, 1.5),
      dayLength: prng.float(150, 420),
      flora: biome.flora * prng.float(0.6, 1.3),
      fauna: biome.fauna * prng.float(0.5, 1.3),
      ruins: prng.float(0.3, 1.4),
      resources: prng.shuffle(['carbon', 'ferrite', 'sodium', 'dihydrogen', 'platinum', 'chromatic']).slice(0, 3),
      discovered: false,
    });
  }
  return { ...sysMeta, planets, spaceStation: true };
}

export function distance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Alien monolith / ruin lore
const LORE = [
  'THE TRAVELLER ASKS: what lies past the final star?',
  'WE BUILT THE ATLAS. THE ATLAS BUILT US.',
  'SIXTEEN. THE NUMBER REPEATS IN EVERY SKY.',
  'A CIVILISATION SLEEPS BENEATH THIS DUST.',
  'THE SENTINELS REMEMBER WHAT WE CHOSE TO FORGET.',
  'PORTAL GLYPHS ARE A LANGUAGE OF COORDINATES.',
  'THE FIRST SPAWN CAME FROM THE CENTRE AND WEPT.',
  'YOU ARE NOT THE FIRST TO STAND HERE. YOU WILL NOT BE THE LAST.',
];

export function loreLine(rng) { return rng.pick(LORE); }
