// Capital freighter ownership and frigate expeditions.
import { RNG } from './rng.js';
import { state, addResource } from './state.js';
import { makeName } from './universe.js';

export const FREIGHTERS = {
  hauler: { label: 'Sentinel-class Hauler', price: 1200000, slots: 3, desc: '+900 stack limit, 3 frigate berths.' },
  capital: { label: 'Venator-class Capital', price: 2600000, slots: 5, desc: 'A city in the void. 5 berths, prestige.' },
};

export const FRIGATE_TYPES = {
  industrial: { label: 'Industrial', price: 180000, pays: 'resources' },
  exploration: { label: 'Exploration', price: 220000, pays: 'discovery' },
  combat: { label: 'Combat', price: 260000, pays: 'salvage' },
  support: { label: 'Support', price: 200000, pays: 'nanites' },
};

export function buyFreighter(key) {
  const def = FREIGHTERS[key];
  if (!def) return 'missing';
  if (state.freighter?.class === key) return 'owned';
  if (state.units < def.price) return 'poor';
  state.units -= def.price;
  const rng = new RNG(Date.now() & 0xffff);
  state.freighter = { name: makeName(rng, true), class: key, slots: def.slots };
  return 'ok';
}

export function buyFrigate(type) {
  const def = FRIGATE_TYPES[type];
  if (!def) return 'missing';
  if (!state.freighter) return 'nofreighter';
  if (state.frigates.length >= state.freighter.slots) return 'full';
  if (state.units < def.price) return 'poor';
  state.units -= def.price;
  const rng = new RNG((Date.now() ^ state.frigates.length * 977) & 0xffffff);
  state.frigates.push({
    id: `f${Date.now()}${state.frigates.length}`,
    name: makeName(rng, false),
    type,
    rating: rng.int(2, 5),
    status: 'docked',
    returnsAt: 0,
    reward: null,
  });
  return 'ok';
}

// Expeditions resolve in real time; short enough to matter in one session.
export function sendExpedition(id, minutes = 3) {
  const f = state.frigates.find((x) => x.id === id);
  if (!f || f.status !== 'docked') return false;
  f.status = 'away';
  f.returnsAt = Date.now() + minutes * 60000;
  f.duration = minutes * 60000;
  return true;
}

export function expeditionProgress(f) {
  if (f.status !== 'away') return f.status === 'returned' ? 1 : 0;
  return Math.min(1, 1 - (f.returnsAt - Date.now()) / (f.duration || 1));
}

// Called on a timer from the game loop; returns completed expedition summaries.
export function tick() {
  const finished = [];
  for (const f of state.frigates) {
    if (f.status === 'away' && Date.now() >= f.returnsAt) {
      f.status = 'returned';
      const def = FRIGATE_TYPES[f.type];
      const scale = f.rating * (0.8 + Math.random() * 0.6);
      const reward = { units: 0, nanites: 0, items: [] };
      if (def.pays === 'resources') {
        const k = ['ferrite', 'carbon', 'platinum', 'chromatic'][Math.floor(Math.random() * 4)];
        const amt = Math.round(40 * scale);
        reward.items.push([k, amt]);
        reward.units = Math.round(9000 * scale);
      } else if (def.pays === 'discovery') {
        reward.units = Math.round(22000 * scale);
      } else if (def.pays === 'salvage') {
        reward.units = Math.round(16000 * scale);
        reward.items.push(['platinum', Math.round(25 * scale)]);
      } else {
        reward.nanites = Math.round(90 * scale);
        reward.units = Math.round(6000 * scale);
      }
      f.reward = reward;
      finished.push(f);
    }
  }
  return finished;
}

export function collect(id) {
  const f = state.frigates.find((x) => x.id === id);
  if (!f || f.status !== 'returned' || !f.reward) return null;
  state.units += f.reward.units;
  state.nanites += f.reward.nanites;
  for (const [k, v] of f.reward.items) addResource(k, v);
  const summary = f.reward;
  f.reward = null;
  f.status = 'docked';
  f.rating = Math.min(5, f.rating + (Math.random() < 0.25 ? 1 : 0));
  state.expeditionsDone++;
  return summary;
}
