import {
  PRESETS,
  PALETTES,
  RAND_MODES,
  randomizeMatrix,
  mutateMatrix,
  symmetrizeMatrix,
  hashMatrix,
  mulberry32,
} from './presets.js';

export function mountUI(app) {
  const $ = (id) => document.getElementById(id);
  fillSelect($('preset'), [
    ...PRESETS.map((p) => ({ value: p.id, label: p.name })),
    { value: 'custom', label: 'Custom' },
  ]);
  fillSelect(
    $('palette'),
    Object.entries(PALETTES).map(([id, p]) => ({ value: id, label: p.name })),
  );
  fillSelect(
    $('randMode'),
    RAND_MODES.map((m) => ({ value: m.id, label: m.name })),
  );
  fillSelect($('mouseMode'), [
    { value: 'attract', label: 'Attract' },
    { value: 'repel', label: 'Repel' },
    { value: 'spawn', label: 'Spawn' },
    { value: 'off', label: 'Off' },
  ]);

  bindSlider('species', (v) => app.setSpecies(v));
  bindSlider('count', (v) => app.setCount(v));
  bindSlider('radius', (v) => app.setRadius(v));
  bindSlider('force', (v) => app.setForce(v));
  bindSlider('damp', (v) => app.setDamp(v));
  bindSlider('collision', (v) => app.setCollision(v));
  bindSlider('temp', (v) => app.setTemp(v));
  bindSlider('time', (v) => app.setTime(v));
  bindSlider('size', (v) => app.setSize(v));

  $('wrap').addEventListener('change', (e) => app.setWrap(e.target.checked));
  $('preset').addEventListener('change', (e) => {
    if (e.target.value === 'custom') return;
    app.applyPreset(e.target.value);
  });
  $('palette').addEventListener('change', (e) => app.setPalette(e.target.value));
  $('randMode').addEventListener('change', (e) => app.setRandMode(e.target.value));
  $('mouseMode').addEventListener('change', (e) => app.setMouseMode(e.target.value));

  $('randomize').addEventListener('click', () => app.randomize());
  $('mutate').addEventListener('click', () => app.mutate());
  $('symmetrize').addEventListener('click', () => app.symmetrize());
  $('respawn').addEventListener('click', () => app.respawn());
  $('play').addEventListener('click', () => app.togglePlay());
  $('snapshot').addEventListener('click', () => app.snapshot());
  $('copyLaws').addEventListener('click', () => app.copyLaws());
  $('panelToggle').addEventListener('click', () => togglePanel());
  $('helpBtn').addEventListener('click', () => toggleHelp(true));
  $('helpClose').addEventListener('click', () => toggleHelp(false));
  $('helpModal').addEventListener('click', (e) => {
    if (e.target.id === 'helpModal') toggleHelp(false);
  });
  $('fullscreen').addEventListener('click', () => app.fullscreen());
  const intro = $('intro');
  if (intro) intro.addEventListener('click', () => dismissIntro());

  $('matrix').addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.m-cell');
    if (!cell) return;
    e.preventDefault();
    app.beginMatrixDrag(cell, e);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      app.togglePlay();
    } else if (k === 'r') app.randomize();
    else if (k === 'g') app.respawn();
    else if (k === 'm') app.mutate();
    else if (k === 'h') togglePanel();
    else if (k === 'f') app.fullscreen();
    else if (k === 's') app.snapshot();
    else if (k === '?' || k === '/') toggleHelp();
    else if (k === 'escape') toggleHelp(false);
    else if (k >= '1' && k <= '9') {
      const preset = PRESETS[Number(k) - 1];
      if (preset) app.applyPreset(preset.id);
    }
  });

  dismissIntro();

  return {
    sync(state) {
      setSlider('species', state.species, String(state.species));
      setSlider('count', state.count, formatCount(state.count));
      setSlider('radius', state.rMax, `${Math.round(state.rMax)}`);
      setSlider('force', state.force, state.force.toFixed(0));
      setSlider('damp', state.damp, state.damp.toFixed(1));
      setSlider('collision', state.beta, state.beta.toFixed(2));
      setSlider('temp', state.temp, state.temp.toFixed(0));
      setSlider('time', state.timeScale, `${state.timeScale.toFixed(2)}×`);
      setSlider('size', state.size, state.size.toFixed(1));
      $('wrap').checked = state.wrap;
      $('preset').value = state.presetId;
      $('palette').value = state.palette;
      $('randMode').value = state.randMode;
      $('mouseMode').value = state.mouseMode;
      $('play').classList.toggle('paused', !state.running);
      $('play').setAttribute('aria-label', state.running ? 'Pause' : 'Play');
      $('live').classList.toggle('off', !state.running);
      $('hudSeed').textContent = state.seed;
      $('presetBlurb').textContent = state.blurb;
      renderMatrix(state);
      renderLegend(state, app);
    },
    tick(fps, count) {
      $('fps').textContent = String(Math.round(fps));
      $('hudCount').textContent = formatCount(count);
    },
    flash(text) {
      const el = $('toast');
      el.textContent = text;
      el.classList.add('show');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('show'), 1600);
    },
    openPanel: () => {
      if (window.innerWidth > 860) document.body.classList.add('panel-open');
    },
  };
}

