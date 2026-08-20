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
// Simulate a preview iframe WITHOUT allow="pointer-lock": the request always fails.
window.HTMLCanvasElement.prototype.requestPointerLock = function () {
  setTimeout(() => {
    const ev = new window.Event('pointerlockerror');
    window.document.dispatchEvent(ev);
  }, 0);
};
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
window.focus = () => {};
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

// cockpit view through the real key handler
const { input } = await import(ROOT + '/src/input.js');
key('KeyT'); frames(4);
console.log('cockpit view in space:', G.game.space.cockpitView);
key('KeyT'); frames(4);

// seamless entry: fly at the planet, no keypress needed
const holder = G.game.space.planets[0];
const pl = holder.userData.planet;
G.game.space.transitCooldown = 0;
G.game.space.ship.position.copy(holder.position).add({ x: 0, y: 0, z: pl.radius * 1.04 });
G.game.space.throttle = 0;
G.game.space.speed = 0;
frames(120);
console.log('mode after entry:', G.game.mode, '· planet:', G.game.surface.planet?.name,
  '· piloting:', G.game.surface.piloting, '· chunks:', G.game.surface.chunks.size);
key('KeyT'); frames(4);
console.log('cockpit view in atmosphere:', G.game.surface.cockpitView,
  '· dash screens drawn:', G.game.surface.cockpit.userData.screens.length);
key('KeyT'); frames(4);

// fly down and land the ship
input.keys.add('ControlLeft');
for (let i = 0; i < 40 && G.game.surface.piloting; i++) {
  frames(30);
  const alt = G.game.surface.ship.position.y - G.game.surface.height(G.game.surface.ship.position.x, G.game.surface.ship.position.z);
  if (alt < 2.5) break;
}
input.keys.delete('ControlLeft');
frames(30);
const landedAlt = G.game.surface.ship.position.y - G.game.surface.height(G.game.surface.ship.position.x, G.game.surface.ship.position.z);
console.log('ship set down at', landedAlt.toFixed(1), 'm');
input.keys.add('KeyF'); frames(6); input.keys.delete('KeyF'); frames(4);
console.log('disembarked and on foot:', !G.game.surface.piloting);

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
// board and fly back to orbit
G.game.surface.pos.copy(G.game.surface.ship.position).add({ x: 2, y: 2, z: 2 });
input.keys.add('KeyE'); frames(10); input.keys.delete('KeyE'); frames(4);
console.log('re-boarded the ship:', G.game.surface.piloting);
input.keys.add('Space'); input.keys.add('KeyW');
for (let i = 0; i < 80 && G.game.mode === 'surface'; i++) frames(30);
input.keys.delete('Space'); input.keys.delete('KeyW');
frames(20);
console.log('mode after launch:', G.game.mode);
// ---- FULL CONTROL AUDIT ----------------------------------------------
console.log('\n=== CONTROL AUDIT ===');
const results = [];
const chk = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? ' ok ' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const S = () => G.game.surface;
const SP = () => G.game.space;
const hold = (code, n = 20) => { input.keys.add(code); frames(n); input.keys.delete(code); frames(2); };

// --- make sure we start in space, unblocked, pointer locked
if (G.game.mode !== 'space') { S().exitRequest = { lat: 0.1, lon: 0.1 }; frames(6); }
// engage the way a player does: click the canvas
document.getElementById('scene').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
document.getElementById('scene').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true, button: 0 }));
await new Promise((r) => setTimeout(r, 400));
frames(10);
console.log(`input mode: ${input.mode()} · pointer lock blocked: ${input.pointerLockBlocked} · enabled: ${input.enabled}`);
chk('input: game is playable without pointer lock', input.active && input.enabled);
{
  // free-look must steer from ordinary mousemove events (no pointer lock involved)
  const q0 = G.game.space.ship.quaternion.clone();
  for (let i = 0; i < 12; i++) {
    const ev = new window.MouseEvent('mousemove');
    Object.defineProperty(ev, 'movementX', { value: 14 });
    Object.defineProperty(ev, 'movementY', { value: 5 });
    document.dispatchEvent(ev);
    frames(1);
  }
  chk('input: free-look mouse steers the ship', G.game.space.ship.quaternion.angleTo(q0) > 0.005,
    `${G.game.space.ship.quaternion.angleTo(q0).toFixed(3)} rad`);
}
{
  // arrow keys are the keyboard fallback for looking
  const q0 = G.game.space.ship.quaternion.clone();
  hold('ArrowLeft', 20);
  chk('input: arrow keys look around', G.game.space.ship.quaternion.angleTo(q0) > 0.005);
}
{
  // buttons must register without pointer lock
  const scene = document.getElementById('scene');
  scene.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 2 }));
  frames(2);
  const gotRight = input.mouseRight === true;
  window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true, button: 2 }));
  frames(2);
  chk('input: right mouse registers without pointer lock', gotRight && input.mouseRight === false);
}

