// FIREBROX — entry point: renderer, post-processing, game modes, loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { generateGalaxy, buildSystem, RESOURCES, distance, GALAXIES, galaxyDef } from './universe.js';
import {
  state, stats, saveGame, loadGame, clearSave, hasSave,
} from './state.js';
import * as missions from './missions.js';
import * as fleet from './fleet.js';
import * as story from './story.js';
import * as building from './building.js';
import { renderControlsHTML } from './controls.js';
import { input } from './input.js';
import { ui } from './ui.js';
import { SpaceMode } from './space.js';
import { SurfaceMode } from './surface.js';
import { GalaxyMap } from './map.js';
import { audio } from './audio.js';

function fatal(msg) {
  const el = document.getElementById('fatal');
  if (!el) return;
  document.getElementById('fatal-msg').textContent = String(msg);
  el.classList.remove('hidden');
  document.getElementById('title')?.classList.add('hidden');
}
addEventListener('error', (e) => fatal(e.message || e.error));
addEventListener('unhandledrejection', (e) => fatal(e.reason?.message || e.reason));

const canvas = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance',
  });
} catch (err) {
  fatal('WebGL could not start: ' + err.message);
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const game = {
  mode: 'title',
  running: false,
  paused: false,
  galaxy: generateGalaxy(state.galaxyIndex),
  system: null,
  space: new SpaceMode(),
  surface: new SurfaceMode(),
  map: null,
  docked: false,
  crafting: false,
  settingsOpen: false,
  photoMode: false,
  controlsOpen: false,
  atAnomaly: false,
  talking: false,
  teleporting: false,
  seeding: false,
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

function applySettings() {
  const s = state.settings;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75) * s.renderScale);
  renderer.shadowMap.enabled = s.shadows;
  game.surface.sun.castShadow = s.shadows;
  composers.space.bloom.strength = 0.85 * s.bloom;
  composers.surface.bloom.strength = 0.34 * s.bloom;
  game.surface.camera.fov = s.fov;
  game.surface.camera.updateProjectionMatrix();
  input.sensitivity = s.sensitivity;
  input.invertY = s.invertY;
  audio.setVolumes(s.music, s.sfx);
  resize();
}
ui.onSettingsChange = applySettings;

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

function atmosphericEntry(entry) {
  const planet = entry.planet;
  audio.sweep(320, 90, 1.6, 'sawtooth', 0.3);
  game.surface.setPlanet(planet, game.system);
  game.surface.beginAtmosphericFlight(entry);
  game.mode = 'surface';
  ui.mode = 'surface';
  game.space.transitCooldown = 6;
  ui.log(`ATMOSPHERIC ENTRY — ${planet.name} · ${planet.biome.label}`, 'warn');
  if (planet.biome.hazard !== 'None') ui.log(`HAZARD: ${planet.biome.hazard}`, 'warn');
  ui.log('Fly down and land · Space climbs · Ctrl descends · F disembarks · T toggles cockpit', '');
}

function leaveAtmosphere(exit) {
  const planetIndex = game.surface.planet.index;
  audio.sweep(140, 900, 1.4, 'sawtooth', 0.3);
  game.space.setSystem(game.system, { fromPlanet: planetIndex });
  // come out of the atmosphere above the point we left from
  const holder = game.space.planets[planetIndex];
  if (holder) {
    const p = holder.userData.planet;
    const dir = new THREE.Vector3(
      Math.cos(exit.lat) * Math.cos(exit.lon),
      Math.sin(exit.lat),
      Math.cos(exit.lat) * Math.sin(exit.lon)
    ).normalize();
    game.space.ship.position.copy(holder.position).addScaledVector(dir, p.radius * 1.5);
    game.space.faceShip(holder.position.clone().addScaledVector(dir, p.radius * 6));
    game.space.camPos.copy(game.space.ship.position);
    game.space.transitCooldown = 6;
    game.space.throttle = 0.5;
  }
  game.mode = 'space';
  ui.mode = 'space';
  ui.log('LEFT THE ATMOSPHERE — welcome back to the void', 'good');
}