export { PRESETS, PALETTES, RAND_MODES, randomizeMatrix, mutateMatrix, symmetrizeMatrix, hashMatrix, mulberry32 };

function bindSlider(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => fn(Number(el.value)));
}

function setSlider(id, value, label) {
  const el = document.getElementById(id);
  if (!el) return;
  if (document.activeElement !== el) el.value = String(value);
  const out = document.getElementById(`${id}Val`);
  if (out) out.textContent = label;
}

function fillSelect(el, items) {
  if (!el) return;
  el.innerHTML = items.map((it) => `<option value="${it.value}">${it.label}</option>`).join('');
}

function formatCount(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

function renderMatrix(state) {
  const root = document.getElementById('matrix');
  const s = state.species;
  const colors = state.colors;
  const matrix = state.matrix;
  root.style.setProperty('--n', String(s + 1));
  const parts = ['<div class="m-corner"></div>'];
  for (let j = 0; j < s; j++) {
    parts.push(
      `<div class="m-axis" title="from species ${j + 1}" style="background:rgb(${colors[j]})">${j + 1}</div>`,
    );
  }
  for (let i = 0; i < s; i++) {
    parts.push(
      `<div class="m-axis" title="species ${i + 1} feels" style="background:rgb(${colors[i]})">${i + 1}</div>`,
    );
    for (let j = 0; j < s; j++) {
      const v = matrix[i][j];
      const col = cellColor(v);
      parts.push(
        `<button type="button" class="m-cell" data-i="${i}" data-j="${j}" style="background:${col}" title="${labelPair(i, j, v)}"><span>${fmt(v)}</span></button>`,
      );
    }
  }
  root.innerHTML = parts.join('');
  const hint = document.getElementById('matrixHint');
  hint.textContent = 'Row feels column. Drag a cell vertically to rewrite the law.';
}

function renderLegend(state, app) {
  const root = document.getElementById('legend');
  const s = state.species;
  const n = state.count;
  const colors = state.colors;
  const parts = [];
  for (let i = 0; i < s; i++) {
    const active = state.focus === i ? ' active' : '';
    parts.push(
      `<button type="button" class="legend-item${active}" data-i="${i}">
        <i style="background:rgb(${colors[i]})"></i>
        <span>S${i + 1}</span>
        <em>${Math.ceil(n / s)}</em>
      </button>`,
    );
  }
  root.innerHTML = parts.join('');
  root.onclick = (e) => {
    const btn = e.target.closest('.legend-item');
    if (!btn) return;
    const i = Number(btn.dataset.i);
    app.setFocus(state.focus === i ? -1 : i);
  };
}

function cellColor(v) {
  if (v >= 0) {
    const t = v;
    const r = 18 + (32 - 18) * t;
    const g = 22 + (255 - 22) * t;
    const b = 28 + (176 - 28) * t;
    return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
  }
  const t = -v;
  const r = 18 + (255 - 18) * t;
  const g = 22 + (48 - 22) * t;
  const b = 28 + (90 - 28) * t;
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

function fmt(v) {
  const x = Math.abs(v) < 0.005 ? 0 : v;
  return (x >= 0 ? '+' : '') + x.toFixed(2);
}

function labelPair(i, j, v) {
  const mood = v > 0.05 ? 'attract' : v < -0.05 ? 'repel' : 'ignore';
  return `S${i + 1} ← S${j + 1}  ${fmt(v)}  (${mood})`;
}

function togglePanel() {
  document.body.classList.toggle('panel-open');
}

function toggleHelp(force) {
  const el = document.getElementById('helpModal');
  const open = force === undefined ? !el.classList.contains('open') : force;
  el.classList.toggle('open', open);
  el.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function dismissIntro() {
  document.getElementById('intro').classList.add('gone');
}