// SPACE MODE
{
  SP().throttle = 0; SP().speed = 0;
  const before = SP().throttle;
  hold('KeyW', 30);
  chk('space: W throttles up', SP().throttle > before, `throttle ${SP().throttle.toFixed(2)}`);
  hold('KeyS', 40);
  chk('space: S throttles down', SP().throttle < 0.2, `throttle ${SP().throttle.toFixed(2)}`);

  const q0 = SP().ship.quaternion.clone();
  hold('KeyA', 20);
  chk('space: A rolls the ship', SP().ship.quaternion.angleTo(q0) > 0.01);
  const q1 = SP().ship.quaternion.clone();
  hold('KeyD', 20);
  chk('space: D rolls the other way', SP().ship.quaternion.angleTo(q1) > 0.01);

  SP().throttle = 1; frames(20);
  const spd0 = SP().speed;
  hold('ShiftLeft', 40);
  chk('space: Shift boosts', SP().speed > spd0, `${Math.round(spd0)} -> ${Math.round(SP().speed)} u/s`);
  SP().throttle = 0; SP().speed = 0; frames(10);

  const bolts0 = SP().bolts.length;
  input.mouseDown = true; frames(20); input.mouseDown = false;
  chk('space: LMB fires cannons', SP().bolts.length > bolts0, `${SP().bolts.length} bolts in flight`);

  key('KeyT'); frames(4);
  chk('space: T enters cockpit', SP().cockpitView === true);
  key('KeyT'); frames(4);
  chk('space: T leaves cockpit', SP().cockpitView === false);

  key('KeyM'); frames(4);
  chk('space: M opens the galaxy map', G.game.map.open === true);
  const rot0 = G.game.map.rot;
  hold('KeyQ', 12);
  chk('map: Q rotates', Math.abs(G.game.map.rot - rot0) > 0.001);
  const rot1 = G.game.map.rot;
  hold('KeyE', 12);
  chk('map: E rotates the other way', Math.abs(G.game.map.rot - rot1) > 0.001);
  key('KeyG'); frames(3);
  chk('map: G switches to the intergalactic view', G.game.map.view === 'intergalactic');
  key('KeyG'); frames(3);
  key('Escape'); frames(3);
  chk('map: Esc closes it and restores control', !G.game.map.open && input.active);

  key('KeyC'); frames(3);
  chk('any: C opens the refiner', !document.getElementById('craft').classList.contains('hidden'));
  key('Escape'); frames(3);
  chk('refiner: Esc closes it', document.getElementById('craft').classList.contains('hidden'));

  key('F1'); frames(3);
  chk('any: F1 opens the control list',
    !document.getElementById('controls-overlay').classList.contains('hidden'),
    document.querySelectorAll('#controls-list .ctrl-row').length + ' bindings listed');
  key('Escape'); frames(3);
  chk('controls: Esc closes it', document.getElementById('controls-overlay').classList.contains('hidden'));

  key('Tab'); frames(3);
  chk('any: Tab opens the journey log', !document.getElementById('pause').classList.contains('hidden'));
  key('Tab'); frames(3);
  chk('any: Tab closes it again', document.getElementById('pause').classList.contains('hidden'));

  key('KeyH'); frames(3);
  chk('any: H hides the HUD for photo mode', document.getElementById('hud').classList.contains('hidden'));
  key('KeyH'); frames(3);
  chk('any: H restores the HUD', !document.getElementById('hud').classList.contains('hidden'));

  const exp0 = G.renderer.toneMappingExposure;
  key('KeyP'); frames(2);
  chk('any: P changes exposure', G.renderer.toneMappingExposure !== exp0);
  key('KeyP'); frames(2);

  key('KeyB'); frames(2);
  chk('space: B refuses to build in orbit', S().buildMode === false);
}

// ATMOSPHERIC FLIGHT
{
  const holder2 = SP().planets[0];
  const pl2 = holder2.userData.planet;
  SP().transitCooldown = 0;
  SP().ship.position.copy(holder2.position).add({ x: 0, y: 0, z: pl2.radius * 1.04 });
  SP().throttle = 0; SP().speed = 0;
  frames(120);
  chk('space: flying at a planet enters the atmosphere', G.game.mode === 'surface' && S().piloting);

  const alt = () => S().ship.position.y - S().height(S().ship.position.x, S().ship.position.z);
  const a0 = alt();
  hold('Space', 40);
  chk('flight: Space climbs', alt() > a0, `${Math.round(a0)} -> ${Math.round(alt())} m`);
  const a1 = alt();
  hold('ControlLeft', 40);
  chk('flight: Ctrl descends', alt() < a1, `${Math.round(a1)} -> ${Math.round(alt())} m`);

  const sp0 = S().shipSpeed;
  hold('KeyW', 30);
  chk('flight: W accelerates', S().shipSpeed > sp0, `${Math.round(S().shipSpeed)} m/s`);
  hold('KeyS', 40);
  chk('flight: S brakes', S().shipSpeed < 60, `${Math.round(S().shipSpeed)} m/s`);

  key('KeyT'); frames(3);
  chk('flight: T enters the cockpit', S().cockpitView === true);
  key('KeyT'); frames(3);

  key('KeyV'); frames(3);
  chk('flight: V refuses to drop the Exocraft mid-flight', !S().exocraft);

  // set down
  input.keys.add('ControlLeft');
  for (let i = 0; i < 60 && alt() > 2.5; i++) frames(20);
  input.keys.delete('ControlLeft');
  frames(20);
  hold('KeyF', 8);
  chk('flight: F disembarks after landing', !S().piloting, `altitude ${alt().toFixed(1)} m`);
}

