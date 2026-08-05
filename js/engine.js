// ============ FIREBROX — game engine (DOM-free; runs in Node for tests) ============
import {
  ARENA, CARDS, DECK, ELIXIR, MATCH, TOWERS, TOWER_POS,
  SIDES, otherSide,
} from './config.js';

let NEXT_ID = 1;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ------------------------------------------------------------------
// Game state
// ------------------------------------------------------------------
function buildTowers() {
  const mk = (id, side, kind, lane, pos) => ({
    id, side, kind, lane,
    x: pos.x, y: pos.y, r: TOWERS[kind].r,
    hp: TOWERS[kind].hp, maxHp: TOWERS[kind].hp,
    dmg: TOWERS[kind].dmg, hitSpeed: TOWERS[kind].hitSpeed,
    range: TOWERS[kind].range,
    active: kind !== 'king',
    cool: 0, alive: true, flash: 0,
  });
  return [
    mk('epl', SIDES.ENEMY, 'princess', 'left', TOWER_POS.enemyPrincessL),
    mk('epr', SIDES.ENEMY, 'princess', 'right', TOWER_POS.enemyPrincessR),
    mk('ek', SIDES.ENEMY, 'king', null, TOWER_POS.enemyKing),
    mk('ppl', SIDES.PLAYER, 'princess', 'left', TOWER_POS.playerPrincessL),
    mk('ppr', SIDES.PLAYER, 'princess', 'right', TOWER_POS.playerPrincessR),
    mk('pk', SIDES.PLAYER, 'king', null, TOWER_POS.playerKing),
  ];
}

export function createGame() {
  const deckP = shuffle([...DECK]);
  const deckE = shuffle([...DECK]);
  return {
    t: 0,                       // elapsed regulation time
    otLeft: 0,                  // overtime countdown (when suddenDeath)
    double: false,
    suddenDeath: false,
    over: false,
    winner: null,               // SIDES.* | null (draw)
    winReason: '',
    elixir: { player: ELIXIR.START, enemy: ELIXIR.START },
    hand: { player: deckP.slice(0, 4), enemy: deckE.slice(0, 4) },
    queue: { player: deckP.slice(4), enemy: deckE.slice(4) },
    crowns: { player: 0, enemy: 0 },
    towers: buildTowers(),
    units: [], projectiles: [], spells: [],
    effects: [], floaters: [],
    events: [],                 // drained each frame by the UI (for sounds)
    shake: 0,
  };
}

export const drainEvents = (s) => { const ev = s.events; s.events = []; return ev; };
export const towersOf = (s, side) => s.towers.filter((t) => t.side === side);
export const enemyUnits = (s, side) => s.units.filter((u) => u.side !== side && u.hp > 0);
export const cardInHand = (s, side, key) => s.hand[side].findIndex((k) => k === key);

// ------------------------------------------------------------------
// Deploying cards
// ------------------------------------------------------------------
function overlapsTower(s, x, y) {
  return s.towers.some((t) => t.alive && Math.hypot(x - t.x, y - t.y) < t.r + 14);
}

export function isValidDeploy(s, side, key, x, y) {
  const card = CARDS[key];
  if (!card) return false;
  if (x < 14 || x > ARENA.W - 14 || y < 14 || y > ARENA.H - 14) return false;
  if (card.type === 'spell') return true; // spells can go anywhere

  // never inside the river band
  if (y > ARENA.RIVER_TOP - 6 && y < ARENA.RIVER_BOT + 6) return false;

  const ownHalf = side === SIDES.PLAYER
    ? y > ARENA.RIVER_BOT + 6
    : y < ARENA.RIVER_TOP - 6;
  if (ownHalf) return !overlapsTower(s, x, y);

  // "pocket" deploy: allowed on the lane whose enemy princess has fallen
  const lane = x >= ARENA.W / 2 ? 'right' : 'left';
  const princess = s.towers.find((t) => t.side === otherSide(side) && t.lane === lane);
  if (!princess || princess.alive) return false;
  const yMin = side === SIDES.PLAYER ? ARENA.POCKET_TOP : ARENA.RIVER_BOT + 6;
  const yMax = side === SIDES.PLAYER ? ARENA.RIVER_TOP - 6 : ARENA.POCKET_BOT;
  if (y < yMin || y > yMax) return false;
  return !overlapsTower(s, x, y);
}

