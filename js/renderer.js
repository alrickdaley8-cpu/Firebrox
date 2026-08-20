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
    const w = Math.max(canvas.clientWidth || 0, window.innerWidth || 0, 800);
    const h = Math.max(canvas.clientHeight || 0, window.innerHeight || 0, 600);
    this.resize(w, h);
  }

  setPalette(colors) {
    this.colors = (colors || []).map((c) => [c[0] | 0, c[1] | 0, c[2] | 0]);
    this.css = this.colors.map((c) => `rgb(${c[0]},${c[1]},${c[2]})`);
  }

  resize(cssW, cssH) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.floor(cssW));
    const h = Math.max(2, Math.floor(cssH));
    this.dpr = dpr;
    this.cssW = w;
    this.cssH = h;
    this.canvas.width = Math.max(2, Math.floor(w * dpr));
    this.canvas.height = Math.max(2, Math.floor(h * dpr));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  render(sim) {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, w, h);

    const n = sim.n;
    if (n <= 0) return;

    const scaleX = w / Math.max(1, sim.width);
    const scaleY = h / Math.max(1, sim.height);
    const radius = Math.max(2, this.size * this.dpr);
    const diam = radius * 2;
    const x = sim.x;
    const y = sim.y;
    const type = sim.type;
    const focus = this.focus;
    const species = sim.species;

    if (!this.css.length) {
      this.setPalette([
        [255, 77, 46],
        [122, 240, 255],
        [61, 255, 176],
        [255, 206, 74],
        [180, 90, 255],
        [255, 110, 210],
        [80, 190, 255],
        [210, 255, 70],
        [255, 130, 90],
      ]);
    }

    for (let t = 0; t < species; t++) {
      ctx.fillStyle = this.css[t] || '#ff4d2e';
      ctx.globalAlpha = focus !== -1 && t !== focus ? 0.18 : 1;
      for (let i = 0; i < n; i++) {
        if (type[i] !== t) continue;
        ctx.fillRect(x[i] * scaleX - radius, y[i] * scaleY - radius, diam, diam);
      }
    }
    ctx.globalAlpha = 1;
  }

  capture() {
    try {
      return this.canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }
}
