// ============ FIREBROX — bootstrap, UI & game loop ============
import { ARENA, CARDS, MATCH, SIDES } from './config.js';
import * as E from './engine.js';
import { OpponentAI } from './ai.js';
import { render } from './render.js';
import { Sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const sfx = new Sfx();

let game = E.createGame();
let ai = new OpponentAI(SIDES.ENEMY);
let playing = false;
let endShown = false;

const ui = {
  selected: null,                 // card key currently selected
  ghost: { x: 0, y: 0, visible: false, valid: false },
};

// ---------------------------------------------------------------
// Canvas sizing — keep a 9:16 arena fitted to the available space
// ---------------------------------------------------------------
function fit() {
  const wrap = $('arenaWrap');
  const availW = Math.min(window.innerWidth, 536) - 24;
  const availH = window.innerHeight - $('hud').offsetHeight - $('controls').offsetHeight - 40;
  let h = Math.max(300, availH);
  let w = h * (ARENA.W / ARENA.H);
  if (w > availW) { w = availW; h = w * (ARENA.H / ARENA.W); }
  wrap.style.width = `${w}px`;
  wrap.style.height = `${h}px`;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = ARENA.W * dpr;
  canvas.height = ARENA.H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', fit);

function toWorld(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (ev.clientX - r.left) / r.width * ARENA.W,
    y: (ev.clientY - r.top) / r.height * ARENA.H,
    inside: ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom,
  };
}

// ---------------------------------------------------------------
// Cards UI
// ---------------------------------------------------------------
const cardEls = new Map();
let nextEl = null;

function buildCards() {
  const row = $('cardsRow');
  row.innerHTML = '';
  cardEls.clear();
  for (const key of game.hand.player) {
    const c = CARDS[key];
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.key = key;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${c.name}, cost ${c.cost}`);
    el.innerHTML = `<div class="cost">${c.cost}</div><div class="icon">${c.icon}</div><div class="name">${c.name}</div>`;
    row.appendChild(el);
    cardEls.set(key, el);
  }
  nextEl = document.createElement('div');
  nextEl.className = 'card next';
  row.appendChild(nextEl);
  refreshNext();
}

function refreshNext() {
  const key = game.queue.player[0];
  nextEl.innerHTML = `<div class="nextlabel">NEXT</div><div class="icon">${CARDS[key].icon}</div>`;
}

let lastHandSig = '';
function syncCards() {
  const sig = game.hand.player.join(',');
  if (sig !== lastHandSig) { // hand changed → rebuild so cycle is visible
    lastHandSig = sig;
    const row = $('cardsRow');
    const keys = game.hand.player;
    [...cardEls.values()].forEach((el) => el.remove());
    cardEls.clear();
    keys.forEach((key) => {
      const c = CARDS[key];
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.key = key;
      el.innerHTML = `<div class="cost">${c.cost}</div><div class="icon">${c.icon}</div><div class="name">${c.name}</div>`;
      row.insertBefore(el, nextEl);
      cardEls.set(key, el);
    });
    if (ui.selected && !keys.includes(ui.selected)) ui.selected = null;
    refreshNext();
  }
  const e = game.elixir.player;
  for (const [key, el] of cardEls) {
    el.classList.toggle('disabled', CARDS[key].cost > e);
    el.classList.toggle('selected', ui.selected === key);
  }
}

function selectCard(key) {
  if (!playing) return;
  if (ui.selected === key) { ui.selected = null; sfx.play('click'); return; }
  if (game.elixir.player < CARDS[key].cost) {
    sfx.play('error');
    const el = cardEls.get(key);
    if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
    return;
  }
  ui.selected = key;
  sfx.play('select');
}

function attemptDeploy(x, y) {
  if (!ui.selected || !playing) return;
  const key = ui.selected;
  const res = E.deployCard(game, SIDES.PLAYER, key, x, y);
  if (res.ok) {
    ui.selected = null;
    ui.ghost.visible = false;
  } else {
    sfx.play('error');
    const el = cardEls.get(key);
    if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  }
}

// ---------------------------------------------------------------
// Input — tap a card then tap the arena, or drag from card to arena
// ---------------------------------------------------------------
let dragging = false;

$('cardsRow').addEventListener('pointerdown', (ev) => {
  const el = ev.target.closest('.card');
  if (!el || el.classList.contains('next')) return;
  ev.preventDefault();
  selectCard(el.dataset.key);
  if (ui.selected) {
    dragging = true;
    ui.ghost.visible = false;
    ui.ghost.x = ev.clientX; ui.ghost.y = ev.clientY;
  }
});

window.addEventListener('pointermove', (ev) => {
  if (!ui.selected) return;
  const w = toWorld(ev);
  ui.ghost.visible = w.inside;
  ui.ghost.x = w.x; ui.ghost.y = w.y;
  ui.ghost.valid = E.isValidDeploy(game, SIDES.PLAYER, ui.selected, w.x, w.y);
});

window.addEventListener('pointerup', (ev) => {
  if (dragging && ui.selected) {
    const w = toWorld(ev);
    if (w.inside) attemptDeploy(w.x, w.y);
  }
  dragging = false;
});

canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  const w = toWorld(ev);
  if (ui.selected) attemptDeploy(w.x, w.y);
});
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

window.addEventListener('keydown', (ev) => {
  if (!playing) return;
  const n = Number(ev.key);
  if (n >= 1 && n <= 4) selectCard(game.hand.player[n - 1]);
  if (ev.key === 'Escape') ui.selected = null;
});

// ---------------------------------------------------------------
// HUD sync
// ---------------------------------------------------------------
function fmt(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${(sec / 60) | 0}:${String(sec % 60).padStart(2, '0')}`;
}

function syncHud() {
  const tl = game.suddenDeath ? game.otLeft : MATCH.TIME - game.t;
  $('timer').textContent = fmt(tl);
  $('timerPill').classList.toggle('hot', game.suddenDeath || tl <= 10);
  $('chipDouble').classList.toggle('hidden', !(game.double && !game.suddenDeath));
  $('chipSudden').classList.toggle('hidden', !game.suddenDeath);
  $('elixirFill').style.width = `${(game.elixir.player / 10) * 100}%`;
  $('elixirCount').textContent = Math.floor(game.elixir.player);
  $('playerCrowns').textContent = '👑'.repeat(game.crowns.player);
  $('enemyCrowns').textContent = '👑'.repeat(game.crowns.enemy);
  syncCards();
}

// ---------------------------------------------------------------
// Event sounds
// ---------------------------------------------------------------
function playEvents(list) {
  for (const ev of list) {
    switch (ev.type) {
      case 'deploy':   sfx.play('deploy'); break;
      case 'shoot':    if (Math.random() < 0.7) sfx.play('shoot'); break;
      case 'hit':      sfx.play(ev.heavy ? 'heavy' : Math.random() < 0.5 ? 'hit' : '_'); break;
      case 'die':      if (Math.random() < 0.6) sfx.play('die'); break;
      case 'boom':     sfx.play('boom'); break;
      case 'towerDown': sfx.play('tower'); break;
      case 'kingWake': sfx.play('wake'); break;
      case 'double':   sfx.play('double'); break;
      case 'overtime': sfx.play('overtime'); break;
      case 'end':
        setTimeout(() => sfx.play(ev.winner === SIDES.PLAYER ? 'win' : ev.winner ? 'lose' : 'click'), 500);
        break;
    }
  }
}

// ---------------------------------------------------------------
// Overlays / flow
// ---------------------------------------------------------------
function showEnd() {
  const o = $('endOverlay');
  const title = $('endTitle');
  if (game.winner === SIDES.PLAYER) { title.textContent = 'VICTORY!'; title.className = 'end-title win'; }
  else if (game.winner === SIDES.ENEMY) { title.textContent = 'DEFEAT'; title.className = 'end-title lose'; }
  else { title.textContent = 'DRAW'; title.className = 'end-title draw'; }
  $('endCrowns').textContent = '👑'.repeat(game.crowns.player) + ' 🆚 ' + '👑'.repeat(game.crowns.enemy);
  $('endSub').textContent = game.winReason;
  o.classList.remove('hidden');
}

function startGame() {
  game = E.createGame();
  ai = new OpponentAI(SIDES.ENEMY);
  ui.selected = null;
  ui.ghost.visible = false;
  endShown = false;
  lastHandSig = '';
  buildCards();
  $('overlay').classList.add('hidden');
  $('endOverlay').classList.add('hidden');
  playing = true;
  sfx.unlock();
  sfx.play('horn');
}

$('playBtn').addEventListener('click', () => { sfx.unlock(); sfx.play('click'); startGame(); });
$('againBtn').addEventListener('click', () => { sfx.play('click'); startGame(); });

// ---------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) {
    if (!game.over) {
      ai.update(game, dt);
      E.update(game, dt);
    }
    playEvents(E.drainEvents(game));
    if (game.over && !endShown) {
      endShown = true;
      setTimeout(showEnd, 1000);
    }
  }
  render(ctx, game, ui);
  syncHud();
  requestAnimationFrame(frame);
}

buildCards();
fit();
requestAnimationFrame(frame);
