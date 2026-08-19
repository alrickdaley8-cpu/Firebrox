// Refiner / crafting recipes.
import { state, stats, hasResources, spendResources, addResource } from './state.js';

export const RECIPES = [
  {
    id: 'warpcell',
    label: 'Warp Cell',
    desc: 'Charges the hyperdrive for one jump.',
    cost: { dihydrogen: 100, ferrite: 50 },
    out: { warpcell: 1 },
  },
  {
    id: 'chromatic',
    label: 'Refine Chromatic Metal',
    desc: 'Smelt platinum into starship-grade alloy.',
    cost: { platinum: 60 },
    out: { chromatic: 25 },
  },
  {
    id: 'ferrite_from_carbon',
    label: 'Carbon Fusion',
    desc: 'Fuse raw carbon into usable ferrite dust.',
    cost: { carbon: 80 },
    out: { ferrite: 60 },
  },
  {
    id: 'oxygen_gel',
    label: 'Life Support Gel',
    desc: 'Fully restores life support in the field.',
    cost: { carbon: 40, sodium: 20 },
    effect: () => { state.life = 100; },
    outLabel: 'Life support restored',
  },
  {
    id: 'hazard_cell',
    label: 'Hazard Cell',
    desc: 'Recharges environmental protection to full.',
    cost: { sodium: 30 },
    effect: () => { state.hazardProtection = 100; },
    outLabel: 'Hazard protection restored',
  },
  {
    id: 'shield_battery',
    label: 'Shield Battery',
    desc: 'Restores exosuit and starship shields.',
    cost: { sodium: 25, ferrite: 40 },
    effect: () => { state.suitShield = stats.suitShieldMax; state.shields = stats.shieldMax; },
    outLabel: 'Shields recharged',
  },
  {
    id: 'launch_fuel',
    label: 'Launch Fuel',
    desc: 'Refills the launch thrusters.',
    cost: { dihydrogen: 30 },
    effect: () => { state.launchFuel = 100; },
    outLabel: 'Launch thrusters refuelled',
  },
  {
    id: 'nanite_cluster',
    label: 'Nanite Cluster',
    desc: 'Break chromatic metal down into nanites.',
    cost: { chromatic: 40 },
    effect: () => { state.nanites += 60; },
    outLabel: '+60 nanites',
  },
  {
    id: 'hull_plate',
    label: 'Hull Repair Plate',
    desc: 'Patches 45% of starship hull damage.',
    cost: { ferrite: 70, chromatic: 15 },
    effect: () => { state.shipHealth = Math.min(100, state.shipHealth + 45); },
    outLabel: 'Hull repaired',
  },
];

export function canCraft(recipe) {
  return hasResources(recipe.cost);
}

export function craft(recipe) {
  if (!canCraft(recipe)) return null;
  spendResources(recipe.cost);
  if (recipe.out) {
    const gained = [];
    for (const [k, v] of Object.entries(recipe.out)) {
      addResource(k, v);
      gained.push(`+${v} ${k}`);
    }
    return gained.join(' · ');
  }
  recipe.effect?.();
  return recipe.outLabel || 'Crafted';
}
