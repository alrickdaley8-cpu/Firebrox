const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.cssW = 1;
    this.cssH = 1;
    this.colors = [];
    this.sprites = [];
    this.dimSprites = [];
    this.size = 3.4;
    this.focus = -1;
    this.bg = '#000000';
  }

  setPalette(colors) {
    this.colors = colors.map((c) => c.slice());
    this.#rebuildSprites();
  }

  resize(cssW, cssH) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(cssW));
    const h = Math.max(1, Math.floor(cssH));
    this.dpr = dpr;
    this.cssW = w;
    this.cssH = h;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.#rebuildSprites();
  }

  render(sim) {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, w, h);

    const n = sim.n;
    if (n === 0) return;

    const radius = Math.max(1.4, this.size * dpr);
    const size = radius * 2;
    const x = sim.x;
    const y = sim.y;
    const type = sim.type;
    const focus = this.focus;
    const sprites = this.sprites;
    const dimSprites = this.dimSprites;

    ctx.imageSmoothingEnabled = true;
    for (let i = 0; i < n; i++) {
      const t = type[i];
      const sprite = focus !== -1 && t !== focus ? dimSprites[t] : sprites[t];
      if (!sprite) continue;
      ctx.drawImage(sprite, x[i] * dpr - radius, y[i] * dpr - radius, size, size);
    }

    if (sim.mouse.active && sim.mouse.mode !== 'off') {
      const m = sim.mouse;
      ctx.beginPath();
      ctx.arc(m.x * dpr, m.y * dpr, m.radius * dpr, 0, TAU);
      const color =
        m.mode === 'repel' ? '255, 61, 107' : m.mode === 'spawn' ? '122, 240, 255' : '61, 255, 176';
      ctx.strokeStyle = `rgba(${color}, 0.45)`;
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();
    }
  }

  capture() {
    return this.canvas.toDataURL('image/png');
  }

  #rebuildSprites() {
    this.sprites = this.colors.map((c) => makeDot(c[0], c[1], c[2], 1));
    this.dimSprites = this.colors.map((c) => makeDot(c[0], c[1], c[2], 0.18));
  }
}

function makeDot(r, g, b, alpha) {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.5, s * 0.48, 0, TAU);
  ctx.fill();
  return c;
}
