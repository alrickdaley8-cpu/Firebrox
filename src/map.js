// Galaxy map overlay: pick a star, warp to it.
import { state } from './state.js';
import { distance } from './universe.js';

const MAX_JUMP = 220;   // map units per warp

export class GalaxyMap {
  constructor(galaxy, onWarp) {
    this.galaxy = galaxy;
    this.onWarp = onWarp;
    this.canvas = document.getElementById('map-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.selected = null;
    this.open = false;
    this.rot = 0;

    this.canvas.addEventListener('click', (e) => this.pick(e));
    document.getElementById('map-galaxy').textContent = galaxy.name;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(600, r.width * devicePixelRatio);
    this.canvas.height = Math.max(300, r.height * devicePixelRatio);
  }

  project(sys) {
    const w = this.canvas.width, h = this.canvas.height;
    const s = Math.min(w, h) / 2100;
    const cos = Math.cos(this.rot), sin = Math.sin(this.rot);
    const x = sys.pos.x * cos - sys.pos.z * sin;
    const z = sys.pos.x * sin + sys.pos.z * cos;
    return { x: w / 2 + x * s, y: h / 2 + (z * 0.45 - sys.pos.y * 0.8) * s, s };
  }

  show(currentId) {
    this.open = true;
    this.currentId = currentId;
    this.selected = this.selected ?? currentId;
    document.getElementById('map').classList.remove('hidden');
    this.resize();
    this.draw();
    this.updateInfo();
  }

  hide() {
    this.open = false;
    document.getElementById('map').classList.add('hidden');
  }

  pick(e) {
    const r = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * devicePixelRatio;
    const my = (e.clientY - r.top) * devicePixelRatio;
    let best = null, bestD = 1e9;
    for (const s of this.galaxy.systems) {
      const p = this.project(s);
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best && bestD < 40 * devicePixelRatio) {
      this.selected = best.id;
      this.draw();
      this.updateInfo();
    }
  }

  jumpInfo() {
    const cur = this.galaxy.systems[this.currentId];
    const sel = this.galaxy.systems[this.selected];
    const d = distance(cur.pos, sel.pos);
    return { cur, sel, d, inRange: d <= MAX_JUMP && sel.id !== cur.id };
  }

  updateInfo() {
    const { cur, sel, d, inRange } = this.jumpInfo();
    const known = state.visitedSystems[sel.id];
    const el = document.getElementById('map-info');
    if (sel.id === cur.id) {
      el.innerHTML = `<h3>${sel.name}</h3><div class="cols"><span>Current system</span><span>${sel.starClass} star</span><span>${sel.planetCount} planets</span></div>`;
      return;
    }
    el.innerHTML = `
      <h3>${known ? sel.name : 'UNCHARTED SYSTEM'}</h3>
      <div class="cols">
        <span>${sel.starClass} star</span>
        <span>${known ? sel.planetCount + ' planets' : '? planets'}</span>
        <span>${known ? sel.economy : 'unknown economy'}</span>
        <span>Distance: <em>${d.toFixed(1)} ly</em></span>
      </div>
      <div style="margin-top:6px">${inRange
        ? (state.inventory.warpcell > 0
          ? '<em>ENTER</em> to warp — costs 1 warp cell'
          : '<span style="color:#ff7676">No warp cells. Craft one with C (100 di-hydrogen + 50 ferrite).</span>')
        : '<span style="color:#ffb24d">Out of hyperdrive range (max ' + MAX_JUMP + ' ly)</span>'}
      </div>`;
  }

  tryWarp() {
    const { sel, inRange, d } = this.jumpInfo();
    if (!inRange || state.inventory.warpcell <= 0) return false;
    state.inventory.warpcell -= 1;
    state.lightYears += d;
    this.hide();
    this.onWarp(sel);
    return true;
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // core glow
    const cur = this.galaxy.systems[this.currentId];
    const curP = this.project(cur);
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.45);
    g.addColorStop(0, 'rgba(255,220,180,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // range circle
    const scale = this.project(cur).s;
    ctx.strokeStyle = 'rgba(99,230,255,0.25)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.ellipse(curP.x, curP.y, MAX_JUMP * scale, MAX_JUMP * scale * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const s of this.galaxy.systems) {
      const p = this.project(s);
      const visited = state.visitedSystems[s.id];
      const isCur = s.id === this.currentId;
      const isSel = s.id === this.selected;
      const r = (isCur ? 5 : visited ? 3.6 : 2.4) * devicePixelRatio;
      ctx.globalAlpha = visited || isCur ? 1 : 0.55;
      ctx.fillStyle = s.starColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isCur) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4 * devicePixelRatio;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 * devicePixelRatio, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (isSel) {
        ctx.strokeStyle = '#ff9f43';
        ctx.lineWidth = 1.6 * devicePixelRatio;
        ctx.beginPath();
        ctx.rect(p.x - 12 * devicePixelRatio, p.y - 12 * devicePixelRatio, 24 * devicePixelRatio, 24 * devicePixelRatio);
        ctx.stroke();
        ctx.fillStyle = '#ffd9a0';
        ctx.font = `${13 * devicePixelRatio}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(state.visitedSystems[s.id] ? s.name : 'UNCHARTED', p.x, p.y - 20 * devicePixelRatio);
      }
    }

    // line from current to selected
    if (this.selected !== this.currentId) {
      const sp = this.project(this.galaxy.systems[this.selected]);
      const { inRange } = this.jumpInfo();
      ctx.strokeStyle = inRange ? 'rgba(157,255,196,0.8)' : 'rgba(255,118,118,0.6)';
      ctx.lineWidth = 1.2 * devicePixelRatio;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(curP.x, curP.y);
      ctx.lineTo(sp.x, sp.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  tick(dt) {
    if (!this.open) return;
    this.rot += dt * 0.05;
    this.draw();
  }
}