function launchToSpace() {
  const planetIndex = game.surface.planet.index;
  state.launchFuel = Math.max(0, state.launchFuel - 20);
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
  missions.syncGather();
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

function wormholeTravel() {
  const cur = game.galaxy.systems[state.systemId];
  if (cur.intergalactic) {
    ui.log('INTERGALACTIC RIFT — hold on to something', 'warn');
    jumpToGalaxy(state.galaxyIndex + 1 + Math.floor(Math.random() * 3), 'rift');
    return;
  }
  const target = game.galaxy.systems[cur.wormholeTo];
  if (!target) return;
  const d = distance(cur.pos, target.pos);
  state.lightYears += d;
  state.wormholesUsed++;
  audio.sweep(180, 1800, 1.3, 'sine', 0.3);
  ui.warpFlash(1200);
  ui.loading('Threading the wormhole…');
  setTimeout(() => {
    enterSystem(target.id);
    ui.loading(null);
    ui.log(`WORMHOLE TRANSIT — ${d.toFixed(0)} ly to ${target.name}`, 'good');
    input.lock();
  }, 700);
}

function portalTravel(req) {
  const sysId = req.systemHash % game.galaxy.systems.length;
  const sys = buildSystem(game.galaxy.systems[sysId]);
  const planet = sys.planets[req.planetIndex % sys.planets.length];
  state.portalsUsed++;
  audio.sweep(900, 120, 1.4, 'triangle', 0.3);
  ui.warpFlash(1400);
  ui.loading(`Portal ${req.glyphs} — resolving address…`);
  setTimeout(() => {
    state.systemId = sysId;
    game.system = sys;
    game.space.setSystem(sys, { fromPlanet: planet.index });
    game.surface.setPlanet(planet, sys);
    game.mode = 'surface';
    ui.mode = 'surface';
    ui.loading(null);
    ui.log(`PORTAL TRANSIT — ${planet.name} in ${sys.name}`, 'good');
    ui.log('Your ship was summoned to the portal site', '');
    input.lock();
  }, 900);
}

function jumpToGalaxy(index, reason = 'core') {
  const idx = ((index % GALAXIES.length) + GALAXIES.length) % GALAXIES.length;
  state.galaxyIndex = idx;
  if (!state.visitedGalaxies.includes(idx)) state.visitedGalaxies.push(idx);
  game.galaxy = generateGalaxy(idx);
  game.map.setGalaxy(game.galaxy);
  state.visitedSystems = {};
  state.shipHealth = reason === 'core' ? 100 : Math.max(15, state.shipHealth - 35);
  if (reason === 'core') {
    state.coreJumps++;
    state.units += 250000;
    state.nanites += 1500;
  }
  state.inventory.warpcell = Math.max(state.inventory.warpcell, 3);
  ui.warpFlash(2400);
  audio.sweep(60, 3000, 3, 'sine', 0.4);
  const def = galaxyDef(idx);
  ui.loading(`Crossing into ${def.name}…`);
  setTimeout(() => {
    enterSystem(Math.floor(Math.random() * game.galaxy.systems.length));
    ui.loading(null);
    ui.log(`GALAXY ${idx + 1}/${GALAXIES.length} — ${def.name} · ${def.type} · hostility ${def.traits.hostility.toFixed(2)}×`, 'good');
    if (reason === 'core') ui.log('Core breach bonus: +250,000 units, +1500 nanites', 'good');
    input.lock();
  }, 1400);
}

function takeAtlasSeed() {
  const at = game.space.atlas;
  if (!at || at.userData.taken) return;
  at.userData.taken = true;
  if (!state.story.atlasTaken) state.story.atlasTaken = {};
  state.story.atlasTaken[`${state.galaxyIndex}:${state.systemId}`] = true;
  const n = story.addAtlasSeed();
  state.nanites += 120;
  ui.warpFlash(700);
  audio.discovery();
  ui.log(`ATLAS SEED ACQUIRED — ${n}/5 · +120 nanites`, 'good');
  ui.log('The eye dims. Something vast has noticed you.', '');
}

function dockAtAnomaly() {
  game.atAnomaly = true;
  input.unlock();
  state.life = 100;
  state.hazardProtection = 100;
  ui.openAnomaly(() => {
    game.atAnomaly = false;
    const an = game.space.anomaly;
    if (an) {
      const away = game.space.ship.position.clone().sub(an.position).normalize();
      if (away.lengthSq() < 0.1) away.set(0, 1, 0);
      game.space.ship.position.copy(an.position).addScaledVector(away, 950);
      game.space.camPos.copy(game.space.ship.position);
    }
    input.lock();
  });
}

function blackHoleJump() {
  const cur = game.galaxy.systems[state.systemId];
  // fall inward: pick a system much closer to the core, at most 2500 ly away
  const candidates = game.galaxy.systems
    .filter((s) => s.distFromCore < cur.distFromCore * 0.72 && s.id !== cur.id)
    .sort((a, b) => distance(cur.pos, a.pos) - distance(cur.pos, b.pos));
  const target = candidates[Math.floor(Math.random() * Math.min(6, candidates.length))] || game.galaxy.systems[game.galaxy.coreId];
  const d = distance(cur.pos, target.pos);
  state.lightYears += d;
  state.coreJumps++;
  state.shipHealth = Math.max(12, state.shipHealth - 25);
  ui.warpFlash(1400);
  audio.sweep(2400, 60, 2.2, 'sawtooth', 0.35);
  ui.loading('Falling through the singularity…');
  setTimeout(() => {
    enterSystem(target.id);
    ui.loading(null);
    ui.log(`SINGULARITY TRANSIT — ${d.toFixed(0)} ly toward the core. Hull scarred.`, 'warn');
    input.lock();
  }, 900);
}

function openCrafting() {
  game.crafting = true;
  input.unlock();
  ui.openCraft(() => { game.crafting = false; input.lock(); });
}

function toggleControls() {
  game.controlsOpen = !game.controlsOpen;
  const el = document.getElementById('controls-overlay');
  el.classList.toggle('hidden', !game.controlsOpen);
  if (game.controlsOpen) { input.unlock(); } else if (!game.paused) input.lock();
}

function openSettings() {
  game.settingsOpen = true;
  input.unlock();
  ui.openSettings(() => { game.settingsOpen = false; if (!game.paused) input.lock(); });
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
  applySettings();
  audio.startAmbient();
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
document.getElementById('btn-settings').onclick = () => openSettings();
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
  if (game.controlsOpen && e.code !== 'F1' && e.code !== 'Slash') {
    if (e.code === 'Escape') toggleControls();
    return;
  }
  if (game.talking) { if (e.code === 'Escape') ui.closeDialogue(); return; }
  if (game.teleporting) { if (e.code === 'Escape') ui.closeTeleport(); return; }
  if (game.seeding) { if (e.code === 'Escape') ui.closeSeeds(); return; }
  if (game.atAnomaly) {
    if (e.code === 'Escape' || e.code === 'KeyE') ui.closeAnomaly();
    return;
  }
  if (game.crafting) {
    if (e.code === 'Escape' || e.code === 'KeyC') ui.closeCraft();
    return;
  }
  if (game.settingsOpen) {
    if (e.code === 'Escape') ui.closeSettings();
    return;
  }
  switch (e.code) {
    case 'KeyM':
      if (game.mode !== 'space') { ui.log('Galaxy map is only available in flight', 'warn'); break; }
      if (game.map.open) { game.map.hide(); input.lock(); }
      else { input.unlock(); game.map.show(state.systemId); }
      break;
    case 'KeyG':
      if (game.map.open) { game.map.toggleView(); }
      break;
    case 'Enter':
      if (game.map.open && !game.map.tryWarp()) {
        ui.log('Warp failed — check range and warp cells', 'bad');
        audio.error();
      }
      break;
    case 'KeyC': openCrafting(); break;
    case 'KeyB':
      if (game.mode === 'surface') game.surface.toggleBuildMode();
      else ui.log('Base building only works planetside', 'warn');
      break;
    case 'KeyN':
      if (game.mode === 'surface' && !game.surface.piloting) {
        const base = building.baseFor(game.surface.planet);
        ui.log(base ? `${base.name} — ${base.parts.length} parts built here` : 'No base on this world yet (press B)', '');
      }
      break;
    case 'BracketLeft': if (game.mode === 'surface' && game.surface.buildMode) game.surface.cycleBuildType(-1); break;
    case 'BracketRight': if (game.mode === 'surface' && game.surface.buildMode) game.surface.cycleBuildType(1); break;
    case 'KeyV': if (game.mode === 'surface') game.surface.summonExocraft(); break;
    case 'KeyT': {
      const active = game.mode === 'space' ? game.space : game.surface;
      if (game.mode === 'surface' && !game.surface.piloting) {
        ui.log('Cockpit view is available while flying your ship', 'warn');
        break;
      }
      const on = active.toggleCockpit();
      ui.log(on ? 'COCKPIT VIEW' : 'CHASE VIEW', '');
      break;
    }
    case 'KeyH':
      game.photoMode = !game.photoMode;
      ui.showHUD(!game.photoMode);
      if (game.photoMode) ui.log('PHOTO MODE — press H to restore the HUD', '');
      break;
    case 'Tab': e.preventDefault(); setPaused(!game.paused); break;
    case 'Escape':
      if (game.map.open) { game.map.hide(); input.lock(); }
      break;
    case 'F1':
    case 'Slash':
      e.preventDefault();
      toggleControls();
      break;
    case 'KeyP': renderer.toneMappingExposure = renderer.toneMappingExposure > 1 ? 0.85 : 1.05; break;
    default: break;
  }
  if (e.ctrlKey && e.code === 'KeyS') { e.preventDefault(); saveGame(); ui.log('JOURNEY SAVED', 'good'); }
});

