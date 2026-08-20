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
function fakeGL() {
  const handler = {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'VERSION') return 'VERSION_STR';
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...a) => {
        if (k === 'getParameter') return typeof a[0] === 'string' ? 'WebGL 2.0' : 8;
        if (k === 'getShaderPrecisionFormat') return { precision: 23, rangeMin: 127, rangeMax: 127 };
        if (k === 'getExtension') return new Proxy({}, handler);
        if (k === 'getSupportedExtensions') return [];
        if (['createShader', 'createProgram', 'createTexture', 'createBuffer',
             'createFramebuffer', 'createVertexArray', 'createRenderbuffer'].includes(k)) return {};
        if (k === 'getShaderParameter' || k === 'getProgramParameter') return true;
        if (k === 'getProgramInfoLog' || k === 'getShaderInfoLog') return '';
        if (k === 'getUniformLocation') return {};
        if (k === 'getActiveUniform' || k === 'getActiveAttrib') return { name: 'x', type: 1, size: 1 };
        if (k === 'getContextAttributes') return { alpha: true, antialias: true, depth: true, stencil: false };
        return undefined;
      };
    },
  };
  return new Proxy({ canvas: {}, drawingBufferWidth: 1280, drawingBufferHeight: 720 }, handler);
}
window.HTMLCanvasElement.prototype.getContext = function (kind) {
  if (kind === '2d') { this.__ctx = this.__ctx || fakeCtx(this); return this.__ctx; }
  this.__gl = this.__gl || fakeGL();
  return this.__gl;
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
// virtual clock so the real game loop sees believable frame times
globalThis.__clock = 0;
globalThis.performance = { now: () => globalThis.__clock, timeOrigin: 0 };
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


// ---- boot the real entry point through a stubbed WebGL context -------
const rafs = [];
globalThis.requestAnimationFrame = (cb) => { rafs.push(cb); return rafs.length; };

await import(ROOT + '/src/main.js');
console.log('main.js booted · fatal overlay hidden:', document.getElementById('fatal').classList.contains('hidden'));
document.getElementById('btn-new').click();
await new Promise((r) => setTimeout(r, 500));
const G = window.FIREBROX;
console.log('running:', G.game.running, '· mode:', G.game.mode, '· system:', G.game.system?.name);

function frames(n) {
  for (let i = 0; i < n; i++) {
    globalThis.__clock += 16.7;
    const cbs = rafs.splice(0, rafs.length);
    for (const cb of cbs) cb(performance.now());
  }
}
frames(120);
console.log('after 120 real frames — ship at', G.game.space.ship.position.toArray().map(Math.round));

// open every overlay through real key handlers
const key = (code) => window.dispatchEvent(new window.KeyboardEvent('keydown', { code, bubbles: true }));
key('KeyC'); frames(5);
console.log('refiner open:', !document.getElementById('craft').classList.contains('hidden'),
  '· recipes:', document.querySelectorAll('#craft-list .recipe').length);
key('Escape'); frames(5);
key('KeyM'); frames(5);
console.log('galaxy map open:', !document.getElementById('map').classList.contains('hidden'));
key('KeyG'); frames(5);
console.log('intergalactic view:', G.game.map.view);
key('KeyG'); frames(5);
key('KeyM'); frames(5);
key('Tab'); frames(5);
console.log('pause/log open:', !document.getElementById('pause').classList.contains('hidden'));
document.getElementById('btn-settings').click(); frames(5);
console.log('settings open:', !document.getElementById('settings').classList.contains('hidden'));
document.getElementById('btn-settings-close').click();
key('Tab'); frames(5);
key('KeyH'); frames(2);
console.log('photo mode hides HUD:', document.getElementById('hud').classList.contains('hidden'));
key('KeyH'); frames(2);

// land on a planet the way a player does: fly close, hold E
const { input } = await import(ROOT + '/src/input.js');
input.locked = true;
const holder = G.game.space.planets[0];
const pl = holder.userData.planet;
G.game.space.ship.position.copy(holder.position).add({ x: 0, y: 0, z: pl.radius * 1.15 });
G.game.space.throttle = 0;
G.game.space.speed = 0;
input.keys.add('KeyE');
frames(90);
input.keys.delete('KeyE');
await new Promise((r) => setTimeout(r, 800));
frames(90);
console.log('mode after landing:', G.game.mode, '· planet:', G.game.surface.planet?.name,
  '· chunks:', G.game.surface.chunks.size);

// build mode through the real key handler
key('KeyB'); frames(5);
console.log('build mode on:', G.game.surface.buildMode,
  '· build hud visible:', !document.getElementById('build-hud').classList.contains('hidden'),
  '· part:', document.querySelector('#build-part b')?.textContent);
key('BracketRight'); frames(3);
console.log('cycled part ->', document.querySelector('#build-part b')?.textContent);
G.state.inventory.ferrite = 900; G.state.inventory.carbon = 900; G.state.inventory.chromatic = 300;
G.state.inventory.platinum = 300; G.state.inventory.sodium = 300;
input.mouseDown = true; frames(30); input.mouseDown = false; frames(5);
console.log('parts placed:', G.game.surface.baseParts.length,
  '· base saved:', Object.keys(G.state.bases).length ? 'yes' : 'no');
key('KeyB'); frames(3);
console.log('build mode off:', !G.game.surface.buildMode);

// terrain manipulator
const spot0 = G.game.surface.buildSpot();
const h0 = G.game.surface.height(spot0.x, spot0.z);
input.keys.add('KeyZ'); frames(40); input.keys.delete('KeyZ'); frames(3);
console.log('terrain edited:', (G.game.surface.height(spot0.x, spot0.z) - h0).toFixed(1), 'm');

// exocraft summon + board
G.state.exocraftOwned = true;
key('KeyV'); frames(5);
console.log('exocraft spawned:', !!G.game.surface.exocraft);
input.keys.add('KeyF'); frames(4); input.keys.delete('KeyF'); frames(2);
console.log('boarded exocraft:', G.game.surface.inExocraft);
input.keys.add('KeyW'); frames(90); input.keys.delete('KeyW');
console.log('exocraft moving:', G.game.surface.exoVel.length().toFixed(1), 'm/s');
input.keys.add('KeyF'); frames(4); input.keys.delete('KeyF'); frames(2);
console.log('left exocraft:', !G.game.surface.inExocraft);
input.keys.add('KeyE');
G.game.surface.pos.copy(G.game.surface.ship.position).add({ x: 2, y: 2, z: 2 });
frames(30);
input.keys.delete('KeyE');
await new Promise((r) => setTimeout(r, 800));
frames(60);
console.log('mode after launch:', G.game.mode);
console.log('ERRORS:', errors.length ? errors.slice(0, 4) : 'none');
process.exit(errors.length ? 1 : 0);
