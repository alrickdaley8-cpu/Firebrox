// Headless smoke-test harness: boots the real FIREBROX modules under jsdom,
// stubs the 2D canvas API, and drives thousands of simulated frames.
// Requires jsdom:  npm i -D jsdom   (the game itself needs no dependencies)
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const html = fs.readFileSync(ROOT + '/index.html', 'utf8');

const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost:5173/' });
const { window } = dom;

// ---- fake 2D context ------------------------------------------------
const gradient = { addColorStop() {} };
function fakeCtx(canvas) {
  return new Proxy({
    canvas,
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: () => {},
    measureText: () => ({ width: 10 }),
  }, {
    get(t, k) {
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
window.HTMLCanvasElement.prototype.getContext = function (kind) {
  if (kind === '2d') { this.__ctx = this.__ctx || fakeCtx(this); return this.__ctx; }
  return null;
};
window.HTMLCanvasElement.prototype.requestPointerLock = function () {};
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 620; }, configurable: true });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 150; }, configurable: true });
window.HTMLElement.prototype.getBoundingClientRect = function () {
  return { left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 };
};

// ---- globals three / game code expect --------------------------------
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLCanvasElement = window.HTMLCanvasElement;
globalThis.Image = window.Image;
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.performance = { now: () => Number(process.hrtime.bigint() / 1000000n), timeOrigin: 0 };
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
globalThis.cancelAnimationFrame = () => {};
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.removeEventListener = window.removeEventListener.bind(window);
globalThis.localStorage = window.localStorage;
globalThis.AudioContext = class {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
  createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }, connect: (n) => n }; }
  createOscillator() { return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }, connect: (n) => n, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect: (n) => n }; }
  resume() {}
};

const errors = [];
process.on('uncaughtException', (e) => { errors.push('UNCAUGHT: ' + e.stack); });

// ---- import the game -------------------------------------------------
const { generateGalaxy, buildSystem } = await import(ROOT + '/src/universe.js');
const { state, stats, saveGame, loadGame } = await import(ROOT + '/src/state.js');
const { input } = await import(ROOT + '/src/input.js');
const { ui } = await import(ROOT + '/src/ui.js');
const { SpaceMode } = await import(ROOT + '/src/space.js');
const { SurfaceMode } = await import(ROOT + '/src/surface.js');
const { GalaxyMap } = await import(ROOT + '/src/map.js');

const t0 = Date.now();
input.init(window.document.getElementById('scene'));
ui.init();
ui.showHUD(true);
input.locked = true;
input.enabled = true;

const galaxy = generateGalaxy(0);
const space = new SpaceMode();
const surface = new SurfaceMode();
const map = new GalaxyMap(galaxy, () => {});
console.log('constructed in', Date.now() - t0, 'ms');

function frames(mode, n, dt = 1 / 60, keys = []) {
  input.keys = new Set(keys);
  for (let i = 0; i < n; i++) {
    mode.update(dt);
    ui.update(mode.info());
  }
}

// ---- SPACE -----------------------------------------------------------
let t = Date.now();
const sys = buildSystem(galaxy.systems[0]);
ui.mode = 'space';
space.setSystem(sys);
console.log('space.setSystem:', Date.now() - t, 'ms — planets', sys.planets.length, 'pirates', sys.pirates);

t = Date.now();
frames(space, 240, 1 / 60, ['KeyW']);
console.log('240 space frames (throttle up):', Date.now() - t, 'ms, texQueue left', space.texQueue.length);

input.mouseDown = true;
frames(space, 120, 1 / 60, ['KeyW', 'ShiftLeft']);
input.mouseDown = false;
console.log('after firing: bolts', space.bolts.length, 'shields', state.shields.toFixed(1));

// force combat
space.pirateBudget = 4; space.spawnTimer = 0;
frames(space, 400, 1 / 60, ['KeyW']);
console.log('combat frames done — enemies', space.enemies.length, 'hull', state.shipHealth.toFixed(1), 'kills', state.kills);