function spawnUnit(s, side, key, x, y) {
  const c = CARDS[key];
  s.units.push({
    id: NEXT_ID++, side, key,
    x: clamp(x, 14, ARENA.W - 14), y: clamp(y, 14, ARENA.H - 14),
    r: c.r, hp: c.hp, maxHp: c.hp,
    dmg: c.dmg, hitSpeed: c.hitSpeed, cool: 0.35 + Math.random() * 0.2,
    range: c.range, sight: c.sight, speed: c.speed,
    flying: c.flying, targetsBuildings: c.targetsBuildings,
    canHitAir: c.canHitAir, splash: c.splash,
    target: null, retarget: Math.random() * 0.2,
    facing: side === SIDES.PLAYER ? -Math.PI / 2 : Math.PI / 2,
    flash: 0, bob: Math.random() * 6,
  });
}

export function deployCard(s, side, key, x, y) {
  if (s.over) return { ok: false, reason: 'over' };
  const idx = cardInHand(s, side, key);
  if (idx < 0) return { ok: false, reason: 'not-in-hand' };
  const card = CARDS[key];
  if (s.elixir[side] < card.cost) return { ok: false, reason: 'elixir' };
  if (!isValidDeploy(s, side, key, x, y)) return { ok: false, reason: 'position' };
  if (s.units.filter((u) => u.side === side).length >= 30) return { ok: false, reason: 'cap' };

  s.elixir[side] -= card.cost;
  if (card.type === 'spell') {
    s.spells.push({
      key, side, x, y, t: card.castDelay,
      dmg: card.dmg, radius: card.radius, towerScale: card.towerScale,
    });
  } else {
    const offs = card.count === 1 ? [[0, 0]]
      : card.count === 2 ? [[-15, 0], [15, 0]]
      : [[0, -15], [-14, 10], [14, 10]];
    for (let i = 0; i < card.count; i++) {
      spawnUnit(s, side, key, x + offs[i][0], y + offs[i][1]);
    }
  }
  // cycle the card into the back of the deck, draw the next one
  s.hand[side][idx] = s.queue[side].shift();
  s.queue[side].push(key);

  s.effects.push({ type: 'ring', x, y, side, age: 0, life: 0.4 });
  s.events.push({ type: 'deploy', side, key });
  return { ok: true };
}

// ------------------------------------------------------------------
// Combat helpers
// ------------------------------------------------------------------
const targetAlive = (t) => !!t && t.hp > 0 && t.alive !== false;

function applyDamage(s, target, amount, srcSide) {
  if (target.kind && !target.alive) return; // dead tower
  target.hp -= amount;
  target.flash = 0.12;
  if (target.kind) { // tower
    if (target.kind === 'king' && !target.active) {
      target.active = true;
      s.events.push({ type: 'kingWake', side: target.side });
    }
    if (target.hp <= 0) { target.hp = 0; destroyTower(s, target, srcSide); }
  }
}

function destroyTower(s, t, srcSide) {
  if (s.over) return;
  t.alive = false;
  s.crowns[srcSide] += t.kind === 'king' ? 3 : 1;
  s.effects.push({ type: 'boom', x: t.x, y: t.y, radius: t.r + 34, age: 0, life: 0.6 });
  s.shake = Math.max(s.shake, 9);
  s.events.push({ type: 'towerDown', side: t.side, kind: t.kind });
  if (t.kind !== 'king') {
    const king = s.towers.find((k) => k.side === t.side && k.kind === 'king');
    if (king && !king.active) {
      king.active = true;
      s.events.push({ type: 'kingWake', side: t.side });
    }
    if (s.suddenDeath) finish(s, srcSide, 'First tower in sudden death!');
  } else {
    s.crowns[srcSide] = 3;
    finish(s, srcSide, "King's Tower destroyed!");
  }
}

