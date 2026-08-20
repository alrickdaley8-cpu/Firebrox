// The Atlas Path: a guided chain of objectives, plus journey milestones.
import { state, addResource } from './state.js';

export const STEPS = [
  {
    id: 'awaken',
    title: 'Awakenings',
    objective: 'Scan a planet from orbit',
    hint: 'Hold F near an unscanned world.',
    check: () => Object.values(state.discoveries).some((d) => d.type === 'planet'),
    reward: { units: 5000, nanites: 40 },
    lore: 'The signal in your visor resolves into a shape. Something is watching you learn.',
  },
  {
    id: 'ground',
    title: 'First Footfall',
    objective: 'Land on a planet and mine 100 ferrite',
    hint: 'Hold E close to a planet, then mine the rocks.',
    check: () => (state.inventory.ferrite || 0) >= 100,
    reward: { units: 8000, items: { carbon: 60 } },
    lore: 'Dust on your boots. The Atlas records the moment as a birth.',
  },
  {
    id: 'life',
    title: 'The Living Catalogue',
    objective: 'Catalogue 3 lifeforms',
    hint: 'Hold F on creatures you meet.',
    check: () => Object.values(state.discoveries).filter((d) => d.type === 'creature').length >= 3,
    reward: { units: 12000, nanites: 80 },
    lore: 'Every creature you name becomes a word in a language older than your species.',
  },
  {
    id: 'anomaly',
    title: 'A Space Between Spaces',
    objective: 'Dock with a Space Anomaly',
    hint: 'Anomalies appear in about a third of systems.',
    check: () => state.interactions > 0 || state.drives.cadmium || state.nanites >= 250,
    reward: { units: 15000, nanites: 150 },
    lore: 'The station has no fixed coordinates. It simply arrives where travellers gather.',
  },
  {
    id: 'ruins',
    title: 'Those Who Came Before',
    objective: 'Interface with 3 alien structures',
    hint: 'Monoliths, crashed freighters and outposts count.',
    check: () => Object.values(state.discoveries).filter((d) => d.type === 'ruin').length >= 3,
    reward: { units: 18000, nanites: 120 },
    lore: 'Sixteen glyphs repeat across a thousand ruined worlds. Sixteen. Always sixteen.',
  },
  {
    id: 'seeds',
    title: 'Atlas Seeds',
    objective: 'Collect 5 Atlas Seeds from Atlas Interfaces',
    hint: 'Interfaces float in deep space in some systems — fly into one.',
    check: () => state.story.seeds >= 5,
    reward: { units: 60000, nanites: 400 },
    lore: 'Each seed is a compressed universe, dreaming of being unpacked.',
  },
  {
    id: 'core',
    title: 'The Centre',
    objective: 'Break through a galactic core',
    hint: 'Find the innermost system and fly into the singularity.',
    check: () => state.coreJumps >= 1,
    reward: { units: 120000, nanites: 900 },
    lore: 'You fall through the middle of everything and come out somewhere that is also everywhere.',
  },
];

export const MILESTONES = [
  { id: 'walker', label: 'Planetfall', desc: 'Worlds visited', get: () => Object.keys(state.visitedPlanets).length, tiers: [1, 5, 15, 40] },
  { id: 'zoologist', label: 'Zoologist', desc: 'Lifeforms catalogued', get: () => Object.values(state.discoveries).filter((d) => d.type === 'creature').length, tiers: [3, 12, 30, 75] },
  { id: 'cartographer', label: 'Cartographer', desc: 'Systems charted', get: () => Object.values(state.discoveries).filter((d) => d.type === 'system').length, tiers: [3, 10, 25, 60] },
  { id: 'hunter', label: 'Sentinel Hunter', desc: 'Sentinels destroyed', get: () => state.sentinelKills, tiers: [5, 25, 60, 150] },
  { id: 'ace', label: 'Void Ace', desc: 'Pirates destroyed', get: () => state.kills, tiers: [3, 15, 40, 100] },
  { id: 'nomad', label: 'Nomad', desc: 'Light years travelled', get: () => Math.floor(state.lightYears), tiers: [500, 3000, 12000, 40000] },
  { id: 'builder', label: 'Homesteader', desc: 'Base parts built', get: () => Object.values(state.bases).reduce((a, b) => a + b.parts.length, 0), tiers: [1, 10, 30, 80] },
  { id: 'diplomat', label: 'Diplomat', desc: 'Alien words learned', get: () => Object.values(state.words).reduce((a, w) => a + w.length, 0), tiers: [3, 10, 18, 24] },
];

export function current() {
  return STEPS[state.story.step] || null;
}

// Returns the completed step when the player advances.
export function check() {
  const step = current();
  if (!step || state.story.done) return null;
  if (!step.check()) return null;
  state.story.step++;
  state.units += step.reward.units || 0;
  state.nanites += step.reward.nanites || 0;
  for (const [k, v] of Object.entries(step.reward.items || {})) addResource(k, v);
  if (state.story.step >= STEPS.length) state.story.done = true;
  return step;
}

export function milestoneTier(m) {
  const v = m.get();
  let tier = 0;
  for (const t of m.tiers) if (v >= t) tier++;
  return tier;
}

// Awards units when a milestone tier is newly reached.
export function checkMilestones() {
  const gained = [];
  for (const m of MILESTONES) {
    const tier = milestoneTier(m);
    const had = state.milestones[m.id] || 0;
    if (tier > had) {
      state.milestones[m.id] = tier;
      const reward = tier * 6000;
      state.units += reward;
      gained.push({ label: m.label, tier, reward });
    }
  }
  return gained;
}

export function addAtlasSeed() {
  state.story.seeds++;
  return state.story.seeds;
}