// pulse warp
frames(space, 200, 1 / 60, ['KeyW', 'Space']);
console.log('pulse warp speed:', Math.round(space.speed), 'u/s');

// docking + trade UI
space.ship.position.copy(space.station.position).add({ x: 0, y: 0, z: 300 });
frames(space, 90, 1 / 60, ['KeyE']);
console.log('dockRequest:', space.dockRequest);
ui.openTrade(sys, () => {});
window.document.querySelector('[data-sell]')?.click();
window.document.querySelector('[data-upg]')?.click();
window.document.querySelector('[data-buy]')?.click();
ui.closeTrade();
console.log('trade ok — units', Math.round(state.units), 'upgrades', JSON.stringify(state.upgrades));

// scanning a planet
const holder = space.planets[0];
space.ship.position.copy(holder.position).add({ x: 0, y: 0, z: holder.userData.planet.radius * 2 });
frames(space, 150, 1 / 60, ['KeyF']);
console.log('discoveries after scan:', Object.keys(state.discoveries).length);

// ---- SURFACE ---------------------------------------------------------
for (const planet of sys.planets.slice(0, 3)) {
  ui.mode = 'surface';
  t = Date.now();
  surface.setPlanet(planet, sys);
  const setup = Date.now() - t;
  t = Date.now();
  frames(surface, 400, 1 / 60, ['KeyW', 'Space']);
  const run = Date.now() - t;
  console.log(
    `surface ${planet.name} (${planet.biome.label}): setup ${setup}ms, 400 frames ${run}ms`,
    `chunks ${surface.chunks.size} props ${surface.props.length} structures ${surface.structures.length}`,
    `creatures ${surface.creatures.length} y=${surface.pos.y.toFixed(1)}`
  );
  input.mouseDown = true;
  frames(surface, 120, 1 / 60, ['KeyW']);
  input.mouseDown = false;
  frames(surface, 120, 1 / 60, ['KeyF']);
  // walk a long way to force chunk streaming
  frames(surface, 900, 1 / 60, ['KeyW', 'ShiftLeft']);
  console.log('  after streaming: chunks', surface.chunks.size, 'props', surface.props.length,
    'life', state.life.toFixed(0), 'hazard', state.hazardProtection.toFixed(0), 'jet', state.jetpack.toFixed(0));
}

// ---- NEW SYSTEMS: sentinels, missions, crafting, shipyard, black holes ----
const missions = await import(ROOT + '/src/missions.js');
const crafting = await import(ROOT + '/src/crafting.js');
const { buyShip, SHIPS } = await import(ROOT + '/src/state.js');

// missions
const board = missions.generateBoard(galaxy.systems[0]);
console.log('mission board:', board.map((m) => `${m.title} (${m.desc})`).join(' | '));
for (const m of board) missions.accept(m);
console.log('accepted:', state.missions.length, '(cap 4)');
missions.event('scan_creature', 99);
missions.event('kill_pirate', 99);
missions.event('kill_sentinel', 99);
missions.event('ruin', 99);
missions.event('scan_planet', 99);
state.inventory.ferrite = 500; state.inventory.carbon = 500; state.inventory.chromatic = 500;
state.inventory.platinum = 500; state.inventory.sodium = 500; state.inventory.dihydrogen = 500;
missions.syncGather();
const ready = state.missions.filter(missions.isComplete).length;
let claimed = 0;
for (const m of [...state.missions]) if (missions.claim(m)) claimed++;
console.log('missions complete:', ready, 'claimed:', claimed, 'units now', Math.round(state.units), 'nanites', state.nanites);

// crafting
const before = { ...state.inventory };
let crafts = 0;
for (const r of crafting.RECIPES) if (crafting.craft(r)) crafts++;
console.log('recipes craftable:', crafts, '/', crafting.RECIPES.length, '· warp cells', state.inventory.warpcell);

