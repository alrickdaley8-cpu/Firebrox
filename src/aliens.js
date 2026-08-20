// Alien races: language, standing, and procedural dialogue encounters.
import { RNG } from './rng.js';
import { state, addResource } from './state.js';

export const RACES = {
  gek: {
    label: 'Gek', color: '#9fd94f',
    blurb: 'Small, mercantile, endlessly polite about profit.',
    greeting: ['Trade-friend!', 'Profit be upon you.', 'The First Spawn welcomes commerce.'],
    words: ['korvakk (trade)', 'jusko (profit)', 'nal (yes)', 'shantik (friend)', 'lok (buy)', 'venk (sell)', 'oshun (gift)', 'zelt (barter)'],
  },
  korvax: {
    label: 'Korvax', color: '#63e6ff',
    blurb: 'Machine minds in blue casings, obsessed with knowledge.',
    greeting: ['Query: intent?', 'Entity acknowledged.', 'The Convergence observes you.'],
    words: ['ares (data)', 'nexus (mind)', 'lumen (light)', 'sigma (order)', 'vitrix (glass)', 'oros (compute)', 'aeon (time)', 'kelm (truth)'],
  },
  vykeen: {
    label: "Vy'keen", color: '#ff7a3d',
    blurb: 'Warriors who measure worth in scars and sentinel kills.',
    greeting: ['Speak, traveller.', 'You still breathe. Good.', 'Blades sharp, hearts sharper.'],
    words: ['hirk (blade)', 'nada (kill)', 'valor (honour)', 'grah (strength)', 'skoll (hunt)', 'raz (war)', 'thal (shield)', 'ur (victory)'],
  },
};

const RACE_KEYS = Object.keys(RACES);

const ENCOUNTERS = [
  {
    id: 'word',
    prompt: 'The alien gestures at a carved word-stone and waits.',
    options: [
      { text: 'Study the stone', effect: 'word', log: 'You learn a new word.' },
      { text: 'Bow respectfully', effect: 'standing', log: 'The gesture is understood.' },
      { text: 'Ignore it', effect: 'none', log: 'The alien seems disappointed.' },
    ],
  },
  {
    id: 'trade',
    prompt: 'A merchant offers a sealed container in exchange for goodwill.',
    options: [
      { text: 'Accept the container', effect: 'loot', log: 'The container hisses open.' },
      { text: 'Offer 50 carbon as a gift', effect: 'gift', cost: { carbon: 50 }, log: 'Your generosity is noted.' },
      { text: 'Decline politely', effect: 'none', log: 'The merchant shrugs.' },
    ],
  },
  {
    id: 'repair',
    prompt: 'A damaged terminal sparks. The alien watches to see what you do.',
    options: [
      { text: 'Repair it (30 ferrite)', effect: 'standing2', cost: { ferrite: 30 }, log: 'The terminal hums back to life.' },
      { text: 'Scavenge the parts', effect: 'loot', log: 'You strip it for components.' },
      { text: 'Ask about the builders', effect: 'word', log: 'They answer in their own tongue.' },
    ],
  },
  {
    id: 'duel',
    prompt: 'A challenge is issued — a test of nerve, not blades.',
    options: [
      { text: 'Accept the challenge', effect: 'standing2', log: 'You hold their gaze. Respect earned.' },
      { text: 'Laugh it off', effect: 'standing', log: 'Humour is a kind of courage.' },
      { text: 'Step back', effect: 'penalty', log: 'They turn away, unimpressed.' },
    ],
  },
];

export function raceFor(seed) {
  const rng = new RNG(seed ^ 0x515a);
  return RACE_KEYS[rng.int(0, RACE_KEYS.length - 1)];
}

export function makeEncounter(seed) {
  const rng = new RNG(seed ^ 0x9911);
  const raceKey = raceFor(seed);
  const race = RACES[raceKey];
  const enc = ENCOUNTERS[rng.int(0, ENCOUNTERS.length - 1)];
  return {
    raceKey,
    race,
    greeting: rng.pick(race.greeting),
    prompt: enc.prompt,
    options: enc.options,
    seed,
  };
}

export function standingTitle(raceKey) {
  const v = state.standing[raceKey] || 0;
  if (v >= 12) return 'Revered';
  if (v >= 8) return 'Honoured';
  if (v >= 5) return 'Trusted';
  if (v >= 2) return 'Known';
  if (v <= -3) return 'Reviled';
  return 'Stranger';
}

export function learnedWord(raceKey) {
  const known = state.words[raceKey] || [];
  const pool = RACES[raceKey].words.filter((w) => !known.includes(w));
  if (!pool.length) return null;
  const word = pool[Math.floor(Math.random() * pool.length)];
  state.words[raceKey].push(word);
  return word;
}

// Applies the chosen option; returns a result summary for the UI.
export function choose(encounter, option) {
  const raceKey = encounter.raceKey;
  const out = { log: option.log, rewards: [] };
  state.interactions++;

  if (option.cost) {
    for (const [k, v] of Object.entries(option.cost)) {
      if ((state.inventory[k] || 0) < v) return { log: 'You do not have what this requires.', rewards: [], failed: true };
    }
    for (const [k, v] of Object.entries(option.cost)) state.inventory[k] -= v;
  }

  switch (option.effect) {
    case 'word': {
      const w = learnedWord(raceKey);
      state.standing[raceKey] += 1;
      out.rewards.push(w ? `Learned ${RACES[raceKey].label} word: ${w}` : 'You already know their whole tongue');
      break;
    }
    case 'standing':
      state.standing[raceKey] += 1;
      out.rewards.push(`${RACES[raceKey].label} standing +1`);
      break;
    case 'standing2':
      state.standing[raceKey] += 2;
      state.nanites += 40;
      out.rewards.push(`${RACES[raceKey].label} standing +2, +40 nanites`);
      break;
    case 'gift':
      state.standing[raceKey] += 2;
      state.units += 8000;
      out.rewards.push('Standing +2, +8,000 units in return');
      break;
    case 'loot': {
      const keys = ['platinum', 'chromatic', 'sodium', 'dihydrogen'];
      const k = keys[Math.floor(Math.random() * keys.length)];
      const amt = 30 + Math.floor(Math.random() * 50);
      addResource(k, amt);
      out.rewards.push(`+${amt} ${k}`);
      break;
    }
    case 'penalty':
      state.standing[raceKey] -= 1;
      out.rewards.push(`${RACES[raceKey].label} standing −1`);
      break;
    default:
      break;
  }
  return out;
}

// Standing gives a market discount and better mission pay.
export function standingBonus(raceKey) {
  return 1 + Math.max(0, state.standing[raceKey] || 0) * 0.03;
}
