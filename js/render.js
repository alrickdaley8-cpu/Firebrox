// ============ FIREBROX — canvas renderer ============
import { ARENA, CARDS, SIDES } from './config.js';

const EMOJI_FONT = (s) => `${s}px "Noto Color Emoji","Segoe UI Emoji","Apple Color Emoji",sans-serif`;
const TEAM = { player: '#ff7a29', enemy: '#3fb9ff' };
const HP_COLOR = { player: '#4ade80', enemy: '#f87171' };

// deterministic grass tufts so the arena doesn't shimmer between frames
const tufts = [];
for (let i = 0; i < 90; i++) {
  const rx = ((i * 73.13) % 1), ry = ((i * 37.77) % 1);
  tufts.push({ x: 10 + rx * (ARENA.W - 20), y: 10 + ry * (ARENA.H - 20), l: 3 + (i % 3) });
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawArena(ctx, s) {
  const { W, H } = ARENA;
  // grass — slightly cooler on the ice king's side
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#4d8f6f');
  g.addColorStop(0.48, '#5aa050');
  g.addColorStop(0.52, '#5fa84e');
  g.addColorStop(1, '#66b346');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // mow stripes
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  for (let y = 0; y < H; y += 96) ctx.fillRect(0, y, W, 48);

  // grass tufts
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  for (const t of tufts) {
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x + 2, t.y - t.l);
    ctx.moveTo(t.x + 4, t.y);
    ctx.lineTo(t.x + 3, t.y - t.l);
    ctx.stroke();
  }

  // dirt pads under tower spots & lane ends
  ctx.fillStyle = 'rgba(150,110,62,0.35)';
  for (const x of [110, 430]) {
    ctx.beginPath(); ctx.ellipse(x, 232, 52, 40, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, 728, 52, 40, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, 426, 46, 22, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, 534, 46, 22, 0, 0, 7); ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(270, 112, 62, 42, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(270, 848, 62, 42, 0, 0, 7); ctx.fill();

  // river
  const rv = ctx.createLinearGradient(0, ARENA.RIVER_TOP, 0, ARENA.RIVER_BOT);
  rv.addColorStop(0, '#2f8fd6');
  rv.addColorStop(0.5, '#4db3ec');
  rv.addColorStop(1, '#2f8fd6');
  ctx.fillStyle = rv;
  ctx.fillRect(0, ARENA.RIVER_TOP, W, ARENA.RIVER_BOT - ARENA.RIVER_TOP);
  // animated wave lines
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    const y0 = ARENA.RIVER_TOP + 14 + k * 20;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 18) {
      const y = y0 + Math.sin(x / 34 + s.t * 1.6 + k * 2) * 3;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // river banks
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, ARENA.RIVER_TOP - 4, W, 4);
  ctx.fillRect(0, ARENA.RIVER_BOT, W, 4);

  // bridges
  for (const b of ARENA.BRIDGES) {
    ctx.fillStyle = '#8a5a30';
    rr(ctx, b.x - b.w / 2 - 4, ARENA.RIVER_TOP - 12, b.w + 8, ARENA.RIVER_BOT - ARENA.RIVER_TOP + 24, 6);
    ctx.fill();
    ctx.fillStyle = '#b07a44';
    rr(ctx, b.x - b.w / 2, ARENA.RIVER_TOP - 10, b.w, ARENA.RIVER_BOT - ARENA.RIVER_TOP + 20, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    for (let y = ARENA.RIVER_TOP - 2; y < ARENA.RIVER_BOT + 10; y += 12) {
      ctx.beginPath(); ctx.moveTo(b.x - b.w / 2, y); ctx.lineTo(b.x + b.w / 2, y); ctx.stroke();
    }
  }
}

function drawDeployZones(ctx, s, ui) {
  if (!ui.selected) return;
  // own half tint
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, ARENA.RIVER_BOT + 4, ARENA.W, ARENA.H - ARENA.RIVER_BOT - 4);
  // pockets
  for (const lane of ['left', 'right']) {
    const p = s.towers.find((t) => t.side === SIDES.ENEMY && t.lane === lane);
    if (p && !p.alive) {
      ctx.fillStyle = 'rgba(74,222,128,0.14)';
      const x0 = lane === 'left' ? 0 : ARENA.W / 2;
      ctx.fillRect(x0, ARENA.POCKET_TOP, ARENA.W / 2, ARENA.RIVER_TOP - 4 - ARENA.POCKET_TOP);
    }
  }
  // ghost
  if (ui.ghost.visible) {
    const ok = ui.ghost.valid;
    ctx.beginPath();
    ctx.arc(ui.ghost.x, ui.ghost.y, CARDS[ui.selected].type === 'spell' ? CARDS[ui.selected].radius : 26, 0, 7);
    ctx.fillStyle = ok ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = ok ? '#4ade80' : '#f87171';
    ctx.stroke();
  }
}

function drawCrown(ctx, x, y, size) {
  ctx.fillStyle = '#ffd94d';
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 1.5;
  const w = size, h = size * 0.72;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + h / 2);
  ctx.lineTo(x - w / 2, y - h / 4);
  ctx.lineTo(x - w / 4, y);
  ctx.lineTo(x, y - h / 2);
  ctx.lineTo(x + w / 4, y);
  ctx.lineTo(x + w / 2, y - h / 4);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}

