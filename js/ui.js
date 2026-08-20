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
  fillSelect($('presetPanel'), [
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

  on($('wrap'), 'change', (e) => app.setWrap(e.target.checked));
  const onPreset = (e) => {
    if (e.target.value === 'custom') return;
    app.applyPreset(e.target.value);
  };
  on($('preset'), 'change', onPreset);
  on($('presetPanel'), 'change', onPreset);
  on($('palette'), 'change', (e) => app.setPalette(e.target.value));
  on($('randMode'), 'change', (e) => app.setRandMode(e.target.value));
  on($('mouseMode'), 'change', (e) => app.setMouseMode(e.target.value));

  on($('randomize'), 'click', () => app.randomize());
  on($('mutate'), 'click', () => app.mutate());
  on($('symmetrize'), 'click', () => app.symmetrize());
  on($('respawn'), 'click', () => app.respawn());
  on($('play'), 'click', () => app.togglePlay());
  on($('snapshot'), 'click', () => app.snapshot());
  on($('copyLaws'), 'click', () => app.copyLaws());
  on($('panelToggle'), 'click', () => togglePanel());
  on($('helpBtn'), 'click', () => toggleHelp(true));
  on($('helpClose'), 'click', () => toggleHelp(false));
  on($('helpModal'), 'click', (e) => {
    if (e.target.id === 'helpModal') toggleHelp(false);
  });
  on($('fullscreen'), 'click', () => app.fullscreen());
  on($('intro'), 'click', () => dismissIntro());

  on($('matrix'), 'pointerdown', (e) => {
    const cell = e.target.closest('.m-cell');
    if (!cell) return;
    e.preventDefault();
    app.beginMatrixDrag(cell, e);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, button')) return;
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
    else if (k === '?' || k === '/') {
      e.preventDefault();
      toggleHelp();
    } else if (k === 'escape') toggleHelp(false);
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
      const wrap = $('wrap');
      if (wrap) wrap.checked = state.wrap;
      setVal('preset', state.presetId);
      setVal('presetPanel', state.presetId);
      setVal('palette', state.palette);
      setVal('randMode', state.randMode);
      setVal('mouseMode', state.mouseMode);
      const play = $('play');
      if (play) {
        play.classList.toggle('paused', !state.running);
        play.setAttribute('aria-label', state.running ? 'Pause' : 'Play');
      }
      $('live')?.classList.toggle('off', !state.running);
      const seed = $('hudSeed');
      if (seed) seed.textContent = state.seed;
      const blurb = $('presetBlurb');
      if (blurb) blurb.textContent = state.blurb;
      renderMatrix(state);
      renderLegend(state, app);
    },
    tick(fps, count) {
      const fpsEl = $('fps');
      if (fpsEl) fpsEl.textContent = String(Math.round(fps));
      const countEl = $('hudCount');
      if (countEl) countEl.textContent = formatCount(count);
    },
    flash(text) {
      const el = $('toast');
      if (!el) return;
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

function on(el, ev, fn) {
  if (!el) return;
  el.addEventListener(ev, fn);
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

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
  el.innerHTML = items.map((it) => `<option value="${it.value}">${escapeHtml(it.label)}</option>`).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatCount(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

function renderMatrix(state) {
  const root = document.getElementById('matrix');
  if (!root) return;
  const s = state.species;
  const colors = state.colors || [];
  const matrix = state.matrix || [];
  const key = `${s}`;
  const expected = (s + 1) * (s + 1);
  if (root.dataset.s === key && root.childElementCount === expected) {
    const cells = root.querySelectorAll('.m-cell');
    for (const cell of cells) {
      const i = Number(cell.dataset.i);
      const j = Number(cell.dataset.j);
      const v = matrix[i] ? matrix[i][j] : 0;
      cell.style.background = cellColor(v);
      const span = cell.querySelector('span');
      if (span) span.textContent = fmt(v);
      cell.title = labelPair(i, j, v);
    }
    return;
  }
  root.dataset.s = key;
  root.style.setProperty('--n', String(s + 1));
  const parts = ['<div class="m-corner"></div>'];
  for (let j = 0; j < s; j++) {
    const c = colors[j] || [180, 180, 180];
    parts.push(
      `<div class="m-axis" title="from species ${j + 1}" style="background:rgb(${c})">${j + 1}</div>`,
    );
  }
  for (let i = 0; i < s; i++) {
    const c = colors[i] || [180, 180, 180];
    parts.push(
      `<div class="m-axis" title="species ${i + 1} feels" style="background:rgb(${c})">${i + 1}</div>`,
    );
    for (let j = 0; j < s; j++) {
      const v = matrix[i] ? matrix[i][j] : 0;
      const col = cellColor(v);
      parts.push(
        `<button type="button" class="m-cell" data-i="${i}" data-j="${j}" style="background:${col}" title="${labelPair(i, j, v)}"><span>${fmt(v)}</span></button>`,
      );
    }
  }
  root.innerHTML = parts.join('');
  const hint = document.getElementById('matrixHint');
  if (hint) hint.textContent = 'Row feels column. Drag a cell vertically to rewrite the law.';
}

function renderLegend(state, app) {
  const root = document.getElementById('legend');
  if (!root) return;
  const s = state.species;
  const n = state.count;
  const colors = state.colors || [];
  const parts = [];
  for (let i = 0; i < s; i++) {
    const active = state.focus === i ? ' active' : '';
    const share = Math.floor(n / s) + (i < n % s ? 1 : 0);
    const c = colors[i] || [180, 180, 180];
    parts.push(
      `<button type="button" class="legend-item${active}" data-i="${i}">
        <i style="background:rgb(${c})"></i>
        <span>S${i + 1}</span>
        <em>${share}</em>
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
  if (!el) return;
  const open = force === undefined ? !el.classList.contains('open') : force;
  el.classList.toggle('open', open);
  el.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function dismissIntro() {
  const el = document.getElementById('intro');
  if (el) el.classList.add('gone');
}
