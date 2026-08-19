// Galaxy map: rotate the galaxy, plan routes, jump through wormholes, switch galaxies.
import { state, stats } from './state.js';
import { distance, planRoute, canWarpTo, GALAXIES, STAR_CLASSES, DRIVES } from './universe.js';
import { input } from './input.js';

export class GalaxyMap {
  constructor(galaxy, onWarp, onGalaxyPreview) {
    this.galaxy = galaxy;
    this.onWarp = onWarp;
    this.onGalaxyPreview = onGalaxyPreview;
    this.canvas = document.getElementById('map-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.selected = null;
    this.open = false;
    this.rot = 0;
    this.autoRot = true;
    this.zoom = 1;
    this.view = 'galaxy';     // 'galaxy' | 'intergalactic'
    this.route = null;

    this.canvas.addEventListener('click', (e) => this.pick(e));
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = Math.max(0.4, Math.min(5, this.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      this.draw();
    }, { passive: false });
  }

  setGalaxy(galaxy) {
    this.galaxy = galaxy;
    this.selected = null;
    this.route = null;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(600, r.width * devicePixelRatio);
    this.canvas.height = Math.max(300, r.height * devicePixelRatio);
  }

  project(sys) {
    const w = this.canvas.width, h = this.canvas.height;
    const s = (Math.min(w, h) / 2300) * this.zoom;
    const cos = Math.cos(this.rot), sin = Math.sin(this.rot);
    const x = sys.pos.x * cos - sys.pos.z * sin;
    const z = sys.pos.x * sin + sys.pos.z * cos;
    return { x: w / 2 + x * s, y: h / 2 + (z * 0.42 - sys.pos.y * 0.9) * s, s };
  }

  show(currentId) {
    this.open = true;
    this.currentId = currentId;
    if (this.selected == null) this.selected = currentId;
    document.getElementById('map').classList.remove('hidden');
    document.getElementById('map-galaxy').textContent = this.galaxy.name;
    this.resize();
    this.recomputeRoute();
    this.draw();
    this.updateInfo();
  }

  hide() {
    this.open = false;
    document.getElementById('map').classList.add('hidden');
  }

  toggleView() {
    this.view = this.view === 'galaxy' ? 'intergalactic' : 'galaxy';
    this.draw();
    this.updateInfo();
  }

  pick(e) {
    const r = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * devicePixelRatio;
    const my = (e.clientY - r.top) * devicePixelRatio;

    if (this.view === 'intergalactic') {
      const hit = (this._galaxyHits || []).find((g) => Math.hypot(g.x - mx, g.y - my) < 34 * devicePixelRatio);
      if (hit) {
        this.previewGalaxy = hit.index;
        this.draw();
        this.updateInfo();
      }
      return;
    }

    let best = null, bestD = 1e9;
    for (const s of this.galaxy.systems) {
      const p = this.project(s);
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best && bestD < 40 * devicePixelRatio) {
      this.selected = best.id;
      this.autoRot = false;
      this.recomputeRoute();
      this.draw();
      this.updateInfo();
    }
  }

  recomputeRoute() {
    if (this.selected == null || this.selected === this.currentId) { this.route = null; return; }
    this.route = planRoute(this.galaxy, this.currentId, this.selected, stats.jumpRange, state.drives);
  }

  jumpInfo() {
    const cur = this.galaxy.systems[this.currentId];
    const sel = this.galaxy.systems[this.selected];
    const d = distance(cur.pos, sel.pos);
    const gated = !canWarpTo(sel, state.drives);
    return {
      cur, sel, d, gated,
      range: stats.jumpRange,
      inRange: d <= stats.jumpRange && sel.id !== cur.id && !gated,
    };
  }

  updateInfo() {
    const el = document.getElementById('map-info');

    if (this.view === 'intergalactic') {
      const idx = this.previewGalaxy ?? state.galaxyIndex;
      const g = GALAXIES[idx];
      const visited = state.visitedGalaxies.includes(idx);
      el.innerHTML = `
        <h3>${visited ? g.name : 'UNCHARTED GALAXY'}</h3>
        <div class="cols">
          <span>${g.type} galaxy</span>
          <span>${g.traits.size} systems</span>
          <span>Hostility ${g.traits.hostility.toFixed(2)}×</span>
          <span>Richness ${g.traits.richness.toFixed(2)}×</span>
          <span>Exotic ${g.traits.exotic.toFixed(2)}×</span>
        </div>
        <div style="margin-top:6px">${idx === state.galaxyIndex
          ? '<em>You are here.</em> Reach the core, or find the intergalactic gate, to move on.'
          : visited ? 'Previously charted.' : 'Reachable by breaking through a galactic core.'}
        </div>`;
      return;
    }

    const { cur, sel, d, inRange, range, gated } = this.jumpInfo();
    const known = state.visitedSystems[sel.id];
    const routeTxt = this.route
      ? `<span>Route: <em>${this.route.length} jump${this.route.length === 1 ? '' : 's'}</em></span>`
      : (this.selected !== this.currentId ? '<span style="color:#ff7676">No route with current tech</span>' : '');

    if (sel.id === cur.id) {
      el.innerHTML = `<h3>${sel.name}</h3><div class="cols">
        <span>Current system</span><span>${sel.starClass}</span>
        <span>${sel.planetCount} planets</span><span>${sel.economy}</span>
        <span>Jump range <em>${range} ly</em></span>
        <span>To core ${sel.distFromCore.toFixed(0)} ly</span></div>`;
      return;
    }

    el.innerHTML = `
      <h3>${known ? sel.name : 'UNCHARTED SYSTEM'}</h3>
      <div class="cols">
        <span style="color:${sel.starColor}">${sel.starClass}</span>
        <span>${known ? sel.planetCount + ' planets' : '? planets'}</span>
        <span>${known ? sel.economy + ' · ' + sel.wealth : 'unknown economy'}</span>
        <span>Conflict: ${known ? sel.danger : '?'}</span>
        <span>Distance: <em>${d.toFixed(1)} ly</em></span>
        <span>To core: ${sel.distFromCore.toFixed(0)} ly</span>
        ${routeTxt}
        ${sel.wormholeTo != null ? '<span style="color:#7d5bff">wormhole</span>' : ''}
        ${sel.intergalactic ? '<span style="color:#ffd166">INTERGALACTIC GATE</span>' : ''}
        ${sel.hasBlackHole ? '<span style="color:#c48fff">black hole</span>' : ''}
        ${sel.hasAnomaly ? '<span style="color:#8fd6ff">anomaly</span>' : ''}
        ${sel.isCore ? '<span style="color:#ffd9a0">GALACTIC CORE</span>' : ''}
      </div>
      <div style="margin-top:6px">${gated
        ? `<span style="color:#ff7676">Requires the ${DRIVES[sel.drive].label} — buy it at a Space Anomaly with nanites</span>`
        : inRange
          ? (state.inventory.warpcell > 0
            ? '<em>ENTER</em> to warp — costs 1 warp cell'
            : '<span style="color:#ff7676">No warp cells. Craft one with C or buy one at a station.</span>')
          : this.route
            ? `<em>ENTER</em> to jump to the next hop: <b>${state.visitedSystems[this.route[0]] ? this.galaxy.systems[this.route[0]].name : 'uncharted system'}</b>`
            : `<span style="color:#ffb24d">Out of range (max ${range} ly)</span>`}
      </div>`;
  }

  // ENTER: warp straight there, or take the next hop of the plotted route.
  tryWarp() {
    if (this.view === 'intergalactic') return false;
    const { sel, inRange, d, gated } = this.jumpInfo();
    if (gated) return false;
    if (state.inventory.warpcell <= 0) return false;

    if (inRange) {
      state.inventory.warpcell -= 1;
      state.lightYears += d;
      this.hide();
      this.onWarp(sel);
      return true;
    }
    if (this.route && this.route.length) {
      const nextId = this.route[0];
      const next = this.galaxy.systems[nextId];
      const cur = this.galaxy.systems[this.currentId];
      // wormhole hop is free of range limits
      state.inventory.warpcell -= 1;
      state.lightYears += distance(cur.pos, next.pos);
      this.hide();
      this.onWarp(next);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- drawing
  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (this.view === 'intergalactic') return this.drawGalaxies();

    const cur = this.galaxy.systems[this.currentId];
    const curP = this.project(cur);

    const [c1, c2] = this.galaxy.hue;
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.5);
    g.addColorStop(0, 'rgba(255,225,190,0.20)');
    g.addColorStop(0.4, this.hexA(c2, 0.12));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // jump range ellipse
    ctx.strokeStyle = 'rgba(99,230,255,0.25)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.ellipse(curP.x, curP.y, stats.jumpRange * curP.s, stats.jumpRange * curP.s * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // wormhole links
    ctx.lineWidth = 1.1 * devicePixelRatio;
    for (const link of this.galaxy.wormholes) {
      const a = this.project(this.galaxy.systems[link.a]);
      const b = this.project(this.galaxy.systems[link.b]);
      const known = state.visitedSystems[link.a] || state.visitedSystems[link.b];
      ctx.strokeStyle = known ? 'rgba(125,91,255,0.55)' : 'rgba(125,91,255,0.16)';
      ctx.beginPath();
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.18;
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
    }

    // plotted route
    if (this.route && this.route.length) {
      ctx.strokeStyle = 'rgba(157,255,196,0.9)';
      ctx.lineWidth = 1.8 * devicePixelRatio;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(curP.x, curP.y);
      for (const id of this.route) {
        const p = this.project(this.galaxy.systems[id]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const s of this.galaxy.systems) {
      const p = this.project(s);
      if (p.x < -60 || p.x > w + 60 || p.y < -60 || p.y > h + 60) continue;
      const visited = state.visitedSystems[s.id];
      const isCur = s.id === this.currentId;
      const isSel = s.id === this.selected;
      const gated = !canWarpTo(s, state.drives);
      const r = (isCur ? 5.5 : visited ? 3.8 : 2.4) * devicePixelRatio;

      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
      grad.addColorStop(0, s.starColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = visited || isCur ? 0.5 : 0.2;
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2); ctx.fill();

      ctx.globalAlpha = gated ? 0.35 : (visited || isCur ? 1 : 0.6);
      ctx.fillStyle = s.starColor;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      if (s.wormholeTo != null || s.intergalactic) {
        ctx.strokeStyle = s.intergalactic ? 'rgba(255,209,102,0.9)' : 'rgba(125,91,255,0.85)';
        ctx.lineWidth = 1.2 * devicePixelRatio;
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 5 * devicePixelRatio, 0, Math.PI * 2); ctx.stroke();
      }
      if (s.hasBlackHole) {
        ctx.strokeStyle = 'rgba(196,143,255,0.7)';
        ctx.lineWidth = 1 * devicePixelRatio;
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 9 * devicePixelRatio, 0.6, 2.4); ctx.stroke();
      }
      if (s.isCore) {
        ctx.strokeStyle = '#ffd9a0';
        ctx.lineWidth = 2 * devicePixelRatio;
        ctx.beginPath(); ctx.arc(p.x, p.y, 14 * devicePixelRatio, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffd9a0';
        ctx.font = `${11 * devicePixelRatio}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('THE CORE', p.x, p.y + 28 * devicePixelRatio);
      }
      if (isCur) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4 * devicePixelRatio;
        ctx.beginPath(); ctx.arc(p.x, p.y, 11 * devicePixelRatio, 0, Math.PI * 2); ctx.stroke();
      }
      if (isSel) {
        ctx.strokeStyle = '#ff9f43';
        ctx.lineWidth = 1.6 * devicePixelRatio;
        const q = 13 * devicePixelRatio;
        ctx.beginPath(); ctx.rect(p.x - q, p.y - q, q * 2, q * 2); ctx.stroke();
        ctx.fillStyle = '#ffd9a0';
        ctx.font = `${13 * devicePixelRatio}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(visited ? s.name : 'UNCHARTED', p.x, p.y - 22 * devicePixelRatio);
      }
    }

    this.drawLegend(ctx, w, h);
  }

  drawLegend(ctx, w, h) {
    const items = [
      ['Wormhole', '#7d5bff'],
      ['Intergalactic gate', '#ffd166'],
      ['Black hole', '#c48fff'],
      ['Plotted route', '#9dffc4'],
      ['Locked (needs drive)', '#5a6472'],
    ];
    ctx.font = `${10 * devicePixelRatio}px ui-monospace, monospace`;
    ctx.textAlign = 'left';
    items.forEach(([label, color], i) => {
      const y = 22 * devicePixelRatio + i * 16 * devicePixelRatio;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(18 * devicePixelRatio, y - 3 * devicePixelRatio, 3.5 * devicePixelRatio, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,230,245,0.7)';
      ctx.fillText(label, 30 * devicePixelRatio, y);
    });

    const drives = Object.entries(DRIVES)
      .map(([k, d]) => `${state.drives[k] ? '●' : '○'} ${d.label}`)
      .join('   ');
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(200,230,245,0.75)';
    ctx.fillText(drives, w - 18 * devicePixelRatio, 22 * devicePixelRatio);
  }

  drawGalaxies() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const cols = 4;
    const cellW = w / cols;
    const cellH = h / Math.ceil(GALAXIES.length / cols);
    this._galaxyHits = [];

    GALAXIES.forEach((g, i) => {
      const cx = (i % cols) * cellW + cellW / 2;
      const cy = Math.floor(i / cols) * cellH + cellH / 2;
      const visited = state.visitedGalaxies.includes(i);
      const isCur = i === state.galaxyIndex;
      const R = Math.min(cellW, cellH) * 0.3;
      this._galaxyHits.push({ index: i, x: cx, y: cy });

      // little procedural portrait of the galaxy shape
      ctx.save();
      ctx.globalAlpha = visited ? 1 : 0.35;
      for (let k = 0; k < 220; k++) {
        const t = k / 220;
        let x, y;
        if (g.type === 'ring') {
          const a = t * Math.PI * 2 * 7;
          const rr = R * (0.75 + Math.sin(k) * 0.06);
          x = Math.cos(a) * rr; y = Math.sin(a) * rr * 0.42;
        } else if (g.type === 'elliptical') {
          const a = k * 2.39996;
          const rr = R * Math.sqrt(t);
          x = Math.cos(a) * rr * 1.25; y = Math.sin(a) * rr * 0.55;
        } else if (g.type === 'irregular') {
          const c = k % 6;
          x = Math.cos(c * 1.7) * R * 0.6 + Math.cos(k * 3.7) * R * 0.28;
          y = (Math.sin(c * 1.7) * R * 0.6 + Math.sin(k * 2.9) * R * 0.28) * 0.5;
        } else {
          const arms = g.arms || 3;
          const arm = k % arms;
          const a = t * Math.PI * 3 + (arm / arms) * Math.PI * 2;
          const rr = (g.type === 'barred' && t < 0.25) ? R * 0.25 : R * t;
          x = Math.cos(a) * rr; y = Math.sin(a) * rr * 0.42;
          if (g.type === 'barred' && t < 0.25) { x = (t - 0.125) * R * 3; y *= 0.3; }
        }
        ctx.fillStyle = k % 5 === 0 ? g.hue[0] : g.hue[1];
        ctx.fillRect(cx + x, cy + y, 1.6 * devicePixelRatio, 1.6 * devicePixelRatio);
      }
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.font = `${11 * devicePixelRatio}px ui-monospace, monospace`;
      ctx.fillStyle = isCur ? '#ffd9a0' : visited ? '#dff3ff' : 'rgba(190,225,245,0.45)';
      ctx.fillText(visited ? g.name : '???', cx, cy + R + 20 * devicePixelRatio);
      if (isCur) {
        ctx.strokeStyle = '#ffd9a0';
        ctx.lineWidth = 1.4 * devicePixelRatio;
        ctx.beginPath(); ctx.arc(cx, cy, R + 14 * devicePixelRatio, 0, Math.PI * 2); ctx.stroke();
      }
      if (this.previewGalaxy === i) {
        ctx.strokeStyle = '#ff9f43';
        ctx.lineWidth = 1.6 * devicePixelRatio;
        const q = R + 18 * devicePixelRatio;
        ctx.beginPath(); ctx.rect(cx - q, cy - q, q * 2, q * 2); ctx.stroke();
      }
    });
  }

  hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  tick(dt) {
    if (!this.open) return;
    let moved = false;
    if (input.keys.has('KeyQ')) { this.rot -= dt * 0.6; moved = true; }
    if (input.keys.has('KeyE')) { this.rot += dt * 0.6; moved = true; }
    if (this.autoRot && !moved) this.rot += dt * 0.04;
    this.draw();
  }
}
