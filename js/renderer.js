const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.cssW = 1;
    this.cssH = 1;
    this.colors = [];
    this.css = [];
    this.size = 3.4;
    this.focus = -1;
    this.bg = '#000000';
  }

  setPalette(colors) {
    this.colors = (colors || []).map((c) => c.slice());
    this.css = this.colors.map((c) => `rgb(${c[0]|0},${c[1]|0},${c[2]|0})`);
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

    const radius = Math.max(1.2, this.size * dpr);
    const x = sim.x;
    const y = sim.y;
    const type = sim.type;
    const focus = this.focus;
    const species = sim.species;
    const css = this.css;

    ctx.imageSmoothingEnabled = true;
    for (let t = 0; t < species; t++) {
      const fill = css[t];
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.globalAlpha = focus !== -1 && t !== focus ? 0.16 : 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (type[i] !== t) continue;
        const px = x[i] * dpr;
        const py = y[i] * dpr;
        ctx.moveTo(px + radius, py);
        ctx.arc(px, py, radius, 0, TAU);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

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
    try {
      return this.canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }
}