// shipyard
state.units = 500000;
for (const k of Object.keys(SHIPS)) buyShip(k);
console.log('ships owned:', state.ownedShips.join(', '), '· flying', state.ship,
  '· jump range', stats.jumpRange, '· stack', stats.stackLimit);
space.update(1 / 60);
console.log('ship model synced to class:', space.shipClass === state.ship);

// sentinels + on-foot combat
ui.mode = 'surface';
const combatPlanet = sys.planets.find((p) => p.sentinels !== 'Passive') || sys.planets[0];
surface.setPlanet(combatPlanet, sys);
surface.sentinelAggression = 1.5;
surface.raiseWanted(1.2);
for (let i = 0; i < 400; i++) { surface.scene.updateMatrixWorld(true); surface.update(1 / 60); }
console.log('sentinels spawned:', surface.sentinels.length, 'wanted', surface.wanted.toFixed(2),
  'suit shield', state.suitShield.toFixed(0), 'life', state.life.toFixed(0));
input.mouseRight = true;
for (let i = 0; i < 600; i++) {
  surface.scene.updateMatrixWorld(true);
  const t = surface.sentinels[0];
  if (t) {
    const dx = t.mesh.position.x - surface.pos.x, dz = t.mesh.position.z - surface.pos.z;
    surface.yaw = Math.atan2(-dx, -dz);
    surface.pitch = Math.atan2(t.mesh.position.y - surface.pos.y, Math.hypot(dx, dz));
  }
  surface.update(1 / 60);
}
input.mouseRight = false;
console.log('sentinel kills:', state.sentinelKills, 'nanites', state.nanites, 'deaths', surface.deaths);

// black hole + core
const bhSys = galaxy.systems.find((s) => s.hasBlackHole);
ui.mode = 'space';
space.setSystem(buildSystem(bhSys));
console.log('black hole present:', !!space.blackHole, 'freighter:', !!space.freighter, 'pods:', space.pods.length);
if (space.blackHole) {
  space.ship.position.copy(space.blackHole.position).add({ x: 0, y: 0, z: 900 });
  space.throttle = 0; space.speed = 0;
  let pulled = false;
  for (let i = 0; i < 200; i++) { space.update(1 / 60); if (space.blackHoleRequest) pulled = true; }
  console.log('black hole pulled ship in:', pulled);
}
const coreSys = galaxy.systems.find((s) => s.isCore);
space.setSystem(buildSystem(coreSys));
space.ship.position.set(1000, 0, 1000);
space.throttle = 0; space.speed = 0;
let coreHit = false;
for (let i = 0; i < 120; i++) { space.update(1 / 60); if (space.coreRequest) coreHit = true; }
console.log('core system:', coreSys.name, '· core trigger:', coreHit);

// pods shootable
space.setSystem(buildSystem(bhSys));
if (space.pods.length) {
  const pod = space.pods[0];
  space.ship.position.copy(pod.position).add({ x: 0, y: 0, z: 260 });
  space.faceShip(pod.position);
  space.throttle = 0; space.speed = 0;
  input.mouseDown = true;
  const podsBefore = space.pods.length;
  for (let i = 0; i < 150; i++) space.update(1 / 60);
  input.mouseDown = false;
  console.log('cargo pods:', podsBefore, '->', space.pods.length);
}

// settings
ui.openSettings(() => {});
document.querySelector('[data-set="fov"]').value = '95';
document.querySelector('[data-set="fov"]').dispatchEvent(new window.Event('input'));
document.querySelector('[data-toggle="invertY"]').click();
ui.closeSettings();
console.log('settings fov', state.settings.fov, 'invertY', state.settings.invertY);

// crafting UI
ui.openCraft(() => {});
document.querySelector('[data-craft]')?.click();
ui.closeCraft();
console.log('crafting UI ok');

