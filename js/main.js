import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import {
  mountUI,
  PRESETS,
  PALETTES,
  randomizeMatrix,
  mutateMatrix,
  symmetrizeMatrix,
  hashMatrix,
  mulberry32,
} from './ui.js';

const canvas = document.getElementById('stage');
const startSize = viewport();
const sim = new Simulation(startSize.w, startSize.h);
const renderer = new Renderer(canvas);

const state = {
  running: true,
  timeScale: 1,
  presetId: 'genesis',
  palette: 'spectrum',
  randMode: 'life',
  mouseMode: 'attract',
  seed: '------',
  blurb: PRESETS[0].blurb,
  focus: -1,
  size: 3.4,
};

const ui = mountUI({
  setSpecies: (v) => {
    sim.setSpecies(v);
    applyPalette(state.palette);
    state.presetId = 'custom';
    refresh();
  },
  setCount: (v) => {
    sim.setCount(v);
    refresh();
  },
  setRadius: (v) => {
    sim.rMax = v;
    refresh();
  },
  setForce: (v) => {
    sim.force = v;
    refresh();
  },
  setDamp: (v) => {
    sim.damp = v;
    refresh();
  },
  setCollision: (v) => {
    sim.beta = v;
    refresh();
  },
  setTemp: (v) => {
    sim.temp = v;
    refresh();
  },
  setTime: (v) => {
    state.timeScale = v;
    refresh();
  },
  setSize: (v) => {
    state.size = v;
    renderer.size = v;
    refresh();
  },
  setWrap: (v) => {
    sim.wrap = v;
    refresh();
  },
  setPalette: (id) => {
    applyPalette(id);
    refresh();
  },
  setRandMode: (id) => {
    state.randMode = id;
    refresh();
  },
  setMouseMode: (id) => {
    state.mouseMode = id;
    sim.mouse.mode = id;
    refresh();
  },
  applyPreset,
  randomize,
  mutate,
  symmetrize,
  respawn,
  togglePlay,
  snapshot,
  copyLaws,
  fullscreen,
  setFocus: (i) => {
    state.focus = i;
    renderer.focus = i;
    refresh();
  },
  beginMatrixDrag,
});

applyPreset('genesis', { silent: true, preserveCount: false });
restoreFromHash() || restoreSession();
layout();
ui.openPanel();
refresh();

