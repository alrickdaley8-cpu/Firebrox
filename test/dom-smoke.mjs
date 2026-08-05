// DOM smoke test: boot the real UI (main.js + render.js) under a stub DOM/canvas
// and simulate ~24s of gameplay. Catches browser-path runtime errors Node can't
// see via `node --check` alone. Zero dependencies.

// ---------- stubs ----------
const gradient = new Proxy({}, { get: () => () => gradient });
const ctx2d = new Proxy({}, {
  get: (t, p) => (p === 'canvas' ? els.get('game') : (...a) => gradient),
  set: () => true,
});

function makeEl(tag = 'div') {
  const cls = new Set();
  const el = {
    tag, children: [], dataset: {}, style: {}, _on: {},
    classList: {
      add: (...c) => c.forEach((k) => cls.add(k)),
      remove: (...c) => c.forEach((k) => cls.delete(k)),
      toggle: (c, force) => (force === undefined ? (cls.has(c) ? cls.delete(c) : cls.add(c)) : (force ? cls.add(c) : cls.delete(c))),
      contains: (c) => cls.has(c),
    },
    set innerHTML(v) { el.children = []; el._html = v; },
    get innerHTML() { return el._html || ''; },
    appendChild(c) { c._parent = el; el.children.push(c); return c; },
    insertBefore(c) { c._parent = el; el.children.push(c); return c; },
    remove() {
      if (el._parent) {
        const i = el._parent.children.indexOf(el);
        if (i >= 0) el._parent.children.splice(i, 1);
        el._parent = null;
      }
    },
    addEventListener(t, f) { (el._on[t] ||= []).push(f); },
    setAttribute() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 533, right: 300, bottom: 533 }),
    closest: () => null,
    offsetWidth: 300, offsetHeight: 533,
    textContent: '',
    className: '',
  };
  return el;
}

const els = new Map();
globalThis.document = {
  getElementById(id) {
    if (!els.has(id)) {
      const el = makeEl(id === 'game' ? 'canvas' : 'div');
      if (id === 'game') el.getContext = () => ctx2d;
      els.set(id, el);
    }
    return els.get(id);
  },
  createElement: (tag) => makeEl(tag),
};
globalThis.window = {
  addEventListener() {}, innerWidth: 400, innerHeight: 800, devicePixelRatio: 2,
  AudioContext: undefined, webkitAudioContext: undefined,
};

let rafCb = null;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };

// ---------- boot the real game ----------
await import('../js/main.js');

const fire = (id, type) => (document.getElementById(id)._on[type] || []).forEach((f) => f({ preventDefault() {} }));

let failures = 0;
const assert = (c, m) => { if (!c) { failures++; console.error(`  ❌ ${m}`); } };

fire('playBtn', 'click'); // start the battle

let now = 0;
const step = 1000 / 60;
const engine = await import('../js/engine.js');
let sawUnits = 0, sawProjectiles = 0, frames = 0;

for (let i = 0; i < 60 * 24; i++) { // ~24 game-seconds
  now += step;
  const cb = rafCb; rafCb = null;
  assert(cb, `rAF chain alive @frame ${i}`);
  if (!cb) break;
  cb(now);
  frames++;
}

// peek at the game through the module (main.js keeps its own ref; read engine state via a fresh probe is
// impossible — instead verify the loop ran and DOM stayed coherent)
assert(frames >= 60 * 20, `loop advanced (${frames} frames)`);
assert(document.getElementById('cardsRow').children.length === 5, '4 cards + next card rendered');
assert(document.getElementById('timer').textContent !== '3:00', `timer ticked (${document.getElementById('timer').textContent})`);
assert(parseInt(document.getElementById('elixirCount').textContent, 10) >= 0, 'elixir counter sane');
console.log(`✓ booted, clicked PLAY, ran ${frames} frames — timer shows ${document.getElementById('timer').textContent}`);

if (failures) { console.error(`\n💥 ${failures} failure(s)`); process.exit(1); }
console.log('✅ DOM smoke test passed');