function finish(s, winner, reason) {
  if (s.over) return;
  s.over = true;
  s.winner = winner;
  s.winReason = reason;
  s.events.push({ type: 'end', winner, reason });
}

function tiebreak(s) {
  const minAliveHp = (side) => {
    const alive = towersOf(s, side).filter((t) => t.alive).map((t) => t.hp);
    if (!alive.length) return 0;
    return Math.min(...alive);
  };
  const a = minAliveHp(SIDES.PLAYER);
  const b = minAliveHp(SIDES.ENEMY);
  if (Math.abs(a - b) <= 1) finish(s, null, 'Dead even — a draw!');
  else finish(s, a > b ? SIDES.PLAYER : SIDES.ENEMY, 'Tiebreaker: weakest tower HP');
}

function acquireTarget(s, u) {
  if (!u.targetsBuildings) {
    let best = null, bd = Infinity;
    for (const e of s.units) {
      if (e.side === u.side || e.hp <= 0) continue;
      if (!u.canHitAir && e.flying) continue;
      const d = dist(u, e);
      if (d < u.sight && d < bd) { bd = d; best = e; }
    }
    if (best) return best;
  }
  let best = null, bd = Infinity;
  for (const t of s.towers) {
    if (!t.alive || t.side === u.side) continue;
    const d = dist(u, t) - t.r;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

// Ground troops must funnel through a bridge to cross the river.
function steer(u, tgt) {
  const direct = () => {
    const d = Math.hypot(tgt.x - u.x, tgt.y - u.y) || 1;
    return { x: (tgt.x - u.x) / d, y: (tgt.y - u.y) / d };
  };
  if (u.flying) return direct();
  const uTop = u.y < ARENA.RIVER_TOP;   // "top half" = enemy's side for the player
  const tTop = tgt.y < ARENA.RIVER_TOP;
  if (uTop === tTop) return direct();
  const br = ARENA.BRIDGES[Math.abs(u.x - ARENA.BRIDGES[0].x) < Math.abs(u.x - ARENA.BRIDGES[1].x) ? 0 : 1];
  if (Math.abs(u.x - br.x) < br.w / 2 - 4) return direct(); // in the corridor: cross!
  const edge = { x: br.x, y: uTop ? ARENA.RIVER_BOT + 22 : ARENA.RIVER_TOP - 22 };
  const d = Math.hypot(edge.x - u.x, edge.y - u.y);
  if (d < 10) return direct();
  return { x: (edge.x - u.x) / d, y: (edge.y - u.y) / d };
}

function constrain(s, u) {
  u.x = clamp(u.x, 14, ARENA.W - 14);
  u.y = clamp(u.y, 14, ARENA.H - 14);
  if (!u.flying && u.y > ARENA.RIVER_TOP - 2 && u.y < ARENA.RIVER_BOT + 2) {
    const inCorridor = ARENA.BRIDGES.some((b) => Math.abs(u.x - b.x) <= b.w / 2 - 2);
    if (!inCorridor) {
      const dTop = u.y - (ARENA.RIVER_TOP - 2);
      const dBot = (ARENA.RIVER_BOT + 2) - u.y;
      u.y = dTop < dBot ? ARENA.RIVER_TOP - 2 : ARENA.RIVER_BOT + 2; // slide along the bank
    }
  }
  for (const t of s.towers) {
    if (!t.alive) continue;
    const dx = u.x - t.x, dy = u.y - t.y;
    const d = Math.hypot(dx, dy);
    const min = t.r + u.r - 2;
    if (d < min) {
      if (d < 0.001) { u.x = t.x + min; continue; }
      u.x = t.x + (dx / d) * min;
      u.y = t.y + (dy / d) * min;
    }
  }
}

function strike(s, u, tgt) {
  const melee = u.range <= 24;
  if (melee) {
    applyDamage(s, tgt, u.dmg, u.side);
    s.effects.push({
      type: 'slash',
      x: (u.x + tgt.x) / 2, y: (u.y + tgt.y) / 2,
      a: u.facing, age: 0, life: 0.14,
    });
    s.events.push({ type: 'hit', heavy: u.dmg >= 150 });
  } else {
    const kind = u.key === 'musketeer' ? 'bolt' : u.key === 'babydragon' ? 'flame' : 'arrow';
    s.projectiles.push({
      x: u.x, y: u.y, side: u.side, kind,
      target: tgt, tx: tgt.x, ty: tgt.y,
      dmg: u.dmg, splash: u.splash || 0,
      speed: kind === 'bolt' ? 700 : kind === 'flame' ? 280 : 480,
    });
    s.events.push({ type: 'shoot', kind });
  }
}

// ------------------------------------------------------------------
// Per-frame systems
// ------------------------------------------------------------------
function updateTowers(s, dt) {
  for (const t of s.towers) {
    if (!t.alive || !t.active) continue;
    t.flash = Math.max(0, t.flash - dt);
    t.cool -= dt;
    if (t.cool > 0) continue;
    let best = null, bd = Infinity;
    for (const u of s.units) {
      if (u.side === t.side || u.hp <= 0) continue;
      const d = Math.hypot(u.x - t.x, u.y - t.y);
      if (d <= t.range + u.r && d < bd) { bd = d; best = u; }
    }
    if (best) {
      t.cool = t.hitSpeed;
      s.projectiles.push({
        x: t.x, y: t.y - t.r, side: t.side, kind: 'arrow',
        target: best, tx: best.x, ty: best.y,
        dmg: t.dmg, splash: 0, speed: 430, fromTower: true,
      });
      s.events.push({ type: 'shoot', kind: 'tower' });
    }
  }
}

function updateUnits(s, dt) {
  for (const u of s.units) {
    if (u.hp <= 0) continue;
    u.flash = Math.max(0, u.flash - dt);
    u.cool -= dt;
    u.retarget -= dt;
    if (u.retarget <= 0 || !targetAlive(u.target)) {
      u.target = acquireTarget(s, u);
      u.retarget = 0.22 + Math.random() * 0.12;
    }
    const tgt = u.target;
    if (!tgt) continue;
    const tr = tgt.r || 0;
    const d = Math.hypot(tgt.x - u.x, tgt.y - u.y);
    const reach = u.range + tr + u.r * 0.25;
    if (d > reach) {
      const dir = steer(u, tgt);
      u.x += dir.x * u.speed * dt;
      u.y += dir.y * u.speed * dt;
      u.facing = Math.atan2(dir.y, dir.x);
      constrain(s, u);
    } else {
      u.facing = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      if (u.cool <= 0) {
        u.cool = u.hitSpeed;
        strike(s, u, tgt);
      }
    }
  }

  // soft body separation so troops don't stack into one blob
  const us = s.units;
  for (let i = 0; i < us.length; i++) {
    const a = us[i];
    if (a.hp <= 0) continue;
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j];
      if (b.hp <= 0 || a.flying !== b.flying) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (d < min) {
        if (d < 0.01) { dx = 0.01; dy = 0; d = 0.01; }
        const push = (min - d) * 0.25;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
  }

  // remove the dead
  s.units = s.units.filter((u) => {
    if (u.hp > 0) return true;
    s.effects.push({ type: 'puff', x: u.x, y: u.y, r: u.r, age: 0, life: 0.35 });
    s.events.push({ type: 'die', key: u.key });
    return false;
  });
}

function updateProjectiles(s, dt) {
  s.projectiles = s.projectiles.filter((p) => {
    if (targetAlive(p.target)) { p.tx = p.target.x; p.ty = p.target.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (d > step) { p.x += (dx / d) * step; p.y += (dy / d) * step; return true; }

    // arrived
    if (p.splash > 0) {
      for (const u of s.units) {
        if (u.side === p.side || u.hp <= 0) continue;
        if (Math.hypot(u.x - p.tx, u.y - p.ty) <= p.splash + u.r) applyDamage(s, u, p.dmg, p.side);
      }
      for (const t of s.towers) {
        if (!t.alive || t.side === p.side) continue;
        if (Math.hypot(t.x - p.tx, t.y - p.ty) <= p.splash + t.r * 0.5) applyDamage(s, t, p.dmg, p.side);
      }
      s.effects.push({ type: 'boom', x: p.tx, y: p.ty, radius: p.splash, age: 0, life: 0.3 });
      s.events.push({ type: 'hit', heavy: false });
    } else if (targetAlive(p.target)) {
      applyDamage(s, p.target, p.dmg, p.side);
      s.events.push({ type: 'hit', heavy: false });
    }
    return false;
  });
}

function updateSpells(s, dt) {
  s.spells = s.spells.filter((sp) => {
    sp.t -= dt;
    if (sp.t > 0) return true;
    for (const u of s.units) {
      if (u.side === sp.side || u.hp <= 0) continue;
      if (Math.hypot(u.x - sp.x, u.y - sp.y) <= sp.radius + u.r) applyDamage(s, u, sp.dmg, sp.side);
    }
    for (const t of s.towers) {
      if (!t.alive || t.side === sp.side) continue;
      if (Math.hypot(t.x - sp.x, t.y - sp.y) <= sp.radius + t.r * 0.5) {
        const dmg = Math.round(sp.dmg * sp.towerScale);
        applyDamage(s, t, dmg, sp.side);
        s.floaters.push({ x: t.x, y: t.y - t.r - 8, text: `-${dmg}`, age: 0, life: 0.9 });
      }
    }
    s.effects.push({ type: 'boom', x: sp.x, y: sp.y, radius: sp.radius + 18, age: 0, life: 0.5, fire: true });
    s.shake = Math.max(s.shake, 6);
    s.events.push({ type: 'boom' });
    return false;
  });
}

function updateFx(s, dt) {
  for (const e of s.effects) e.age += dt;
  s.effects = s.effects.filter((e) => e.age < e.life);
  for (const f of s.floaters) { f.age += dt; f.y -= 24 * dt; }
  s.floaters = s.floaters.filter((f) => f.age < f.life);
}

// ------------------------------------------------------------------
// Main tick
// ------------------------------------------------------------------
export function update(s, dt) {
  if (s.over) { // battle decided; let the fireworks fade
    updateFx(s, dt);
    s.shake = Math.max(0, s.shake - dt * 14);
    return;
  }

  s.t += dt;
  if (!s.suddenDeath) {
    if (!s.double && s.t >= MATCH.DOUBLE_AT) {
      s.double = true;
      s.events.push({ type: 'double' });
    }
    if (s.t >= MATCH.TIME) {
      if (s.crowns.player !== s.crowns.enemy) {
        finish(s, s.crowns.player > s.crowns.enemy ? SIDES.PLAYER : SIDES.ENEMY, 'More towers destroyed');
        return;
      }
      s.suddenDeath = true;
      s.otLeft = MATCH.OT;
      s.events.push({ type: 'overtime' });
    }
  } else {
    s.otLeft -= dt;
    if (s.otLeft <= 0) { tiebreak(s); return; }
  }

  const rate = ELIXIR.RATE * (s.double || s.suddenDeath ? 2 : 1);
  for (const side of [SIDES.PLAYER, SIDES.ENEMY]) {
    s.elixir[side] = Math.min(ELIXIR.MAX, s.elixir[side] + rate * dt);
  }

  updateTowers(s, dt);
  updateUnits(s, dt);
  updateProjectiles(s, dt);
  updateSpells(s, dt);
  updateFx(s, dt);
  s.shake = Math.max(0, s.shake - dt * 14);
}