function drawTower(ctx, s, t) {
  if (!t.alive) {
    // rubble
    ctx.fillStyle = 'rgba(40,34,34,0.85)';
    ctx.beginPath(); ctx.ellipse(t.x, t.y + 4, t.r + 8, (t.r + 8) * 0.7, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + t.x;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x + Math.cos(a) * t.r, t.y + Math.sin(a) * t.r * 0.7 + 4);
      ctx.stroke();
    }
    return;
  }
  const team = TEAM[t.side];
  // pedestal
  ctx.fillStyle = '#6b7280';
  ctx.beginPath(); ctx.ellipse(t.x, t.y + t.r * 0.5, t.r + 7, (t.r + 7) * 0.62, 0, 0, 7); ctx.fill();
  // body
  const bg = ctx.createLinearGradient(t.x, t.y - t.r, t.x, t.y + t.r);
  bg.addColorStop(0, '#d6dae2');
  bg.addColorStop(1, '#8f96a3');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#4b5563';
  ctx.stroke();
  // team dome
  ctx.fillStyle = team;
  ctx.beginPath(); ctx.arc(t.x, t.y - t.r * 0.28, t.r * 0.62, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // battlements
  ctx.fillStyle = '#4b5563';
  for (let i = -1; i <= 1; i++) ctx.fillRect(t.x + i * t.r * 0.5 - 4, t.y - t.r - 6, 8, 8);

  if (t.kind === 'king') {
    drawCrown(ctx, t.x, t.y - t.r * 0.2, 22);
    if (!t.active) {
      ctx.font = EMOJI_FONT(18);
      ctx.textAlign = 'center';
      const bob = Math.sin(s.t * 3) * 3;
      ctx.fillText('💤', t.x + t.r * 0.8, t.y - t.r - 8 + bob);
    }
  }
  if (t.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, t.flash * 5)})`;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.fill();
  }
  // hp bar
  const w = t.kind === 'king' ? 72 : 58;
  const pct = Math.max(0, t.hp / t.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, t.x - w / 2, t.y - t.r - 22, w, 9, 4); ctx.fill();
  ctx.fillStyle = HP_COLOR[t.side];
  if (pct > 0) { rr(ctx, t.x - w / 2 + 1.5, t.y - t.r - 20.5, (w - 3) * pct, 6, 3); ctx.fill(); }
  ctx.font = '700 9px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(Math.ceil(t.hp), t.x, t.y - t.r - 14.5);
}

function drawUnit(ctx, s, u) {
  const team = TEAM[u.side];
  const flyOff = u.flying ? 12 + Math.sin(s.t * 5 + u.bob) * 2.5 : 0;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(u.x, u.y + u.r * 0.75, u.r * (u.flying ? 0.7 : 0.9), u.r * 0.4, 0, 0, 7);
  ctx.fill();

  const y = u.y - flyOff;
  // body + team ring
  ctx.beginPath(); ctx.arc(u.x, y, u.r, 0, 7);
  ctx.fillStyle = CARDS[u.key].color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = team;
  ctx.stroke();
  // top highlight
  ctx.beginPath(); ctx.arc(u.x - u.r * 0.25, y - u.r * 0.3, u.r * 0.45, 0, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();
  // glyph
  ctx.font = EMOJI_FONT(Math.round(u.r * 1.35));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(CARDS[u.key].icon, u.x, y + 1);
  ctx.textBaseline = 'alphabetic';

  if (u.flash > 0) {
    ctx.beginPath(); ctx.arc(u.x, y, u.r + 1, 0, 7);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, u.flash * 6)})`;
    ctx.fill();
  }
  // hp bar
  if (u.hp < u.maxHp) {
    const w = Math.max(20, u.r * 2.2);
    const pct = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(u.x - w / 2, y - u.r - 9, w, 4);
    ctx.fillStyle = HP_COLOR[u.side];
    ctx.fillRect(u.x - w / 2, y - u.r - 9, w * pct, 4);
  }
}

