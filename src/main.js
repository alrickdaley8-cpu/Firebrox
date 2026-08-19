// FIREBROX — entry point: renderer, post-processing, game modes, loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { generateGalaxy, buildSystem, RESOURCES } from './universe.js';
import {
  state, stats, saveGame, loadGame, clearSave, hasSave,
  hasResources, spendResources,
} from './state.js';
import { input } from './input.js';
import { ui } from './ui.js';
import { SpaceMode } from './space.js';
import { SurfaceMode } from './surface.js';
import { GalaxyMap } from './map.js';
import { audio } from './audio.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const game = {
  mode: 'title',
  running: false,
  paused: false,
  galaxy: generateGalaxy('firebrox-prime', 320),
  system: null,
  space: new SpaceMode(),
  surface: new SurfaceMode(),
  map: null,
  docked: false,
};

game.map = new GalaxyMap(game.galaxy, (sys) => warpTo(sys.id));
input.init(canvas);
ui.init();

// ------------------------------------------------------------------ post fx
function makeComposer(scene, camera, strength, radius, threshold) {
  const c = new EffectComposer(renderer);
  c.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), strength, radius, threshold);
  c.addPass(bloom);
  c.addPass(new OutputPass());
  c.bloom = bloom;
  return c;
}
const composers = {
  space: makeComposer(game.space.scene, game.space.camera, 0.85, 0.55, 0.62),
  surface: makeComposer(game.surface.scene, game.surface.camera, 0.34, 0.5, 0.95),
};

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  for (const c of [game.space.camera, game.surface.camera]) {
    c.aspect = w / h;
    c.updateProjectionMatrix();
  }
  for (const key of Object.keys(composers)) {
    composers[key].setSize(w, h);
    composers[key].bloom.setSize(w, h);
  }
  if (game.map.open) { game.map.resize(); game.map.draw(); }
}
addEventListener('resize', resize);

// ------------------------------------------------------------------ flow
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
    ui.warpFlash(1100);
    ui.log(`WARP COMPLETE — ${game.system.name}`, 'good');
    input.lock();
  }, 480);
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
    ui.log(`Gravity ${planet.gravity.toFixed(2)}g · ${planet.weather} · sentinels ${planet.sentinels}`, '');
    input.lock();
  }, 520);
}

function launchToSpace() {
  const planetIndex = game.surface.planet.index;
  audio.sweep(120, 900, 1.1, 'sawtooth', 0.28);
  ui.loading('Leaving orbit…');
  setTimeout(() => {
    game.space.setSystem(game.system, { fromPlanet: planetIndex });
    game.mode = 'space';
    ui.mode = 'space';
    ui.loading(null);
    ui.log('LAUNCHED — welcome back to the void', 'good');
    input.lock();
  }, 460);
}

function dockAtStation() {
  game.docked = true;
  input.unlock();
  state.shipHealth = 100;
  state.shields = stats.shieldMax;
  state.launchFuel = 100;
  state.life = 100;
  ui.log('DOCKED — hull repaired, thrusters refuelled', 'good');
  audio.discovery();
  ui.openTrade(game.system, () => {
    game.docked = false;
    // shove the ship clear of the station so we do not instantly re-dock
    const st = game.space.station;
    if (st) {
      const away = game.space.ship.position.clone().sub(st.position).normalize();
      if (away.lengthSq() < 0.1) away.set(0, 1, 0);
      game.space.ship.position.copy(st.position).addScaledVector(away, 900);
      game.space.ship.lookAt(st.position.clone().addScaledVector(away, 4000));
      game.space.camPos.copy(game.space.ship.position);
    }
    input.lock();
  });
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
  ui.log('WARP CELL CRAFTED', 'good');
  audio.discovery();
}

function setPaused(v) {
  game.paused = v;
  document.getElementById('pause').classList.toggle('hidden', !v);
  if (v) { ui.renderDiscoveries(); input.unlock(); }
  else input.lock();
}

function startGame(continueSave) {
  if (continueSave) loadGame();
  document.getElementById('title').classList.add('hidden');
  ui.showHUD(true);
  audio.resume();
  ui.loading('Generating star system…');
  setTimeout(() => {
    enterSystem(state.systemId || 0);
    ui.loading(null);
    game.running = true;
    ui.log(`ARRIVED — ${game.system.name}`, 'good');
    ui.log('Hold E near a planet to land · F to scan · M for the galaxy map', '');
    input.lock();
  }, 80);
}

// ------------------------------------------------------------------ wiring
document.getElementById('btn-new').onclick = () => { clearSave(); startGame(false); };
document.getElementById('btn-continue').onclick = () => startGame(true);
document.getElementById('btn-resume').onclick = () => setPaused(false);
document.getElementById('btn-save').onclick = () => {
  const ok = saveGame();
  ui.log(ok ? 'JOURNEY SAVED' : 'SAVE FAILED', ok ? 'good' : 'bad');
};
document.getElementById('btn-quit').onclick = () => location.reload();
document.getElementById('btn-continue').disabled = !hasSave();

canvas.addEventListener('click', () => {
  audio.resume();
  if (game.running && !game.paused && !game.map.open && !game.docked) input.lock();
});

addEventListener('keydown', (e) => {
  if (!game.running) return;
  if (game.docked) {
    if (e.code === 'Escape' || e.code === 'KeyE') ui.closeTrade();
    return;
  }
  switch (e.code) {
    case 'KeyM':
      if (game.mode !== 'space') { ui.log('Galaxy map is only available in flight', 'warn'); break; }
      if (game.map.open) { game.map.hide(); input.lock(); }
      else { input.unlock(); game.map.show(state.systemId); }
      break;
    case 'Enter':
      if (game.map.open && !game.map.tryWarp()) {
        ui.log('Warp failed — check range and warp cells', 'bad');
        audio.error();
      }
      break;
    case 'KeyC': craftWarpCell(); break;
    case 'Tab': e.preventDefault(); setPaused(!game.paused); break;
    case 'Escape': if (game.map.open) game.map.hide(); break;
    case 'KeyP': renderer.toneMappingExposure = renderer.toneMappingExposure > 1 ? 0.85 : 1.05; break;
    default: break;
  }
  if (e.ctrlKey && e.code === 'KeyS') { e.preventDefault(); saveGame(); ui.log('JOURNEY SAVED', 'good'); }
});

setInterval(() => { if (game.running && !game.paused) saveGame(); }, 30000);

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let lastShield = state.shields;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());

  if (!game.running) {
    game.space.titleTick(dt);
    composers.space.render();
    return;
  }

  const active = game.mode === 'space' ? game.space : game.surface;
  const blocked = game.paused || game.map.open || game.docked;
  input.enabled = !blocked && input.locked;

  if (!blocked) {
    state.playTime += dt;
    active.update(dt);
    if (game.mode === 'space') {
      if (game.space.landRequest) landOn(game.space.landRequest);
      else if (game.space.dockRequest) dockAtStation();
    } else if (game.surface.launchRequest) {
      launchToSpace();
    }
    lastShield = state.shields;
  } else {
    input.consumeMouse();
    ui.target(null);
    ui.prompt(blocked && !game.paused && !game.map.open && !game.docked ? 'Click to resume — mouse released' : '');
  }

  if (!input.locked && !blocked) ui.prompt('Click to capture mouse');

  game.map.tick(dt);
  ui.update(active.info?.());
  composers[game.mode].render();
}

resize();
loop();

window.FIREBROX = { game, state, stats, RESOURCES, renderer };