// station tabs (missions + shipyard render)
ui.openTrade(galaxy.systems[0], () => {});
console.log('board rows:', document.querySelectorAll('#trade-missions [data-accept]').length,
  '· shipyard cards:', document.querySelectorAll('#trade-ships [data-ship]').length);
document.querySelector('#trade-missions [data-accept]')?.click();
ui.closeTrade();
console.log('missions active after accept:', state.missions.length);

// ---- GALAXIES, WORMHOLES, PORTALS, ANOMALY ---------------------------
const uni = await import(ROOT + '/src/universe.js');
console.log('galaxy roster:', uni.GALAXIES.length, '·', uni.GALAXIES.slice(0, 4).map((g) => `${g.name} (${g.type})`).join(', '), '…');
for (let gi = 0; gi < uni.GALAXIES.length; gi++) {
  const g = uni.generateGalaxy(gi);
  const stranded = g.systems.filter((sy) => !g.systems.some((o) => o !== sy && uni.distance(sy.pos, o.pos) <= 220)).length;
  if (stranded) console.log('  !! stranded systems in', g.name, stranded);
}
console.log('all galaxies generated, none stranded');

const g0 = uni.generateGalaxy(0);
console.log('wormhole pairs:', g0.wormholes.length, '· intergalactic gate:', g0.systems[g0.gateId]?.name);
const noDrives = { cadmium: false, emeril: false, indium: false };
const allDrives = { cadmium: true, emeril: true, indium: true };
const gatedCount = g0.systems.filter((sy) => !uni.canWarpTo(sy, noDrives)).length;
console.log('gated systems without drives:', gatedCount, '/', g0.systems.length);
const r1 = uni.planRoute(g0, 0, g0.coreId, 220, noDrives);
const r2 = uni.planRoute(g0, 0, g0.coreId, 220, allDrives);
console.log('route to core — basic drive:', r1 ? r1.length + ' hops' : 'blocked', '· all drives:', r2 ? r2.length + ' hops' : 'blocked');
let reach = 0, reachNoDrive = 0;
for (let i = 0; i < 40; i++) {
  const t = Math.floor((i / 40) * g0.systems.length);
  if (uni.planRoute(g0, 0, t, 220, allDrives)) reach++;
  if (uni.planRoute(g0, 0, t, 220, noDrives)) reachNoDrive++;
}
console.log('reachable sample — all drives:', reach + '/40', '· no drives:', reachNoDrive + '/40');

// every hop of a plotted route must be legal
function validateRoute(path, fromId) {
  let cur = g0.systems[fromId];
  for (const id of path) {
    const next = g0.systems[id];
    const legal = uni.distance(cur.pos, next.pos) <= 220 || cur.wormholeTo === id;
    if (!legal) return `illegal hop ${cur.id}->${id} (${uni.distance(cur.pos, next.pos).toFixed(0)} ly)`;
    if (!uni.canWarpTo(next, allDrives)) return `gated hop ${id}`;
    cur = next;
  }
  return 'ok';
}
let bad = 0;
for (let i = 0; i < 25; i++) {
  const t = Math.floor(Math.random() * g0.systems.length);
  const path = uni.planRoute(g0, 0, t, 220, allDrives);
  if (path && validateRoute(path, 0) !== 'ok') { bad++; console.log('  route problem:', validateRoute(path, 0)); }
}
console.log('route validation over 25 destinations:', bad === 0 ? 'all legal' : bad + ' broken');
const coreRoute = uni.planRoute(g0, 0, g0.coreId, 220, allDrives);
console.log('core route hops:', coreRoute.length, '· start distFromCore', g0.systems[0].distFromCore.toFixed(0),
  '· hop distances', coreRoute.map((id, i) => {
    const a = i === 0 ? g0.systems[0] : g0.systems[coreRoute[i - 1]];
    return (a.wormholeTo === id ? 'WH' : uni.distance(a.pos, g0.systems[id].pos).toFixed(0));
  }).join(', '));