window.addEventListener('resize', layout);
if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => layout());
  ro.observe(document.documentElement);
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  updateMouse(e, true);
  if (state.mouseMode === 'spawn') sim.spawnAt(sim.mouse.x, sim.mouse.y, 14);
});
canvas.addEventListener('pointermove', (e) => {
  if (sim.mouse.active || e.buttons) updateMouse(e, sim.mouse.active || e.buttons === 1);
  else {
    sim.mouse.x = e.clientX;
    sim.mouse.y = e.clientY;
  }
});
canvas.addEventListener('pointerup', (e) => {
  sim.mouse.active = false;
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
});
canvas.addEventListener('pointerleave', () => {
  sim.mouse.active = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

let last = performance.now();
let acc = 0;
let fps = 60;
let frames = 0;
let fpsT = last;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.running) {
    acc += dt * state.timeScale;
    const step = 1 / 60;
    let guard = 0;
    while (acc >= step && guard < 3) {
      sim.step(step);
      acc -= step;
      guard++;
    }
  }
  renderer.size = state.size;
  renderer.focus = state.focus;
  renderer.render(sim);

  frames++;
  if (now - fpsT > 400) {
    fps = (frames * 1000) / (now - fpsT);
    frames = 0;
    fpsT = now;
    ui.tick(fps, sim.n);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setInterval(persist, 2500);

function applyPreset(id, opts = {}) {
  const preset = PRESETS.find((p) => p.id === id) || PRESETS[0];
  state.presetId = preset.id;
  state.blurb = preset.blurb;
  sim.setSpecies(preset.species);
  if (!opts.preserveCount) sim.setCount(preset.count);
  sim.rMax = preset.rMax;
  sim.force = preset.force;
  sim.damp = preset.damp;
  sim.beta = preset.beta;
  sim.temp = preset.temp;
  sim.wrap = preset.wrap;
  sim.setMatrix(preset.matrix);
  state.size = preset.size ?? 3.4;
  renderer.size = state.size;
  applyPalette(preset.palette);
  state.seed = hashMatrix(sim.getMatrix());
  if (!opts.silent) {
    sim.respawn();
    ui.flash(preset.name);
  }
  refresh();
}

function randomize() {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const rng = mulberry32(seed);
  const matrix = randomizeMatrix(sim.species, state.randMode, rng);
  sim.setMatrix(matrix);
  state.presetId = 'custom';
  state.blurb = 'A new physics, freshly rolled.';
  state.seed = seed.toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
  sim.respawn();
  ui.flash(`LAW #${state.seed}`);
  refresh();
}

function mutate() {
  sim.setMatrix(mutateMatrix(sim.getMatrix()));
  state.presetId = 'custom';
  state.blurb = 'The genome drifted.';
  state.seed = hashMatrix(sim.getMatrix());
  ui.flash('MUTATED');
  refresh();
}

function symmetrize() {
  sim.setMatrix(symmetrizeMatrix(sim.getMatrix()));
  state.presetId = 'custom';
  state.blurb = 'Forces made mutual.';
  state.seed = hashMatrix(sim.getMatrix());
  ui.flash('SYMMETRIZED');
  refresh();
}

function respawn() {
  sim.respawn();
  ui.flash('RESPAWNED');
}

function togglePlay() {
  state.running = !state.running;
  refresh();
}

function snapshot() {
  const a = document.createElement('a');
  a.href = renderer.capture();
  a.download = `firebrox-${state.seed}-${Date.now()}.png`;
  a.click();
  ui.flash('FRAME SAVED');
}

async function copyLaws() {
  const payload = serialize();
  const url = `${location.origin}${location.pathname}#${btoa(JSON.stringify(payload))}`;
  try {
    await navigator.clipboard.writeText(url);
    ui.flash('LINK COPIED');
  } catch {
    ui.flash('COPY FAILED');
  }
  history.replaceState(null, '', `#${btoa(JSON.stringify(payload))}`);
}

function fullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

function applyPalette(id) {
  state.palette = PALETTES[id] ? id : 'spectrum';
  const colors = PALETTES[state.palette].colors(sim.species);
  renderer.setPalette(colors);
}

function viewport() {
  const w = Math.max(1, Math.floor(window.innerWidth || document.documentElement.clientWidth || 1));
  const h = Math.max(1, Math.floor(window.innerHeight || document.documentElement.clientHeight || 1));
  return { w, h };
}

function layout() {
  const { w, h } = viewport();
  if (w < 2 || h < 2) return;
  if (w === renderer.cssW && h === renderer.cssH) return;
  sim.resize(w, h);
  renderer.resize(w, h);
}

function updateMouse(e, active) {
  sim.mouse.active = active && state.mouseMode !== 'off';
  sim.mouse.mode = state.mouseMode;
  sim.mouse.x = e.clientX;
  sim.mouse.y = e.clientY;
}

function beginMatrixDrag(cell, e) {
  const i = Number(cell.dataset.i);
  const j = Number(cell.dataset.j);
  const startY = e.clientY;
  const startV = sim.matrixAt(i, j);
  const onMove = (ev) => {
    const next = clamp(startV + (startY - ev.clientY) / 72, -1, 1);
    sim.setMatrixAt(i, j, next);
    state.presetId = 'custom';
    state.seed = hashMatrix(sim.getMatrix());
    refresh();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function snapshotState() {
  return {
    species: sim.species,
    count: sim.n,
    rMax: sim.rMax,
    force: sim.force,
    damp: sim.damp,
    beta: sim.beta,
    temp: sim.temp,
    wrap: sim.wrap,
    timeScale: state.timeScale,
    size: state.size,
    presetId: state.presetId,
    palette: state.palette,
    randMode: state.randMode,
    mouseMode: state.mouseMode,
    seed: state.seed,
    blurb: state.blurb,
    focus: state.focus,
    matrix: sim.getMatrix(),
    colors: PALETTES[state.palette].colors(sim.species),
    running: state.running,
  };
}

function refresh() {
  ui.sync(snapshotState());
}

function serialize() {
  return {
    s: sim.species,
    n: sim.n,
    r: +sim.rMax.toFixed(1),
    f: +sim.force.toFixed(1),
    d: +sim.damp.toFixed(2),
    b: +sim.beta.toFixed(2),
    t: +sim.temp.toFixed(1),
    w: sim.wrap ? 1 : 0,
    ts: +state.timeScale.toFixed(2),
    sz: +state.size.toFixed(2),
    p: state.palette,
    m: sim.getMatrix().flat().map((v) => +v.toFixed(3)),
    seed: state.seed,
  };
}

function applySerialized(data) {
  if (!data || !data.m) return false;
  sim.setSpecies(data.s || 4);
  sim.setCount(data.n || 4000);
  sim.rMax = data.r ?? 86;
  sim.force = data.f ?? 280;
  sim.damp = data.d ?? 4.2;
  sim.beta = data.b ?? 0.3;
  sim.temp = data.t ?? 0;
  sim.wrap = data.w !== 0;
  state.timeScale = data.ts ?? 1;
  state.size = data.sz ?? 3.4;
  renderer.size = state.size;
  applyPalette(data.p || 'spectrum');
  const s = sim.species;
  const matrix = [];
  for (let i = 0; i < s; i++) matrix.push(data.m.slice(i * s, (i + 1) * s));
  sim.setMatrix(matrix);
  state.presetId = 'custom';
  state.seed = data.seed || hashMatrix(sim.getMatrix());
  state.blurb = 'Restored universe.';
  refresh();
  return true;
}

function restoreFromHash() {
  if (!location.hash || location.hash.length < 8) return false;
  try {
    const data = JSON.parse(atob(location.hash.slice(1)));
    return applySerialized(data);
  } catch {
    return false;
  }
}

function persist() {
  try {
    localStorage.setItem('firebrox-v2', JSON.stringify(serialize()));
  } catch {
    /* ignore quota */
  }
}

function restoreSession() {
  try {
    const raw = localStorage.getItem('firebrox-v2');
    if (!raw) return false;
    return applySerialized(JSON.parse(raw));
  } catch {
    return false;
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
