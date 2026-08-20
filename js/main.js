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
    if (state.focus >= sim.species) state.focus = -1;
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
    state.focus = i >= sim.species ? -1 : i;
    renderer.focus = state.focus;
    refresh();
  },
  beginMatrixDrag,
});

try {
  applyPreset('genesis', { silent: true, preserveCount: false });
  restoreFromHash() || restoreSession();
  if (sim.n < 50) sim.setCount(4000);
  layout(true);
  sim.respawn();
  ui.openPanel();
  refresh();
} catch (err) {
  console.error('FIREBROX boot failed', err);
  try {
    sim.setCount(4000);
    applyPalette('spectrum');
    layout(true);
    sim.respawn();
  } catch {
    /* ignore */
  }
}

window.addEventListener('resize', () => layout());
window.visualViewport?.addEventListener('resize', () => layout());
if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => layout());
  ro.observe(document.documentElement);
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  updateMouse(e, true);
  if (state.mouseMode === 'spawn') sim.spawnAt(sim.mouse.x, sim.mouse.y, 14);
});
canvas.addEventListener('pointermove', (e) => {
  if (sim.mouse.active || e.buttons === 1) updateMouse(e, sim.mouse.active || e.buttons === 1);
  else {
    const p = mouseToWorld(e);
    sim.mouse.x = p.x;
    sim.mouse.y = p.y;
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
canvas.addEventListener('pointercancel', () => {
  sim.mouse.active = false;
});
canvas.addEventListener('pointerleave', () => {
  if (!sim.mouse.active) return;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  acc = 0;
});

let last = performance.now();
let acc = 0;
let fps = 60;
let frames = 0;
let fpsT = last;

function frame(now) {
  if (renderer.cssW < 32 || renderer.cssH < 32 || canvas.width < 32) layout(true);
  if (sim.n < 50) sim.setCount(4000);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
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
    if (acc > step * 3) acc = 0;
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
  state.focus = -1;
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
  const href = renderer.capture();
  if (!href) {
    ui.flash('SNAPSHOT FAILED');
    return;
  }
  const a = document.createElement('a');
  a.href = href;
  a.download = `firebrox-${state.seed}-${Date.now()}.png`;
  a.click();
  ui.flash('FRAME SAVED');
}

async function copyLaws() {
  const payload = serialize();
  const encoded = encodeURIComponent(btoa(JSON.stringify(payload)));
  const url = `${location.origin}${location.pathname}#${encoded}`;
  try {
    await navigator.clipboard.writeText(url);
    ui.flash('LINK COPIED');
  } catch {
    ui.flash('COPY FAILED');
  }
  try {
    history.replaceState(null, '', `#${encoded}`);
  } catch {
    /* ignore */
  }
}

function fullscreen() {
  const root = document.documentElement;
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  try {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) req?.call(root);
    else exit?.call(document);
  } catch {
    ui.flash('FULLSCREEN BLOCKED');
  }
}

function applyPalette(id) {
  state.palette = PALETTES[id] ? id : 'spectrum';
  const colors = PALETTES[state.palette].colors(sim.species);
  renderer.setPalette(colors);
}

let booted = false;

function viewport() {
  const cw = canvas.clientWidth || 0;
  const ch = canvas.clientHeight || 0;
  const w = Math.max(
    cw,
    window.innerWidth || 0,
    document.documentElement.clientWidth || 0,
    0,
  );
  const h = Math.max(
    ch,
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0,
    0,
  );
  if (w < 32 || h < 32) return { w: 960, h: 600, fake: true };
  return { w: Math.floor(w), h: Math.floor(h), fake: false };
}

function layout(force) {
  const { w, h, fake } = viewport();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!force && w === renderer.cssW && h === renderer.cssH && dpr === renderer.dpr) return;
  const wasTiny = sim.width < 32 || sim.height < 32;
  sim.resize(w, h);
  renderer.resize(w, h);
  if (!fake && (!booted || wasTiny)) {
    booted = true;
    sim.respawn();
  }
}

function mouseToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  const rw = rect.width || 1;
  const rh = rect.height || 1;
  return {
    x: ((e.clientX - rect.left) / rw) * sim.width,
    y: ((e.clientY - rect.top) / rh) * sim.height,
  };
}

function updateMouse(e, active) {
  const p = mouseToWorld(e);
  sim.mouse.active = active && state.mouseMode !== 'off';
  sim.mouse.mode = state.mouseMode;
  sim.mouse.x = p.x;
  sim.mouse.y = p.y;
}

function beginMatrixDrag(cell, e) {
  const i = Number(cell.dataset.i);
  const j = Number(cell.dataset.j);
  if (!Number.isFinite(i) || !Number.isFinite(j)) return;
  const startY = e.clientY;
  const startV = sim.matrixAt(i, j);
  try {
    cell.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  const paint = (value) => {
    sim.setMatrixAt(i, j, value);
    cell.style.background = cellColor(value);
    const label = cell.querySelector('span');
    if (label) label.textContent = fmt(value);
    cell.title = `S${i + 1} ← S${j + 1}  ${fmt(value)}`;
  };
  const onMove = (ev) => {
    paint(clamp(startV + (startY - ev.clientY) / 72, -1, 1));
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    state.presetId = 'custom';
    state.seed = hashMatrix(sim.getMatrix());
    refresh();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

function cellColor(v) {
  if (v >= 0) {
    const t = v;
    return `rgb(${(18 + (32 - 18) * t) | 0}, ${(22 + (255 - 22) * t) | 0}, ${(28 + (176 - 28) * t) | 0})`;
  }
  const t = -v;
  return `rgb(${(18 + (255 - 18) * t) | 0}, ${(22 + (48 - 22) * t) | 0}, ${(28 + (90 - 28) * t) | 0})`;
}

function fmt(v) {
  const x = Math.abs(v) < 0.005 ? 0 : v;
  return (x >= 0 ? '+' : '') + x.toFixed(2);
}

function snapshotState() {
  if (state.focus >= sim.species) state.focus = -1;
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
  if (!data || !Array.isArray(data.m)) return false;
  sim.setSpecies(data.s || 4);
  sim.setCount(data.n || 4000);
  sim.rMax = data.r ?? 80;
  sim.force = data.f ?? 320;
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
  for (let i = 0; i < s; i++) {
    const row = data.m.slice(i * s, (i + 1) * s);
    while (row.length < s) row.push(0);
    matrix.push(row);
  }
  sim.setMatrix(matrix);
  state.presetId = 'custom';
  state.seed = data.seed || hashMatrix(sim.getMatrix());
  state.blurb = 'Restored universe.';
  state.focus = -1;
  refresh();
  return true;
}

function restoreFromHash() {
  if (!location.hash || location.hash.length < 8) return false;
  try {
    const raw = decodeURIComponent(location.hash.slice(1));
    const data = JSON.parse(atob(raw));
    return applySerialized(data);
  } catch {
    try {
      return applySerialized(JSON.parse(atob(location.hash.slice(1))));
    } catch {
      return false;
    }
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
