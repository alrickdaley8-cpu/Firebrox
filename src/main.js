// FIREBROX — entry point: renderer, game modes, and the loop.
import * as THREE from 'three';
import { generateGalaxy, buildSystem, RESOURCES } from './universe.js';
import { state, saveGame, loadGame, clearSave, hasResources, spendResources } from './state.js';
import { input } from './input.js';
import { ui } from './ui.js';
import { SpaceMode } from './space.js';
import { SurfaceMode } from './surface.js';
import { GalaxyMap } from './map.js';
import { audio } from './audio.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const game = {
  mode: 'title',        // title | space | surface
  running: false,
  paused: false,
  galaxy: generateGalaxy('firebrox-prime', 240),
  system: null,
  space: new SpaceMode(),
  surface: new SurfaceMode(),
  map: null,
};

game.map = new GalaxyMap(game.galaxy, (sys) => warpTo(sys.id));
input.init(canvas);
ui.init();

// ------------------------------------------------------------------ helpers
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  for (const c of [game.space.camera, game.surface.camera]) {
    c.aspect = w / h;
    c.updateProjectionMatrix();
  }
  if (game.map.open) { game.map.resize(); game.map.draw(); }
}
addEventListener('resize', resize);

function enterSystem(systemId, opts = {}) {
  state.systemId = systemId;
  game.system = buildSystem(game.galaxy.systems[systemId]);
  game.space.setSystem(game.system, opts);
  game.mode = 'space';
  ui.mode = 'space';
}

function warpTo(systemId) {
  ui.loading('Charging hyperdrive…');
  audio.warp();
  setTimeout(() => {
    enterSystem(systemId);
    ui.loading(null);
    ui.warpFlash(900);
    ui.log(`WARP COMPLETE — ${game.system.name}`, 'good');
    input.lock();
  }, 420);
}

function landOn(planet) {
  ui.loading(`Entering atmosphere of ${planet.name}…`);
  audio.land();
  setTimeout(() => {
    game.surface.setPlanet(planet, game.system);
    game.mode = 'surface';
    ui.mode = 'surface';
    state.launchFuel = Math.max(0, state.launchFuel - 20);
    ui.loading(null);
    ui.log(`LANDED — ${planet.name} · ${planet.biome.label} world`, 'good');
    if (planet.biome.hazard !== 'None') ui.log(`ENVIRONMENT HAZARD: ${planet.biome.hazard}`, 'warn');
    input.lock();
  }, 500);
}

function launchToSpace() {
  audio.sweep(120, 900, 1.1, 'sawtooth', 0.28);
  const planetIndex = game.surface.planet.index;
  ui.loading('Leaving orbit…');
  setTimeout(() => {
    game.space.setSystem(game.system, { fromPlanet: planetIndex });
    game.mode = 'space';
    ui.mode = 'space';
    ui.loading(null);
    ui.log('LAUNCHED — welcome back to the void', 'good');
    input.lock();
  }, 420);
}

function craftWarpCell() {
  const cost = { dihydrogen: 100, ferrite: 50 };
  if (!hasResources(cost)) {
    ui.log('Cannot craft Warp Cell — need 100 Di-hydrogen + 50 Ferrite Dust', 'bad');
    audio.error();
    return;
  }
  spendResources(cost);
  state.inventory.warpcell += 1;
  ui.flashSlot('warpcell');
  audio.discovery();
  ui.log('WARP CELL CRAFTED', 'good');
}

function setPaused(v) {
  game.paused = v;
  document.getElementById('pause').classList.toggle('hidden', !v);
  if (v) { ui.renderDiscoveries(); input.unlock(); }
  else input.lock();
}

function startGame(continueSave) {
  if (continueSave) loadGame();
  audio.resume();
  document.getElementById('title').classList.add('hidden');
  ui.showHUD(true);
  ui.loading('Generating star system…');
  setTimeout(() => {
    enterSystem(state.systemId || 0);
    ui.loading(null);
    game.running = true;
    ui.log(`ARRIVED — ${game.system.name}`, 'good');
    ui.log('Hold E near a planet to land · F to scan · M for the galaxy map', '');
    input.lock();
  }, 60);
}

// ------------------------------------------------------------------ UI wiring
document.getElementById('btn-new').onclick = () => { clearSave(); startGame(false); };
document.getElementById('btn-continue').onclick = () => startGame(true);
document.getElementById('btn-resume').onclick = () => setPaused(false);
document.getElementById('btn-save').onclick = () => {
  const ok = saveGame();
  ui.log(ok ? 'JOURNEY SAVED' : 'SAVE FAILED', ok ? 'good' : 'bad');
};
document.getElementById('btn-quit').onclick = () => location.reload();

try {
  document.getElementById('btn-continue').disabled = !localStorage.getItem('firebrox.save.v1');
} catch (e) { /* ignore */ }

canvas.addEventListener('click', () => {
  audio.resume();
  if (game.running && !game.paused && !game.map.open) input.lock();
});

addEventListener('keydown', (e) => {
  if (!game.running) return;
  if (e.code === 'KeyM') {
    if (game.mode !== 'space') { ui.log('Galaxy map is only available in flight', 'warn'); return; }
    if (game.map.open) { game.map.hide(); input.lock(); }
    else { input.unlock(); game.map.show(state.systemId); }
  }
  if (e.code === 'Enter' && game.map.open) {
    if (!game.map.tryWarp()) ui.log('Warp failed — check range and warp cells', 'bad');
  }
  if (e.code === 'KeyC') craftWarpCell();
  if (e.code === 'Tab') { e.preventDefault(); setPaused(!game.paused); }
  if (e.code === 'Escape' && game.map.open) { game.map.hide(); }
  if (e.code === 'F5' || (e.ctrlKey && e.code === 'KeyS')) { e.preventDefault(); saveGame(); ui.log('JOURNEY SAVED', 'good'); }
});

// autosave
setInterval(() => { if (game.running) saveGame(); }, 30000);

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());

  if (!game.running) { renderer.render(game.space.scene, game.space.camera); return; }

  const active = game.mode === 'space' ? game.space : game.surface;
  input.enabled = !game.paused && !game.map.open && input.locked;

  if (!game.paused && !game.map.open) {
    active.update(dt);
    if (game.mode === 'space' && game.space.landRequest) landOn(game.space.landRequest);
    if (game.mode === 'surface' && game.surface.launchRequest) launchToSpace();
  } else {
    input.consumeMouse();
    ui.target(null);
    ui.prompt(game.paused || game.map.open ? '' : 'Click to resume — mouse released');
  }

  game.map.tick(dt);
  ui.update(active.info?.());
  renderer.render(active.scene, active.camera);
}

resize();
loop();

// expose for debugging
window.FIREBROX = { game, state, RESOURCES };
