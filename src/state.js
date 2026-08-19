// Persistent player state: inventory, discoveries, ship, upgrades, missions, settings.
import { RESOURCES } from './universe.js';

const SAVE_KEY = 'firebrox.save.v3';

export const UPGRADES = {
  hyperdrive: { label: 'Hyperdrive Coils', desc: '+120 ly jump range per rank', max: 4, cost: (r) => 25000 + r * 30000 },
  mining: { label: 'Mining Beam Focus', desc: '+45% harvest speed per rank', max: 4, cost: (r) => 12000 + r * 15000 },
  cargo: { label: 'Cargo Bulkheads', desc: '+250 stack limit per rank', max: 4, cost: (r) => 18000 + r * 22000 },
  jetpack: { label: 'Jetpack Tanks', desc: 'Longer flight, faster recharge', max: 3, cost: (r) => 15000 + r * 18000 },
  shield: { label: 'Deflector Plating', desc: '+50% ship shield per rank', max: 4, cost: (r) => 20000 + r * 24000 },
  weapon: { label: 'Photon Cannon', desc: '+60% ship damage per rank', max: 4, cost: (r) => 20000 + r * 26000 },
  hazard: { label: 'Hazard Shielding', desc: 'Environmental drain halved per rank', max: 3, cost: (r) => 14000 + r * 16000 },
  suit: { label: 'Exosuit Shielding', desc: '+60% suit shield per rank', max: 4, cost: (r) => 16000 + r * 19000 },
  boltcaster: { label: 'Boltcaster Module', desc: '+55% multi-tool damage per rank', max: 4, cost: (r) => 13000 + r * 17000 },
  scanner: { label: 'Analysis Visor', desc: 'Faster scans, +40% discovery payouts', max: 3, cost: (r) => 17000 + r * 21000 },
};

export const SHIPS = {
  shuttle: {
    label: 'Radiant Shuttle', desc: 'The dependable starter. Balanced everything.',
    price: 0, speed: 1, cargo: 0, damage: 1, shield: 1, warp: 0,
    palette: { hull: '#d9e3ee', trim: '#ff7a3d', flame: '#66d9ff' },
  },
  fighter: {
    label: 'Vyk-3 Interceptor', desc: 'Fast and lethal. +45% speed, +60% damage, thin hull.',
    price: 165000, speed: 1.45, cargo: -100, damage: 1.6, shield: 0.85, warp: 0,
    palette: { hull: '#e8e8ec', trim: '#ff2f4f', flame: '#ff7a4d' },
  },
  hauler: {
    label: 'Ponderous Freighter', desc: 'A flying warehouse. +600 stack limit, +80% shields, slow.',
    price: 210000, speed: 0.78, cargo: 600, damage: 0.9, shield: 1.8, warp: 0,
    palette: { hull: '#cbb68f', trim: '#4a7c3f', flame: '#ffd166' },
  },
  explorer: {
    label: 'Long Sight Explorer', desc: 'Built for the deep dark. +180 ly jump range, fast scans.',
    price: 195000, speed: 1.15, cargo: 100, damage: 1, shield: 1.1, warp: 180,
    palette: { hull: '#bfe6f2', trim: '#7d5bff', flame: '#a1f0ff' },
  },
};

export const DEFAULT_SETTINGS = {
  fov: 75,
  sensitivity: 1,
  invertY: false,
  bloom: 1,
  shadows: true,
  renderScale: 1,
  music: 0.5,
  sfx: 0.8,
};

export const state = {
  units: 5000,
  nanites: 0,
  inventory: { carbon: 40, ferrite: 60, sodium: 20, dihydrogen: 80, platinum: 0, chromatic: 0, warpcell: 2 },
  upgrades: { hyperdrive: 0, mining: 0, cargo: 0, jetpack: 0, shield: 0, weapon: 0, hazard: 0, suit: 0, boltcaster: 0, scanner: 0 },
  ship: 'shuttle',
  ownedShips: ['shuttle'],
  launchFuel: 100,
  shipHealth: 100,
  shields: 100,
  suitShield: 100,
  life: 100,
  hazardProtection: 100,
  jetpack: 100,
  systemId: 0,
  discoveries: {},
  visitedSystems: {},
  visitedPlanets: {},
  missions: [],
  missionsDone: 0,
  lightYears: 0,
  kills: 0,
  sentinelKills: 0,
  playTime: 0,
  galaxyIndex: 0,
  galaxySeed: 'firebrox-prime',
  coreJumps: 0,
  settings: { ...DEFAULT_SETTINGS },
};

// ---- derived stats -------------------------------------------------
export const stats = {
  get shipDef() { return SHIPS[state.ship] || SHIPS.shuttle; },
  get stackLimit() { return 500 + state.upgrades.cargo * 250 + this.shipDef.cargo; },
  get jumpRange() { return 220 + state.upgrades.hyperdrive * 120 + this.shipDef.warp; },
  get miningRate() { return 1 + state.upgrades.mining * 0.45; },
  get shieldMax() { return 100 * (1 + state.upgrades.shield * 0.5) * this.shipDef.shield; },
  get suitShieldMax() { return 100 * (1 + state.upgrades.suit * 0.6); },
  get shipDamage() { return (1 + state.upgrades.weapon * 0.6) * this.shipDef.damage; },
  get toolDamage() { return 1 + state.upgrades.boltcaster * 0.55; },
  get shipSpeed() { return this.shipDef.speed; },
  get jetpackDrain() { return 22 / (1 + state.upgrades.jetpack * 0.5); },
  get jetpackRecharge() { return 32 * (1 + state.upgrades.jetpack * 0.4); },
  get hazardDrain() { return 1.6 / (1 + state.upgrades.hazard); },
  get scanSpeed() { return 1 + state.upgrades.scanner * 0.5; },
  get discoveryBonus() { return 1 + state.upgrades.scanner * 0.4; },
};

export function addResource(key, amount) {
  const before = state.inventory[key] || 0;
  state.inventory[key] = Math.min(stats.stackLimit, before + amount);
  return state.inventory[key] - before;
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
  const base = { system: 2500, planet: 1500, creature: 400, ruin: 800, flora: 250 }[type] || 300;
  const reward = Math.round(base * stats.discoveryBonus);
  state.discoveries[key] = { name, type, when: Date.now() };
  state.units += reward;
  if (type === 'ruin') state.nanites += 60;
  return reward;
}

export function renameDiscovery(key, name) {
  if (state.discoveries[key]) state.discoveries[key].name = name.slice(0, 40);
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
  if (key === 'suit') state.suitShield = stats.suitShieldMax;
  return 'ok';
}

export function buyShip(key) {
  const def = SHIPS[key];
  if (!def) return 'missing';
  if (state.ownedShips.includes(key)) { state.ship = key; return 'switched'; }
  if (state.units < def.price) return 'poor';
  state.units -= def.price;
  state.ownedShips.push(key);
  state.ship = key;
  state.shields = stats.shieldMax;
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
    state.upgrades = { hyperdrive: 0, mining: 0, cargo: 0, jetpack: 0, shield: 0, weapon: 0, hazard: 0, suit: 0, boltcaster: 0, scanner: 0, ...data.upgrades };
    state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    state.missions = data.missions || [];
    state.ownedShips = data.ownedShips?.length ? data.ownedShips : ['shuttle'];
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