// wormhole + anomaly objects in space
const whSys = g0.systems.find((sy) => sy.wormholeTo != null);
ui.mode = 'space';
space.setSystem(buildSystem(whSys));
console.log('wormhole system', whSys.name, '· mouth built:', !!space.wormhole, '· anomaly:', !!space.anomaly);
input.keys = new Set();
space.ship.position.copy(space.wormhole.position).add({ x: 0, y: 0, z: 200 });
space.throttle = 0; space.speed = 0;
let whHit = false;
for (let i = 0; i < 420; i++) {
  space.update(1 / 60);
  if (space.wormholeRequest) whHit = true;
}
console.log('wormhole entry triggered:', whHit,
  '· dist', space.wormhole.position.distanceTo(space.ship.position).toFixed(0),
  '· cooldown', space.transitCooldown.toFixed(2));

const anSys = g0.systems.find((sy) => sy.hasAnomaly && sy.wormholeTo == null);
space.setSystem(buildSystem(anSys));
space.ship.position.copy(space.anomaly.position).add({ x: 0, y: 0, z: 300 });
space.throttle = 0; space.speed = 0;
input.keys = new Set(['KeyE']);
let anHit = false;
for (let i = 0; i < 120; i++) { space.update(1 / 60); if (space.anomalyRequest) anHit = true; }
input.keys = new Set();
console.log('anomaly docking triggered:', anHit);

// anomaly shop
state.nanites = 3000;
ui.openAnomaly(() => {});
window.document.querySelectorAll('#anomaly-drives [data-drive]').forEach((b) => b.click());
window.document.querySelector('#anomaly-exchange [data-ex]')?.click();
ui.closeAnomaly();
console.log('drives owned:', Object.entries(state.drives).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none',
  '· nanites left', state.nanites);

// planet portals
ui.mode = 'surface';
let portalFound = null;
let scanned = 0;
outer:
for (let si = 3; si < 9; si++) {
  const pSys = buildSystem(g0.systems[si]);
  for (const pl of pSys.planets) {
    scanned++;
    surface.setPlanet(pl, pSys);
    if (surface.portal) { portalFound = pl; break outer; }
  }
}
console.log('planets scanned for portals:', scanned);
console.log('portal world:', portalFound ? `${portalFound.name} glyphs ${surface.portalGlyphs}` : 'none in this system');
if (portalFound) {
  surface.pos.copy(surface.portal.position).add({ x: 3, y: 2, z: 0 });
  input.keys = new Set(['KeyE']);
  let req = null;
  for (let i = 0; i < 200; i++) {
    surface.scene.updateMatrixWorld(true);
    surface.update(1 / 60);
    if (surface.portalRequest) req = surface.portalRequest;
  }
  input.keys = new Set();
  console.log('portal activated:', !!req, req ? `→ system hash ${req.systemHash % g0.systems.length}, planet ${req.planetIndex}` : '');
}

// ---- BASES, FARMING, EXOCRAFT, TERRAIN, WRECKS, ALIENS, FLEET, STORY ----
const building = await import(ROOT + '/src/building.js');
const aliens = await import(ROOT + '/src/aliens.js');
const fleet = await import(ROOT + '/src/fleet.js');
const story = await import(ROOT + '/src/story.js');

ui.mode = 'surface';
const homeSys = buildSystem(g0.systems[2]);
const homePlanet = homeSys.planets[0];
surface.setPlanet(homePlanet, homeSys);
state.inventory.ferrite = 900; state.inventory.carbon = 900; state.inventory.chromatic = 400;
state.inventory.platinum = 400; state.inventory.sodium = 400; state.inventory.dihydrogen = 400;

