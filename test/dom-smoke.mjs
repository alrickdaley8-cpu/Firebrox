// DOM smoke test: boot the real UI under a stub DOM/canvas and simulate
// ~24s of gameplay. Runs BOTH builds:
//   1. the modular dev build (dev.html → js/main.js)
//   2. the shippable single-file bundle (index.html, inline <script>)
import { readFile } from 'node:fs/promises';

let failures = 0;
const assert = (c, m) => { if (!c) { failures++; console.error(`  ❌ ${m}`); } };

// ---------- per-suite stub environment ----------
function installStubs() {
  const gradient = new Proxy({}, { get: () => () => gradient });
  const els = new Map();
  const env = { els, rafCb: null };

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
  globalThis.requestAnimationFrame = (cb) => { env.rafCb = cb; };
  return env;
}

const fire = (env, id, type) =>
  (env.els.get(id)._on[type] || []).forEach((f) => f({ preventDefault() {} }));

async function runSuite(label, boot) {
  const env = installStubs();
  await boot();
  fire(env, 'playBtn', 'click'); // start the battle

  let now = 0;
  const step = 1000 / 60;
  let frames = 0;
  for (let i = 0; i < 60 * 24; i++) { // ~24 game-seconds
    now += step;
    const cb = env.rafCb; env.rafCb = null;
    assert(cb, `[${label}] rAF chain alive @frame ${i}`);
    if (!cb) break;
    cb(now);
    frames++;
  }

  const $ = (id) => env.els.get(id);
  assert(frames >= 60 * 20, `[${label}] loop advanced (${frames} frames)`);
  assert($('cardsRow').children.length === 5, `[${label}] 4 cards + next card rendered`);
  assert($('timer').textContent !== '3:00', `[${label}] timer ticked (${$('timer').textContent})`);
  assert(parseInt($('elixirCount').textContent, 10) >= 0, `[${label}] elixir counter sane`);
  console.log(`✓ [${label}] booted, clicked PLAY, ran ${frames} frames — timer shows ${$('timer').textContent}`);
}

// 1) modular dev build
await runSuite('modules', () => import('../js/main.js'));

// 2) single-file bundle — execute the actual shipped <script>
await runSuite('bundle', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert(!html.includes('src="js/'), 'bundle has no external script refs');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert(m, 'bundle contains an inline script');
  new Function(m[1])(); // executes like a classic browser script
});

if (failures) { console.error(`\n💥 ${failures} failure(s)`); process.exit(1); }
console.log('✅ DOM smoke test passed (modules + single-file bundle)');
