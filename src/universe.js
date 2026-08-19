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
    flora: 0.8, fauna: 0.85, amp: 0.55, water: '#12708f', floraStyle: 'tree',
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

const STAR_COLORS = [
  { c: '#ffd9a0', name: 'Yellow' },
  { c: '#ffe9c8', name: 'White' },
  { c: '#ff9d6b', name: 'Red Giant' },
  { c: '#a8c8ff', name: 'Blue' },
  { c: '#ffb0e8', name: 'Pink Dwarf' },
  { c: '#9fffe0', name: 'Green Anomaly' },
];

export const GALAXY_NAME = 'Euclid-VII';

// Deterministic galaxy: systems laid out in a loose spiral.
export function generateGalaxy(seed = 'firebrox', count = 320) {
  const rng = new RNG(seed);
  const systems = [];
  const arms = 4;
  for (let i = 0; i < count; i++) {
    const arm = i % arms;
    const t = rng.float(0.06, 1.0);
    const angle = t * Math.PI * 3.4 + (arm / arms) * Math.PI * 2 + rng.float(-0.24, 0.24);
    const radius = t * 1000 + rng.float(-45, 45);
    const x = Math.cos(angle) * radius;
    const y = rng.float(-1, 1) * 80 * (1.15 - t);
    const z = Math.sin(angle) * radius;
    const sysSeed = hashString(`${seed}:sys:${i}`);
    const srng = new RNG(sysSeed);
    const star = srng.pick(STAR_COLORS);
    const danger = srng.pick(['Low', 'Low', 'Moderate', 'High', 'Extreme']);
    systems.push({
      id: i,
      seed: sysSeed,
      name: makeName(srng, true),
      pos: { x, y, z },
      starColor: star.c,
      starClass: star.name,
      planetCount: srng.int(2, 6),
      economy: srng.pick(Object.keys(ECONOMIES)),
      wealth: srng.pick(['Struggling', 'Developing', 'Comfortable', 'Prosperous', 'Opulent']),
      danger,
      pirates: { Low: 0, Moderate: 2, High: 4, Extreme: 6 }[danger] ?? 0,
      distFromCore: radius,
    });
  }
  return { seed, name: GALAXY_NAME, systems };
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
