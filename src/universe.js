// Procedural universe: galaxy -> star systems -> planets, all derived from seeds.
import { RNG, hashString } from './rng.js';

const SYLL_A = ['ar', 'be', 'ca', 'del', 'e', 'fen', 'gro', 'hy', 'ix', 'ja', 'kor', 'lu', 'mor', 'ny', 'ob', 'pra', 'quo', 'ra', 'sol', 'tya', 'ur', 'vex', 'wa', 'xen', 'yl', 'zor'];
const SYLL_B = ['ban', 'cor', 'dan', 'eth', 'far', 'gal', 'hex', 'ith', 'jan', 'kal', 'lon', 'mus', 'nar', 'oph', 'pin', 'qir', 'ros', 'sem', 'tal', 'uun', 'vor', 'wen', 'xis', 'yon', 'zed'];
const SYLL_C = ['a', 'ia', 'is', 'us', 'ex', 'or', 'um', 'ai', 'oth', 'eus', 'yn', 'ar'];
const GREEK = ['Prime', 'Secundus', 'Tertius', 'Minor', 'Major', 'Nova', 'Ultra', 'Cluster', 'Anomaly', 'Reach'];

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
    label: 'Lush',
    ground: ['#4a7c3f', '#2f5d2a', '#6d9c4a'],
    rock: '#6a5a45',
    sky: '#7fc4ff',
    fog: '#a8dcff',
    hazard: 'None',
    flora: 0.9,
    fauna: 0.8,
    amp: 1.0,
  },
  desert: {
    label: 'Scorched',
    ground: ['#c9a15a', '#e0b878', '#a87c3f'],
    rock: '#8d6a3a',
    sky: '#ffb45e',
    fog: '#ffd39a',
    hazard: 'Extreme Heat',
    flora: 0.25,
    fauna: 0.2,
    amp: 0.8,
  },
  frozen: {
    label: 'Frozen',
    ground: ['#dceaf2', '#b8d4e6', '#8fb3cc'],
    rock: '#7d8c99',
    sky: '#bcd8ee',
    fog: '#dbeaf6',
    hazard: 'Deep Freeze',
    flora: 0.2,
    fauna: 0.25,
    amp: 1.15,
  },
  toxic: {
    label: 'Toxic',
    ground: ['#7fbf3f', '#5c9130', '#9fd94f'],
    rock: '#54633a',
    sky: '#b6ff6e',
    fog: '#c9f58c',
    hazard: 'Toxic Rain',
    flora: 0.7,
    fauna: 0.45,
    amp: 0.9,
  },
  irradiated: {
    label: 'Irradiated',
    ground: ['#c8b53f', '#9c8a2e', '#e6d15c'],
    rock: '#6f6533',
    sky: '#f3e07a',
    fog: '#f7ecb0',
    hazard: 'Radiation',
    flora: 0.4,
    fauna: 0.3,
    amp: 1.0,
  },
  barren: {
    label: 'Barren',
    ground: ['#8a8378', '#6d675e', '#a49b8d'],
    rock: '#5b564e',
    sky: '#4b5566',
    fog: '#6e7a8c',
    hazard: 'None',
    flora: 0.05,
    fauna: 0.05,
    amp: 1.3,
  },
  volcanic: {
    label: 'Volcanic',
    ground: ['#4a3230', '#2e1f1e', '#6b3a2c'],
    rock: '#3a2825',
    sky: '#ff6a3d',
    fog: '#9c3b22',
    hazard: 'Firestorms',
    flora: 0.15,
    fauna: 0.15,
    amp: 1.5,
  },
  exotic: {
    label: 'Exotic',
    ground: ['#a45cd6', '#6f3fbf', '#d67fe8'],
    rock: '#4c2f6b',
    sky: '#e07dff',
    fog: '#c79cf0',
    hazard: 'Anomalous',
    flora: 0.6,
    fauna: 0.5,
    amp: 1.6,
  },
  ocean: {
    label: 'Oceanic',
    ground: ['#3f8f8a', '#2c6b6f', '#5fb0a3'],
    rock: '#4a6b6b',
    sky: '#63d5ff',
    fog: '#9fe8f2',
    hazard: 'None',
    flora: 0.7,
    fauna: 0.75,
    amp: 0.55,
  },
};

const BIOME_KEYS = Object.keys(BIOMES);

export const RESOURCES = {
  carbon: { label: 'Carbon', color: '#8fdc6a', icon: 'C' },
  ferrite: { label: 'Ferrite Dust', color: '#d8a45a', icon: 'Fe' },
  sodium: { label: 'Sodium', color: '#ffd85c', icon: 'Na' },
  dihydrogen: { label: 'Di-hydrogen', color: '#6ad2ff', icon: 'H' },
  platinum: { label: 'Platinum', color: '#e0e6ff', icon: 'Pt' },
  warpcell: { label: 'Warp Cell', color: '#ff7de0', icon: 'W' },
};

const STAR_COLORS = [
  { c: '#ffd9a0', name: 'Yellow' },
  { c: '#ffe9c8', name: 'White' },
  { c: '#ff9d6b', name: 'Red' },
  { c: '#a8c8ff', name: 'Blue' },
  { c: '#ffb0e8', name: 'Pink' },
  { c: '#9fffe0', name: 'Green' },
];

export const GALAXY_NAME = 'Euclid-VII';

// Deterministic galaxy: systems laid out in a loose spiral.
export function generateGalaxy(seed = 'firebrox', count = 220) {
  const rng = new RNG(seed);
  const systems = [];
  const arms = 3;
  for (let i = 0; i < count; i++) {
    const arm = i % arms;
    const t = rng.float(0.08, 1.0);
    const angle = t * Math.PI * 3.1 + (arm / arms) * Math.PI * 2 + rng.float(-0.22, 0.22);
    const radius = t * 900 + rng.float(-40, 40);
    const x = Math.cos(angle) * radius;
    const y = rng.float(-1, 1) * 70 * (1.15 - t);
    const z = Math.sin(angle) * radius;
    const sysSeed = hashString(`${seed}:sys:${i}`);
    const srng = new RNG(sysSeed);
    const star = srng.pick(STAR_COLORS);
    systems.push({
      id: i,
      seed: sysSeed,
      name: makeName(srng, true),
      pos: { x, y, z },
      starColor: star.c,
      starClass: star.name,
      planetCount: srng.int(1, 5),
      economy: srng.pick(['Mining', 'Trading', 'Manufacturing', 'Research', 'Power Generation', 'Abandoned']),
      danger: srng.pick(['Low', 'Low', 'Moderate', 'High', 'Extreme']),
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
    const radius = prng.float(320, 620);
    orbit += prng.float(1500, 3200);
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
      hasRings: prng.chance(0.22),
      moons: prng.int(0, 2),
      weather: prng.pick(['Calm', 'Windy', 'Storms', 'Clear Skies', 'Dust Haze', 'Heavy Rain']),
      sentinels: prng.pick(['Passive', 'Passive', 'Low', 'Aggressive']),
      flora: biome.flora * prng.float(0.6, 1.3),
      fauna: biome.fauna * prng.float(0.5, 1.3),
      resources: prng.shuffle(['carbon', 'ferrite', 'sodium', 'dihydrogen', 'platinum']).slice(0, 3),
      discovered: false,
    });
  }
  const spaceStation = rng.chance(0.7);
  return { ...sysMeta, planets, spaceStation };
}

export function distance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
