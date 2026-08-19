// Persistent player state: inventory, discoveries, ship status, upgrades.
import { RESOURCES } from './universe.js';

const SAVE_KEY = 'firebrox.save.v2';

export const UPGRADES = {
  hyperdrive: {
    label: 'Hyperdrive Coils',
    desc: '+120 ly jump range per rank',
    max: 4,
    cost: (r) => 25000 + r * 30000,
  },
  mining: {
    label: 'Mining Beam Focus',
    desc: '+45% harvest speed per rank',
    max: 4,
    cost: (r) => 12000 + r * 15000,
  },
  cargo: {
    label: 'Cargo Bulkheads',
    desc: '+250 stack limit per rank',
    max: 4,
    cost: (r) => 18000 + r * 22000,
  },
  jetpack: {
    label: 'Jetpack Tanks',
    desc: 'Longer flight, faster recharge',
    max: 3,
    cost: (r) => 15000 + r * 18000,
  },
  shield: {
    label: 'Deflector Plating',
    desc: '+50% shield capacity per rank',
    max: 4,
    cost: (r) => 20000 + r * 24000,
  },
  weapon: {
    label: 'Photon Cannon',
    desc: '+60% ship damage per rank',
    max: 4,
    cost: (r) => 20000 + r * 26000,
  },
  hazard: {
    label: 'Hazard Shielding',
    desc: 'Environmental drain halved per rank',
    max: 3,
    cost: (r) => 14000 + r * 16000,
  },
};

export const state = {
  units: 5000,
  nanites: 0,
  inventory: { carbon: 40, ferrite: 60, sodium: 20, dihydrogen: 80, platinum: 0, chromatic: 0, warpcell: 2 },
  upgrades: { hyperdrive: 0, mining: 0, cargo: 0, jetpack: 0, shield: 0, weapon: 0, hazard: 0 },
  launchFuel: 100,
  shipHealth: 100,
  shields: 100,
  life: 100,
  hazardProtection: 100,
  jetpack: 100,
  systemId: 0,
  discoveries: {},      // key -> {name, type, when}
  visitedSystems: {},
  visitedPlanets: {},
  lightYears: 0,
  kills: 0,
  playTime: 0,
};

// ---- derived stats -------------------------------------------------
export const stats = {
  get stackLimit() { return 500 + state.upgrades.cargo * 250; },
  get jumpRange() { return 220 + state.upgrades.hyperdrive * 120; },
  get miningRate() { return 1 + state.upgrades.mining * 0.45; },
  get shieldMax() { return 100 * (1 + state.upgrades.shield * 0.5); },
  get shipDamage() { return 1 + state.upgrades.weapon * 0.6; },
  get jetpackDrain() { return 22 / (1 + state.upgrades.jetpack * 0.5); },
  get jetpackRecharge() { return 32 * (1 + state.upgrades.jetpack * 0.4); },
  get hazardDrain() { return 1.6 / (1 + state.upgrades.hazard); },
};

export function addResource(key, amount) {
  state.inventory[key] = Math.min(stats.stackLimit, (state.inventory[key] || 0) + amount);
}

export function hasResources(cost) {
  return Object.entries(cost).every(([k, v]) => (state.inventory[k] || 0) >= v);
}

export function spendResources(cost) {
  if (!hasResources(cost)) return false;
  for (const [k, v] of Object.entries(cost)) state.inventory[k] -= v;
  return true;
}

export function discover(key, name, type) {
  if (state.discoveries[key]) return false;
  const reward = { system: 2500, planet: 1500, creature: 400, ruin: 800, flora: 250 }[type] || 300;
  state.discoveries[key] = { name, type, when: Date.now() };
  state.units += reward;
  if (type === 'ruin') state.nanites += 60;
  return reward;
}

export function buyUpgrade(key) {
  const up = UPGRADES[key];
  const rank = state.upgrades[key] || 0;
  if (rank >= up.max) return 'maxed';
  const cost = up.cost(rank);
  if (state.units < cost) return 'poor';
  state.units -= cost;
  state.upgrades[key] = rank + 1;
  if (key === 'shield') state.shields = stats.shieldMax;
  return 'ok';
}

export function resourceLabel(key) {
  return RESOURCES[key]?.label || key;
}

export function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    Object.assign(state, data);
    state.inventory = { carbon: 0, ferrite: 0, sodium: 0, dihydrogen: 0, platinum: 0, chromatic: 0, warpcell: 0, ...data.inventory };
    state.upgrades = { hyperdrive: 0, mining: 0, cargo: 0, jetpack: 0, shield: 0, weapon: 0, hazard: 0, ...data.upgrades };
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