// ON FOOT
{
  const p0 = S().pos.clone();
  hold('KeyW', 30);
  chk('foot: W walks forward', S().pos.distanceTo(p0) > 1, `${S().pos.distanceTo(p0).toFixed(1)} m`);
  const p1 = S().pos.clone();
  hold('KeyD', 30);
  chk('foot: D strafes', S().pos.distanceTo(p1) > 0.5);
  const p2 = S().pos.clone();
  hold('ShiftLeft', 1);
  input.keys.add('KeyW'); input.keys.add('ShiftLeft'); frames(30);
  input.keys.delete('KeyW'); input.keys.delete('ShiftLeft');
  chk('foot: Shift sprints', S().pos.distanceTo(p2) > 4, `${S().pos.distanceTo(p2).toFixed(1)} m`);

  S().grounded = true;
  const jet0 = G.state.jetpack;
  hold('Space', 40);
  chk('foot: Space jumps and burns jetpack', G.state.jetpack < jet0 || S().vel.y !== 0);

  const bolts0 = S().bolts.length;
  input.mouseRight = true; frames(20); input.mouseRight = false;
  chk('foot: RMB fires the boltcaster', S().bolts.length > bolts0, `${S().bolts.length} bolts`);

  G.state.hazardProtection = 20; G.state.inventory.sodium = 200;
  hold('KeyR', 6);
  chk('foot: R recharges hazard protection with sodium',
    G.state.hazardProtection > 20, `${Math.round(G.state.hazardProtection)}%`);

  key('KeyB'); frames(3);
  chk('foot: B opens build mode', S().buildMode === true);
  const part0 = document.querySelector('#build-part b')?.textContent;
  key('BracketRight'); frames(2);
  chk('build: ] cycles the part', document.querySelector('#build-part b')?.textContent !== part0);
  key('BracketLeft'); frames(2);
  chk('build: [ cycles back', document.querySelector('#build-part b')?.textContent === part0);
  G.state.inventory.ferrite = 900; G.state.inventory.carbon = 900;
  const parts0 = S().baseParts.length;
  input.mouseDown = true; frames(30); input.mouseDown = false; frames(3);
  chk('build: LMB places a part', S().baseParts.length > parts0);
  const parts1 = S().baseParts.length;
  hold('KeyX', 30);
  chk('build: X demolishes', S().baseParts.length < parts1);
  key('KeyB'); frames(3);
  chk('build: B exits build mode', S().buildMode === false);

  const spot = S().buildSpot();
  const h0 = S().height(spot.x, spot.z);
  hold('KeyZ', 30);
  chk('foot: Z digs terrain', S().height(spot.x, spot.z) < h0, `${(S().height(spot.x, spot.z) - h0).toFixed(1)} m`);
  const h1 = S().height(spot.x, spot.z);
  hold('KeyX', 30);
  chk('foot: X raises terrain', S().height(spot.x, spot.z) > h1);

  G.state.exocraftOwned = true;
  key('KeyV'); frames(3);
  chk('foot: V summons the Exocraft', !!S().exocraft);
  hold('KeyF', 6);
  chk('foot: F boards the Exocraft', S().inExocraft === true);
  const ex0 = S().exocraft.position.clone();
  const foot0 = S().pos.clone();
  hold('KeyW', 40);
  chk('exocraft: W drives', S().exocraft.position.distanceTo(ex0) > 2,
    `${S().exocraft.position.distanceTo(ex0).toFixed(1)} m`);
  chk('exocraft: the pilot rides along instead of walking',
    S().pos.distanceTo(S().exocraft.position) < 4);
  hold('KeyF', 6);
  chk('exocraft: F disembarks', S().inExocraft === false);

  // board the ship again
  S().pos.copy(S().ship.position).add({ x: 2, y: 2, z: 2 });
  G.state.launchFuel = 100;
  hold('KeyE', 10);
  chk('foot: E boards the ship', S().piloting === true);
  S().disembark(); frames(4);

  S().pos.copy(S().ship.position).add({ x: 2, y: 2, z: 2 });
  const fuel0 = G.state.launchFuel;
  hold('KeyQ', 8);
  await new Promise((r) => setTimeout(r, 700));
  frames(30);
  chk('foot: Q launches straight to orbit', G.game.mode === 'space', `fuel ${fuel0} -> ${G.state.launchFuel}`);
  chk('launch: thrusters consume fuel', G.state.launchFuel < fuel0);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} controls verified`);
if (failed.length) console.log('FAILED:', failed.map((f) => f.name).join(' | '));
console.log('ERRORS:', errors.length ? errors.slice(0, 4) : 'none');
process.exit(errors.length || failed.length ? 1 : 0);