// build one of everything
let built = 0;
for (const type of Object.keys(building.PARTS)) {
  const spot = { x: surface.pos.x + built * 8, y: 0, z: surface.pos.z + 12 };
  spot.y = surface.height(spot.x, spot.z);
  const rec = building.build(homePlanet, homeSys, type, spot);
  if (rec) { surface.spawnPart(rec); built++; }
}
console.log('base parts built:', built, '/', Object.keys(building.PARTS).length,
  '· stack limit now', stats.stackLimit);

// farming
const farmPart = surface.baseParts.find((b) => b.record.type === 'farm');
building.plant(farmPart.record, 'starbulb');
console.log('crop planted:', farmPart.record.crop?.key, '· progress', building.cropProgress(farmPart.record).toFixed(2));
farmPart.record.crop.planted = Date.now() - 200000;   // fast-forward past maturity
const harvested = building.harvest(farmPart.record);
console.log('harvest:', harvested);

// base persists across a revisit
const otherPlanet = homeSys.planets[1] || homeSys.planets[0];
surface.setPlanet(otherPlanet, homeSys);
surface.setPlanet(homePlanet, homeSys);
console.log('base reloaded on revisit:', surface.baseParts.length, 'parts');

// terrain manipulator
const beforeH = surface.height(surface.pos.x, surface.pos.z);
surface.yaw = 0; surface.pitch = -0.4;
surface.applyEdit(-6);
surface.applyEdit(-6);
const spot = surface.buildSpot();
console.log('terrain dug:', (surface.height(spot.x, spot.z) - surface.baseHeight(spot.x, spot.z)).toFixed(1), 'm delta ·',
  state.terrainEdits[homePlanet.seed].length, 'edit(s) stored');
surface.applyEdit(14);
console.log('terrain raised back to', (surface.height(spot.x, spot.z) - surface.baseHeight(spot.x, spot.z)).toFixed(1), 'm delta');

// exocraft
state.exocraftOwned = true;
surface.summonExocraft();
surface.inExocraft = true;
input.keys = new Set(['KeyW']);
const exoStart = surface.exocraft.position.clone();
for (let i = 0; i < 240; i++) { surface.scene.updateMatrixWorld(true); surface.update(1 / 60); }
input.keys = new Set();
console.log('exocraft drove', exoStart.distanceTo(surface.exocraft.position).toFixed(0), 'm · rider position synced:',
  surface.pos.distanceTo(surface.exocraft.position) < 4);
surface.inExocraft = false;

// crashed ship claiming
let wreckPlanet = null;
let wreckScan = 0;
outerWreck:
for (let si = 2; si < 8; si++) {
  const ws = buildSystem(g0.systems[si]);
  for (const pl of ws.planets) {
    wreckScan++;
    surface.setPlanet(pl, ws);
    if (surface.wreck) { wreckPlanet = pl; break outerWreck; }
  }
}
if (wreckPlanet) {
  const u = surface.wreck.userData;
  state.inventory.chromatic = 300; state.inventory.ferrite = 500; state.inventory.platinum = 300;
  surface.pos.copy(surface.wreck.position).add({ x: 4, y: 2, z: 0 });
  input.keys = new Set(['KeyE']);
  let claim = null;
  for (let i = 0; i < 240; i++) {
    surface.scene.updateMatrixWorld(true);
    surface.update(1 / 60);
    if (surface.wreckRequest) claim = surface.wreckRequest;
  }
  input.keys = new Set();
  console.log('wreck found on', wreckPlanet.name, '· claim triggered:', !!claim);
} else console.log('no wreck in this system');

// alien encounters
const enc = aliens.makeEncounter(12345);
console.log('encounter:', enc.race.label, '·', enc.prompt.slice(0, 40) + '…');
// exercise every effect type across every race
for (let seed = 0; seed < 40; seed++) {
  const e = aliens.makeEncounter(seed * 7919);
  for (const opt of e.options) aliens.choose(e, opt);
}
console.log('standing:', JSON.stringify(state.standing), '· words learned:',
  Object.values(state.words).reduce((a, w) => a + w.length, 0));
