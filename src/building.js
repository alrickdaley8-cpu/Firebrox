// Base building: parts catalogue, placement records, farming and teleporters.
import { state, hasResources, spendResources, addResource } from './state.js';

export const PARTS = {
  habitat: {
    label: 'Habitat Pod', desc: 'Pressurised shelter. Restores life support and hazard protection.',
    cost: { ferrite: 60, carbon: 40 }, size: 5.5,
  },
  storage: {
    label: 'Storage Container', desc: '+200 exosuit stack limit per container (max +1200).',
    cost: { ferrite: 90, chromatic: 10 }, size: 2.6,
  },
  beacon: {
    label: 'Signal Beacon', desc: 'Marks the base on your compass from far away.',
    cost: { ferrite: 40, sodium: 20 }, size: 6,
  },
  farm: {
    label: 'Hydroponic Tray', desc: 'Plant a crop; harvest it once it matures.',
    cost: { carbon: 50, ferrite: 30 }, size: 3,
  },
  solar: {
    label: 'Solar Panel', desc: 'Trickle-charges your exosuit shield while nearby.',
    cost: { ferrite: 70, platinum: 15 }, size: 3.4,
  },
  teleporter: {
    label: 'Base Teleporter', desc: 'Travel instantly between any of your bases.',
    cost: { chromatic: 40, ferrite: 120, platinum: 30 }, size: 4.5,
  },
  light: {
    label: 'Floodlight', desc: 'Cheap light for night operations.',
    cost: { ferrite: 20 }, size: 3.2,
  },
  wall: {
    label: 'Wall Segment', desc: 'Plain structural wall for laying out a compound.',
    cost: { ferrite: 25 }, size: 4,
  },
};

export const CROPS = {
  starbulb: { label: 'Star Bulb', grow: 180, yield: { carbon: 90 }, cost: { carbon: 20 } },
  frostwort: { label: 'Frost Wort', grow: 240, yield: { dihydrogen: 70 }, cost: { carbon: 25 } },
  solanium: { label: 'Solanium', grow: 300, yield: { sodium: 80 }, cost: { carbon: 30 } },
  gamma: { label: 'Gamma Root', grow: 360, yield: { platinum: 45 }, cost: { carbon: 40 } },
  echinocactus: { label: 'Echinocactus', grow: 420, yield: { chromatic: 30 }, cost: { carbon: 55 } },
};

export function baseFor(planet) {
  return state.bases[planet.seed] || null;
}

export function ensureBase(planet, system) {
  if (!state.bases[planet.seed]) {
    state.bases[planet.seed] = {
      name: `${planet.name} Base`,
      planetSeed: planet.seed,
      planetName: planet.name,
      planetIndex: planet.index,
      systemId: system.id,
      systemName: system.name,
      galaxyIndex: state.galaxyIndex,
      parts: [],
      created: Date.now(),
    };
    if (!state.homeBase) state.homeBase = planet.seed;
  }
  return state.bases[planet.seed];
}

export function canBuild(type) {
  return hasResources(PARTS[type].cost);
}

export function build(planet, system, type, pos, rot = 0) {
  const part = PARTS[type];
  if (!part || !hasResources(part.cost)) return null;
  spendResources(part.cost);
  const base = ensureBase(planet, system);
  const record = {
    id: `${type}:${Date.now()}:${Math.floor(Math.random() * 1e6)}`,
    type, x: pos.x, y: pos.y, z: pos.z, rot,
  };
  if (type === 'farm') record.crop = null;
  base.parts.push(record);
  return record;
}

export function demolish(planet, id) {
  const base = state.bases[planet.seed];
  if (!base) return false;
  const i = base.parts.findIndex((p) => p.id === id);
  if (i < 0) return false;
  const [part] = base.parts.splice(i, 1);
  // half refund
  for (const [k, v] of Object.entries(PARTS[part.type].cost)) addResource(k, Math.floor(v / 2));
  if (!base.parts.length) delete state.bases[planet.seed];
  return true;
}

export function plant(part, cropKey) {
  const crop = CROPS[cropKey];
  if (!crop || part.type !== 'farm' || part.crop) return false;
  if (!hasResources(crop.cost)) return false;
  spendResources(crop.cost);
  part.crop = { key: cropKey, planted: Date.now() };
  return true;
}

export function cropProgress(part) {
  if (!part.crop) return 0;
  const crop = CROPS[part.crop.key];
  return Math.min(1, (Date.now() - part.crop.planted) / (crop.grow * 1000));
}

export function harvest(part) {
  if (!part.crop || cropProgress(part) < 1) return null;
  const crop = CROPS[part.crop.key];
  const gained = [];
  for (const [k, v] of Object.entries(crop.yield)) {
    const got = addResource(k, v);
    gained.push(`+${got} ${k}`);
  }
  part.crop = null;
  return gained.join(' · ');
}

export function allBases() {
  return Object.values(state.bases);
}

export function teleportTargets(currentPlanetSeed) {
  return allBases().filter((b) => b.planetSeed !== currentPlanetSeed
    && b.parts.some((p) => p.type === 'teleporter'));
}

export function hasPart(planet, type) {
  const base = state.bases[planet.seed];
  return !!base && base.parts.some((p) => p.type === type);
}