setInterval(() => { if (game.running && !game.paused) saveGame(); }, 30000);

// a live reload (or closing the tab) should never cost you progress
for (const evt of ['beforeunload', 'pagehide']) {
  addEventListener(evt, () => { if (game.running) saveGame(); });
}

// after a live reload, drop straight back into the game instead of the title screen
try {
  if (sessionStorage.getItem('firebrox.autoresume') === '1' && hasSave()) {
    sessionStorage.removeItem('firebrox.autoresume');
    setTimeout(() => {
      startGame(true);
      ui.log('PREVIEW UPDATED — journey resumed from your last save', 'good');
    }, 50);
  }
} catch (e) { /* sessionStorage unavailable */ }

// ------------------------------------------------------------------ loop
let gatherTick = 1;
let lastFrameTime = performance.now();
let lastShield = state.shields;

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  if (!game.running) {
    game.space.titleTick(dt);
    composers.space.render();
    return;
  }

  const active = game.mode === 'space' ? game.space : game.surface;
  const blocked = game.paused || game.map.open || game.docked || game.crafting
    || game.settingsOpen || game.atAnomaly || game.talking || game.teleporting
    || game.seeding || game.controlsOpen;
  input.enabled = !blocked && input.locked;

  if (!blocked) {
    state.playTime += dt;
    active.update(dt);
    if (game.mode === 'space') {
      if (game.space.coreRequest) jumpToGalaxy(state.galaxyIndex + 1, 'core');
      else if (game.space.blackHoleRequest) blackHoleJump();
      else if (game.space.wormholeRequest) wormholeTravel();
      else if (game.space.anomalyRequest) dockAtAnomaly();
      else if (game.space.atlasRequest) takeAtlasSeed();
      else if (game.space.entryRequest) atmosphericEntry(game.space.entryRequest);
      else if (game.space.dockRequest) dockAtStation();
    } else if (game.surface.exitRequest) {
      const ex = game.surface.exitRequest;
      game.surface.exitRequest = null;
      game.surface.piloting = false;
      leaveAtmosphere(ex);
    } else if (game.surface.launchRequest) {
      launchToSpace();
    } else if (game.surface.portalRequest) {
      portalTravel(game.surface.portalRequest);
      game.surface.portalRequest = null;
    } else if (game.surface.wreckRequest) {
      claimWreck(game.surface.wreckRequest);
      game.surface.wreckRequest = null;
    } else if (game.surface.teleportRequest) {
      game.surface.teleportRequest = null;
      openTeleport();
    } else if (game.surface.plantRequest) {
      const part = game.surface.plantRequest;
      game.surface.plantRequest = null;
      openSeeds(part);
    } else if (game.surface.encounterRequest) {
      const enc = game.surface.encounterRequest;
      game.surface.encounterRequest = null;
      openDialogue(enc);
    }
    lastShield = state.shields;
    gatherTick -= dt;
    if (gatherTick <= 0) {
      gatherTick = 1;
      for (const m of missions.syncGather()) ui.missionDone(m);
      const step = story.check();
      if (step) ui.storyStep(step);
      for (const ms of story.checkMilestones()) ui.milestone(ms);
      for (const f of fleet.tick()) ui.log(`FRIGATE RETURNED — ${f.name} is waiting at your freighter`, 'good');
    }
  } else {
    input.consumeMouse();
    ui.target(null);
    ui.prompt(blocked && !game.paused && !game.map.open && !game.docked ? 'Click to resume — mouse released' : '');
  }

  if (!input.locked && !blocked) ui.prompt('Click to capture mouse');

  game.map.tick(dt);
  const info = active.info?.();
  if (info) info.galaxy = game.galaxy.name;
  ui.update(info);
  composers[game.mode].render();
}

document.getElementById('controls-list').innerHTML = renderControlsHTML();
document.getElementById('btn-controls-close').onclick = () => toggleControls();
document.getElementById('btn-controls').onclick = () => { setPaused(false); toggleControls(); };
document.getElementById('title-controls').innerHTML = renderControlsHTML();

applySettings();
resize();
loop();

window.FIREBROX = { game, state, stats, RESOURCES, renderer };
