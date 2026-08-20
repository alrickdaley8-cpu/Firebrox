export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.dpr = 1;
    this.cssW = 1;
    this.cssH = 1;
    this.sprites = [];
    this.dimSprites = [];
    this.colors = [];
    this.glow = 1;
    this.trail = 0.72;
    this.focus = -1;
    this.bg = '#07070b';
  }

  setPalette(colors) {
    this.colors = colors.map((c) => c.slice());
    this.#rebuildSprites();
  }

  resize(cssW, cssH) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.cssW = cssW;
    this.cssH = cssH;
    this.canvas.width = Math.max(1, Math.floor(cssW * dpr));
    this.canvas.height = Math.max(1, Math.floor(cssH * dpr));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.#rebuildSprites();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = this.bg;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render(sim) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = this.dpr;
    const trail = this.trail;
    const fade = 1 - trail * 0.94;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = fade >= 0.98 ? this.bg : `rgba(7, 7, 11, ${fade})`;
    ctx.fillRect(0, 0, w, h);

    const n = sim.n;
    if (n === 0) return;

    const sprites = this.sprites;
    const dimSprites = this.dimSprites;
    const focus = this.focus;
    const size = 17 * dpr * this.glow;
    const half = size * 0.5;
    const x = sim.x;
    const y = sim.y;
    const type = sim.type;
    const species = sim.species;

    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;

    if (focus === -1) {
      for (let i = 0; i < n; i++) {
        const t = type[i];
        const sprite = sprites[t];
        if (!sprite) continue;
        ctx.drawImage(sprite, x[i] * dpr - half, y[i] * dpr - half, size, size);
      }
    } else {
      const dim = size * 0.82;
      const dimHalf = dim * 0.5;
      for (let i = 0; i < n; i++) {
        const t = type[i];
        if (t === focus) {
          const sprite = sprites[t];
          if (sprite) ctx.drawImage(sprite, x[i] * dpr - half, y[i] * dpr - half, size, size);
        } else {
          const sprite = dimSprites[t];
          if (sprite) ctx.drawImage(sprite, x[i] * dpr - dimHalf, y[i] * dpr - dimHalf, dim, dim);
        }
      }
    }

    if (sim.mouse.active && sim.mouse.mode !== 'off') {
      this.#drawMouse(sim);
    }

    void species;
  }

  capture() {
    return this.canvas.toDataURL('image/png');
  }

  #drawMouse(sim) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const m = sim.mouse;
    const r = m.radius * dpr;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.beginPath();
    ctx.arc(m.x * dpr, m.y * dpr, r, 0, Math.PI * 2);
    const color =
      m.mode === 'repel' ? '255, 61, 107' : m.mode === 'spawn' ? '122, 240, 255' : '61, 255, 176';
    ctx.strokeStyle = `rgba(${color}, 0.35)`;
    ctx.lineWidth = 1.25 * dpr;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(m.x * dpr, m.y * dpr, r * 0.18, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${color}, 0.7)`;
    ctx.stroke();
    ctx.restore();
  }

  #rebuildSprites() {
    this.sprites = this.colors.map((c) => makeSprite(c[0], c[1], c[2], 1));
    this.dimSprites = this.colors.map((c) => makeSprite(c[0], c[1], c[2], 0.16));
  }
}

function makeSprite(r, g, b, alpha) {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(s * 0.5, s * 0.5, 0, s * 0.5, s * 0.5, s * 0.5);
  grd.addColorStop(0, `rgba(255, 255, 255, ${0.95 * alpha})`);
  grd.addColorStop(0.1, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  grd.addColorStop(0.32, `rgba(${r}, ${g}, ${b}, ${0.5 * alpha})`);
  grd.addColorStop(0.62, `rgba(${r}, ${g}, ${b}, ${0.12 * alpha})`);
  grd.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, s, s);
  return c;
}