ui.openDialogue(enc, () => {});
window.document.querySelector('#dialogue-options [data-opt]')?.click();
ui.closeDialogue();
console.log('dialogue UI ok · result:', window.document.getElementById('dialogue-result').textContent.slice(0, 40));

// fleet
state.units = 5000000;
console.log('freighter:', fleet.buyFreighter('capital'), '· name', state.freighter?.name);
console.log('frigates hired:', ['industrial', 'exploration', 'combat'].map((t) => fleet.buyFrigate(t)).join(','));
fleet.sendExpedition(state.frigates[0].id, 3);
state.frigates[0].returnsAt = Date.now() - 10;
const done = fleet.tick();
const payout = fleet.collect(state.frigates[0].id);
console.log('expedition returned:', done.length, '· payout units', payout?.units, '· stack limit', stats.stackLimit);

// story + milestones
console.log('atlas step:', story.current()?.title, '· of', story.STEPS.length);
let advanced = 0;
for (let i = 0; i < 8; i++) { state.story.seeds = 5; state.coreJumps = 1; if (story.check()) advanced++; }
console.log('story steps advanced:', advanced, '· done:', state.story.done);
const ms = story.checkMilestones();
console.log('milestones awarded:', ms.length, ms.slice(0, 3).map((m) => `${m.label} T${m.tier}`).join(', '));

// cooked buffs
const { hasBuff } = await import(ROOT + '/src/state.js');
state.inventory.carbon = 500; state.inventory.sodium = 500; state.inventory.dihydrogen = 500; state.inventory.platinum = 500;
const cooked = crafting.RECIPES.filter((r) => r.cooked);
for (const r of cooked) crafting.craft(r);
console.log('cooked meals:', cooked.length, '· active buffs:',
  ['hazard', 'jetpack', 'mining', 'shield'].filter(hasBuff).join(', '),
  '· hazard drain now', stats.hazardDrain);

// teleport network
ui.openTeleport(999, () => {}, () => {});
console.log('teleport targets listed:', window.document.querySelectorAll('#teleport-list [data-tp]').length);
ui.closeTeleport();

// station: fleet + locals tabs render
ui.openTrade(galaxy.systems[0], () => {});
console.log('fleet cards:', window.document.querySelectorAll('#fleet-capital [data-freighter]').length,
  '· frigate rows:', window.document.querySelectorAll('#fleet-frigates .mission-row').length,
  '· buy-stock rows:', window.document.querySelectorAll('#trade-buy [data-stock]').length,
  '· locals:', window.document.querySelectorAll('#trade-npc [data-talk]').length);
ui.closeTrade();

// anomaly goods
state.nanites = 2000;
ui.openAnomaly(() => {});
window.document.querySelector('#anomaly-goods [data-good="exocraft"]')?.click();
ui.closeAnomaly();
console.log('exocraft purchased:', state.exocraftOwned);

// journey log panes
ui.renderDiscoveries();
console.log('log panes — milestones:', window.document.querySelectorAll('#milestone-list .mission').length,
  '· story:', window.document.querySelectorAll('#story-list .mission').length,
  '· language:', window.document.querySelectorAll('#language-list .mission').length);

// ---- COCKPIT + SEAMLESS ATMOSPHERIC FLIGHT ---------------------------
ui.mode = 'space';
const flySys = buildSystem(g0.systems[1]);
space.setSystem(flySys);
console.log('cockpit built:', !!space.cockpit, '· screens:', space.cockpit.userData.screens.length);
console.log('cockpit toggle ->', space.toggleCockpit(), '· hull hidden from inside:',
  space.ship.children.filter((c) => c.isMesh && c.visible).length === 0);
input.keys = new Set();
for (let i = 0; i < 30; i++) space.update(1 / 60);
console.log('camera inside ship:', space.camera.position.distanceTo(space.ship.position).toFixed(2), 'u from hull centre');
space.toggleCockpit();