function drawProjectile(ctx, p) {
  const a = Math.atan2(p.ty - p.y, p.tx - p.x);
  if (p.kind === 'arrow') {
    ctx.strokeStyle = '#e7d7a8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.x - Math.cos(a) * 8, p.y - Math.sin(a) * 8);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 7); ctx.fill();
  } else if (p.kind === 'bolt') {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 7);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.4, '#f0abfc');
    g.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill();
  } else { // flame
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
    g.addColorStop(0, '#fff7ad');
    g.addColorStop(0.5, '#fb923c');
    g.addColorStop(1, 'rgba(234,88,12,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 7); ctx.fill();
  }
}

function drawEffects(ctx, s) {
  for (const e of s.effects) {
    const k = e.age / e.life;
    if (e.type === 'ring') {
      ctx.beginPath(); ctx.arc(e.x, e.y, 8 + k * 30, 0, 7);
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (e.type === 'slash') {
      ctx.beginPath();
      ctx.arc(e.x, e.y, 12, e.a - 0.9, e.a + 0.9);
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - k)})`;
      ctx.lineWidth = 3.5;
      ctx.stroke();
    } else if (e.type === 'puff') {
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.6 + k), 0, 7);
      ctx.fillStyle = `rgba(180,180,190,${0.5 * (1 - k)})`;
      ctx.fill();
    } else if (e.type === 'boom') {
      const R = e.radius * (0.4 + k * 0.9);
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, R);
      if (e.fire) {
        g.addColorStop(0, `rgba(255,247,173,${0.95 * (1 - k)})`);
        g.addColorStop(0.55, `rgba(251,146,60,${0.8 * (1 - k)})`);
        g.addColorStop(1, 'rgba(234,88,12,0)');
      } else {
        g.addColorStop(0, `rgba(255,255,255,${0.8 * (1 - k)})`);
        g.addColorStop(1, 'rgba(150,150,160,0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e.x, e.y, R, 0, 7); ctx.fill();
    }
  }
  // spell markers (incoming fireball telegraph)
  for (const sp of s.spells) {
    const pulse = 0.5 + Math.sin(s.t * 14) * 0.3;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.radius, 0, 7);
    ctx.fillStyle = sp.side === SIDES.PLAYER
      ? `rgba(255,122,41,${0.16 + pulse * 0.1})`
      : `rgba(239,68,68,${0.16 + pulse * 0.1})`;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = sp.side === SIDES.PLAYER ? '#ff7a29' : '#f87171';
    ctx.stroke();
  }
  // damage floaters
  for (const f of s.floaters) {
    const k = f.age / f.life;
    ctx.font = '800 14px system-ui';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(0,0,0,${0.8 * (1 - k)})`;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = `rgba(255,220,120,${1 - k})`;
    ctx.fillText(f.text, f.x, f.y);
  }
}

export function render(ctx, s, ui) {
  ctx.save();
  ctx.clearRect(0, 0, ARENA.W, ARENA.H);
  if (s.shake > 0) {
    ctx.translate(
      Math.sin(s.t * 47.3) * s.shake * 0.6,
      Math.cos(s.t * 39.1) * s.shake * 0.6,
    );
  }
  drawArena(ctx, s);
  drawDeployZones(ctx, s, ui);
  for (const t of s.towers) drawTower(ctx, s, t);
  const units = [...s.units].sort((a, b) => a.y - b.y);
  for (const u of units) drawUnit(ctx, s, u);
  for (const p of s.projectiles) drawProjectile(ctx, p);
  drawEffects(ctx, s);
  ctx.restore();
}
