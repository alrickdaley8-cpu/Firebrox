// Persistent player state: inventory, discoveries, ship status.
import { RESOURCES } from './universe.js';

const SAVE_KEY = 'firebrox.save.v1';

export const state = {
  units: 2500,
  inventory: { carbon: 40, ferrite: 60, sodium: 20, dihydrogen: 80, platinum: 0, warpcell: 2 },
  stackLimit: 500,
  launchFuel: 100,
  shipHealth: 100,
  shields: 100,
  life: 100,
  hazardProtection: 100,
  jetpack: 100,
  systemId: 0,
  discoveries: {},      // key -> {name, type, when}
  visitedSystems: {},
  lightYears: 0,
};

export function addResource(key, amount) {
  state.inventory[key] = Math.min(state.stackLimit, (state.inventory[key] || 0) + amount);
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
  state.discoveries[key] = { name, type, when: Date.now() };
  state.units += type === 'planet' ? 1500 : type === 'system' ? 2500 : 400;
  return true;
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

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    Object.assign(state, JSON.parse(raw));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