// fly into a planet and check the entry handoff fires
const flyHolder = space.planets[0];
const planet = flyHolder.userData.planet;
space.transitCooldown = 0;
space.throttle = 0; space.speed = 0;
space.ship.position.copy(flyHolder.position).add({ x: 0, y: 0, z: planet.radius * 1.03 });
let entry = null;
for (let i = 0; i < 120; i++) { space.update(1 / 60); if (space.entryRequest) entry = space.entryRequest; }
console.log('atmospheric entry triggered:', !!entry,
  entry ? `lat ${entry.lat.toFixed(2)} lon ${entry.lon.toFixed(2)}` : '');

// hand off into surface flight
ui.mode = 'surface';
surface.setPlanet(planet, flySys);
surface.beginAtmosphericFlight(entry || { lat: 0.3, lon: 1.1, heading: { x: 0, y: 0, z: -1 }, speed: 200 });
const startAlt = surface.ship.position.y - surface.height(surface.ship.position.x, surface.ship.position.z);
console.log('entered flying at altitude', Math.round(startAlt), 'm · piloting:', surface.piloting);

// descend and land
input.keys = new Set(['ControlLeft']);
let landedAt = null;
for (let i = 0; i < 1200 && !landedAt; i++) {
  surface.scene.updateMatrixWorld(true);
  surface.update(1 / 60);
  const alt = surface.ship.position.y - surface.height(surface.ship.position.x, surface.ship.position.z);
  if (alt <= 2.4 && Math.abs(surface.shipSpeed) < 24) landedAt = alt;
}
input.keys = new Set();
console.log('ship landed:', landedAt !== null, '· altitude', landedAt?.toFixed(1), 'm · hull', state.shipHealth.toFixed(0));

// disembark, walk, re-board
surface.disembark();
console.log('on foot after landing:', !surface.piloting,
  '· distance to ship', surface.pos.distanceTo(surface.ship.position).toFixed(1), 'm');
surface.boardShip();
console.log('re-boarded:', surface.piloting);

// climb back out to space
input.keys = new Set(['Space', 'KeyW']);
let exit = null;
for (let i = 0; i < 2000 && !exit; i++) {
  surface.update(1 / 60);
  if (surface.exitRequest) exit = surface.exitRequest;
}
input.keys = new Set();
console.log('left atmosphere:', !!exit, exit ? `lat ${exit.lat.toFixed(2)} lon ${exit.lon.toFixed(2)}` : '',
  '· final altitude', Math.round(surface.ship.position.y - surface.height(surface.ship.position.x, surface.ship.position.z)));

// lat/lon mapping round-trips
const rt = surface.xzToLatLon(...Object.values(surface.latLonToXZ(0.42, -1.9)).slice(0, 2));
console.log('lat/lon round trip:', rt.lat.toFixed(3), rt.lon.toFixed(3), '(expected 0.420 -1.900)');
surface.piloting = false;

// ---- MAP + SAVE ------------------------------------------------------
map.show(0);
map.selected = 5;
map.tick(0.016);
map.updateInfo();
console.log('map ok, jump range', stats.jumpRange, 'info len', window.document.getElementById('map-info').innerHTML.length);
map.toggleView();
map.tick(0.016);
console.log('intergalactic view drew', map.view, '· galaxies plotted', (map._galaxyHits || []).length);
map.toggleView();
map.hide();

ui.renderDiscoveries();
console.log('save:', saveGame(), 'load:', loadGame());

// warp to another system
t = Date.now();
space.setSystem(buildSystem(galaxy.systems[7]));
frames(space, 120, 1 / 60, ['KeyW']);
console.log('second system:', Date.now() - t, 'ms');

await new Promise((r) => setTimeout(r, 200));
console.log('\nERRORS:', errors.length ? errors.slice(0, 5) : 'none');
process.exit(errors.length ? 1 : 0);
