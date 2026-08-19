// Procedural mission board: accept contracts at stations, progress them anywhere.
import { RNG } from './rng.js';
import { state, addResource } from './state.js';
import { RESOURCES } from './universe.js';

const TYPES = [
  {
    id: 'fauna',
    make: (rng, sys) => {
      const n = rng.int(3, 7);
      return {
        title: 'Xenobiology Survey',
        desc: `Catalogue ${n} unknown lifeforms`,
        target: n,
        giver: `${sys.name} Science Guild`,
      };
    },
  },
  {
    id: 'pirates',
    make: (rng, sys) => {
      const n = rng.int(2, 5);
      return {
        title: 'Void Cleanup',
        desc: `Destroy ${n} pirate interceptors`,
        target: n,
        giver: `${sys.name} Enforcement`,
      };
    },
  },
  {
    id: 'gather',
    make: (rng) => {
      const key = rng.pick(['ferrite', 'carbon', 'sodium', 'dihydrogen', 'platinum', 'chromatic']);
      const n = rng.int(60, 220);
      return {
        title: 'Supply Contract',
        desc: `Deliver ${n} ${RESOURCES[key].label}`,
        target: n,
        resource: key,
        deliver: true,
        giver: 'Merchants Guild',
      };
    },
  },
  {
    id: 'worlds',
    make: (rng) => {
      const n = rng.int(2, 4);
      return {
        title: 'Cartography Contract',
        desc: `Scan ${n} undiscovered planets`,
        target: n,
        giver: 'Explorers Guild',
      };
    },
  },
  {
    id: 'ruins',
    make: (rng) => {
      const n = rng.int(1, 3);
      return {
        title: 'Archaeology Grant',
        desc: `Interface with ${n} alien structures`,
        target: n,
        giver: 'Atlas Foundation',
      };
    },
  },
  {
    id: 'sentinels',
    make: (rng) => {
      const n = rng.int(3, 8);
      return {
        title: 'Sentinel Suppression',
        desc: `Destroy ${n} sentinel drones`,
        target: n,
        giver: 'Outlaw Syndicate',
      };
    },
  },
];

export function generateBoard(system) {
  const rng = new RNG(system.seed ^ 0xb0a2d);
  const picks = rng.shuffle(TYPES).slice(0, 3);
  return picks.map((t, i) => {
    const m = t.make(rng, system);
    const difficulty = m.target * (t.id === 'pirates' || t.id === 'sentinels' ? 2.2 : 1);
    return {
      key: `${system.id}:${t.id}:${i}`,
      type: t.id,
      progress: 0,
      systemId: system.id,
      systemName: system.name,
      reward: {
        units: Math.round((3000 + difficulty * 900) * (1 + system.distFromCore / 2200)),
        nanites: Math.round(20 + difficulty * 9),
      },
      ...m,
    };
  });
}

export function accept(mission) {
  if (state.missions.length >= 4) return 'full';
  if (state.missions.some((m) => m.key === mission.key)) return 'dupe';
  state.missions.push({ ...mission, progress: 0 });
  return 'ok';
}

export function abandon(key) {
  state.missions = state.missions.filter((m) => m.key !== key);
}

// Called from gameplay code; returns any mission that just completed.
export function event(type, amount = 1, ctx = {}) {
  const done = [];
  for (const m of state.missions) {
    if (m.progress >= m.target) continue;
    let hit = false;
    if (m.type === 'fauna' && type === 'scan_creature') hit = true;
    else if (m.type === 'pirates' && type === 'kill_pirate') hit = true;
    else if (m.type === 'worlds' && type === 'scan_planet') hit = true;
    else if (m.type === 'ruins' && type === 'ruin') hit = true;
    else if (m.type === 'sentinels' && type === 'kill_sentinel') hit = true;
    else if (m.type === 'gather' && type === 'gather' && ctx.resource === m.resource) hit = true;
    if (!hit) continue;
    m.progress = Math.min(m.target, m.progress + amount);
    if (m.progress >= m.target) done.push(m);
  }
  return done;
}

// Gather missions are checked against the cargo hold rather than events.
export function syncGather() {
  const done = [];
  for (const m of state.missions) {
    if (m.type !== 'gather' || m.progress >= m.target) continue;
    const held = Math.floor(state.inventory[m.resource] || 0);
    m.progress = Math.min(m.target, held);
    if (m.progress >= m.target) done.push(m);
  }
  return done;
}

export function claim(mission) {
  const idx = state.missions.findIndex((m) => m.key === mission.key);
  if (idx < 0) return null;
  const m = state.missions[idx];
  if (m.progress < m.target) return null;
  if (m.deliver) {
    if ((state.inventory[m.resource] || 0) < m.target) return null;
    state.inventory[m.resource] -= m.target;
  }
  state.missions.splice(idx, 1);
  state.units += m.reward.units;
  state.nanites += m.reward.nanites;
  state.missionsDone++;
  return m;
}

export function isComplete(m) {
  return m.progress >= m.target;
}

export { addResource };
