const MAX_N = 16384;
const MAX_S = 9;

export class Simulation {
  constructor(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.n = 0;
    this.species = 4;
    this.rMax = 80;
    this.force = 320;
    this.damp = 4.2;
    this.beta = 0.3;
    this.temp = 0;
    this.wrap = true;

    this.x = new Float32Array(MAX_N);
    this.y = new Float32Array(MAX_N);
    this.vx = new Float32Array(MAX_N);
    this.vy = new Float32Array(MAX_N);
    this.ax = new Float32Array(MAX_N);
    this.ay = new Float32Array(MAX_N);
    this.type = new Uint8Array(MAX_N);
    this.mat = new Float32Array(MAX_S * MAX_S);
    this.head = new Int32Array(4);
    this.next = new Int32Array(MAX_N);

    this.mouse = { active: false, x: 0, y: 0, mode: 'attract', strength: 420, radius: 140 };
  }

  resize(width, height) {
    const nw = Math.max(1, width);
    const nh = Math.max(1, height);
    if (nw === this.width && nh === this.height) return;
    const sx = nw / this.width;
    const sy = nh / this.height;
    for (let i = 0; i < this.n; i++) {
      this.x[i] *= sx;
      this.y[i] *= sy;
    }
    this.width = nw;
    this.height = nh;
  }

  setSpecies(count) {
    const next = Math.max(2, Math.min(MAX_S, count | 0));
    if (next === this.species) return;
    const prev = this.species;
    this.species = next;
    if (next > prev) {
      for (let i = 0; i < next; i++) {
        for (let j = 0; j < next; j++) {
          if (i >= prev || j >= prev) this.mat[i * MAX_S + j] = 0;
        }
      }
    }
    for (let i = 0; i < this.n; i++) this.type[i] = i % next;
  }

  setCount(count) {
    const next = Math.max(50, Math.min(MAX_N, count | 0));
    if (next > this.n) {
      for (let i = this.n; i < next; i++) {
        this.x[i] = Math.random() * this.width;
        this.y[i] = Math.random() * this.height;
        this.vx[i] = 0;
        this.vy[i] = 0;
        this.type[i] = i % this.species;
      }
    }
    this.n = next;
  }

  setMatrix(matrix) {
    const s = this.species;
    if (!matrix) return;
    for (let i = 0; i < s; i++) {
      for (let j = 0; j < s; j++) {
        const row = matrix[i];
        const raw = row ? Number(row[j]) : 0;
        this.mat[i * MAX_S + j] = clamp(Number.isFinite(raw) ? raw : 0, -1, 1);
      }
    }
  }

  getMatrix() {
    const s = this.species;
    const out = [];
    for (let i = 0; i < s; i++) {
      const row = [];
      for (let j = 0; j < s; j++) row.push(this.mat[i * MAX_S + j]);
      out.push(row);
    }
    return out;
  }

  matrixAt(i, j) {
    return this.mat[i * MAX_S + j];
  }

  setMatrixAt(i, j, value) {
    if (i < 0 || j < 0 || i >= this.species || j >= this.species) return;
    this.mat[i * MAX_S + j] = clamp(value, -1, 1);
  }

  respawn() {
    const n = this.n;
    const s = this.species;
    const w = this.width;
    const h = this.height;
    for (let i = 0; i < n; i++) {
      this.x[i] = Math.random() * w;
      this.y[i] = Math.random() * h;
      this.vx[i] = 0;
      this.vy[i] = 0;
      this.type[i] = i % s;
    }
  }

  spawnAt(px, py, amount = 8) {
    const n = this.n;
    if (n === 0) return;
    const w = this.width;
    const h = this.height;
    for (let k = 0; k < amount; k++) {
      const i = (Math.random() * n) | 0;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 18;
      let xi = px + Math.cos(a) * r;
      let yi = py + Math.sin(a) * r;
      if (this.wrap) {
        xi = mod(xi, w);
        yi = mod(yi, h);
      } else {
        xi = clamp(xi, 0, w);
        yi = clamp(yi, 0, h);
      }
      this.x[i] = xi;
      this.y[i] = yi;
      this.vx[i] = Math.cos(a) * 40;
      this.vy[i] = Math.sin(a) * 40;
    }
  }

  step(dt) {
    const n = this.n;
    if (n === 0) return;
    dt = clamp(dt, 0, 0.05);

    const w = this.width;
    const h = this.height;
    const rMax = Math.max(8, this.rMax);
    const rMax2 = rMax * rMax;
    const beta = clamp(this.beta, 0.05, 0.8);
    const invBeta = 1 / beta;
    const inv1b = 1 / Math.max(1e-6, 1 - beta);
    const force = this.force;
    const wrap = this.wrap;
    const x = this.x;
    const y = this.y;
    const vx = this.vx;
    const vy = this.vy;
    const ax = this.ax;
    const ay = this.ay;
    const stride = MAX_S;

    ax.fill(0, 0, n);
    ay.fill(0, 0, n);

    const cols = Math.floor(w / rMax);
    const rows = Math.floor(h / rMax);

    if (cols < 3 || rows < 3 || n < 220) {
      this.#brute(n, rMax2, rMax, beta, invBeta, inv1b, force, wrap, w, h, stride);
    } else {
      this.#grid(n, rMax, rMax2, beta, invBeta, inv1b, force, wrap, w, h, cols, rows, stride);
    }

    const mouse = this.mouse;
    if (mouse.active && (mouse.mode === 'attract' || mouse.mode === 'repel')) {
      const sign = mouse.mode === 'attract' ? 1 : -1;
      const mr = Math.max(8, mouse.radius);
      const mr2 = mr * mr;
      const ms = mouse.strength * sign;
      const mx = mouse.x;
      const my = mouse.y;
      for (let i = 0; i < n; i++) {
        let dx = mx - x[i];
        let dy = my - y[i];
        if (wrap) {
          if (dx > w * 0.5) dx -= w;
          else if (dx < -w * 0.5) dx += w;
          if (dy > h * 0.5) dy -= h;
          else if (dy < -h * 0.5) dy += h;
        }
        const d2 = dx * dx + dy * dy;
        if (d2 < mr2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = ms * (1 - d / mr);
          ax[i] += (dx / d) * f;
          ay[i] += (dy / d) * f;
        }
      }
    }

    const friction = Math.exp(-Math.max(0, this.damp) * dt);
    const temp = this.temp;
    const noise = temp > 0 ? temp * Math.sqrt(dt * 60) : 0;
    const maxSpeed = Math.max(240, rMax * 18);
    const maxSpeed2 = maxSpeed * maxSpeed;

    for (let i = 0; i < n; i++) {
      let vxi = (vx[i] + ax[i] * dt) * friction;
      let vyi = (vy[i] + ay[i] * dt) * friction;
      if (noise > 0) {
        vxi += (Math.random() - 0.5) * noise;
        vyi += (Math.random() - 0.5) * noise;
      }
      const sp2 = vxi * vxi + vyi * vyi;
      if (sp2 > maxSpeed2) {
        const s = maxSpeed / Math.sqrt(sp2);
        vxi *= s;
        vyi *= s;
      }
      vx[i] = vxi;
      vy[i] = vyi;
      let xi = x[i] + vxi * dt;
      let yi = y[i] + vyi * dt;
      if (wrap) {
        xi = mod(xi, w);
        yi = mod(yi, h);
      } else {
        if (xi < 0) {
          xi = 0;
          vx[i] *= -0.46;
        } else if (xi > w) {
          xi = w;
          vx[i] *= -0.46;
        }
        if (yi < 0) {
          yi = 0;
          vy[i] *= -0.46;
        } else if (yi > h) {
          yi = h;
          vy[i] *= -0.46;
        }
      }
      x[i] = xi;
      y[i] = yi;
    }
  }

  #brute(n, rMax2, rMax, beta, invBeta, inv1b, force, wrap, w, h, stride) {
    const x = this.x;
    const y = this.y;
    const ax = this.ax;
    const ay = this.ay;
    const type = this.type;
    const mat = this.mat;
    for (let i = 0; i < n; i++) {
      const px = x[i];
      const py = y[i];
      const base = type[i] * stride;
      let aix = 0;
      let aiy = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        let dx = x[j] - px;
        let dy = y[j] - py;
        if (wrap) {
          if (dx > w * 0.5) dx -= w;
          else if (dx < -w * 0.5) dx += w;
          if (dy > h * 0.5) dy -= h;
          else if (dy < -h * 0.5) dy += h;
        }
        const d2 = dx * dx + dy * dy;
        if (d2 >= rMax2 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const r = d / rMax;
        const a = mat[base + type[j]];
        const f = forceOf(r, a, beta, invBeta, inv1b) * force;
        const invd = 1 / d;
        aix += dx * invd * f;
        aiy += dy * invd * f;
      }
      ax[i] = aix;
      ay[i] = aiy;
    }
  }

  #grid(n, rMax, rMax2, beta, invBeta, inv1b, force, wrap, w, h, cols, rows, stride) {
    const x = this.x;
    const y = this.y;
    const ax = this.ax;
    const ay = this.ay;
    const type = this.type;
    const mat = this.mat;
    const next = this.next;
    const cellCount = cols * rows;
    if (this.head.length < cellCount) this.head = new Int32Array(cellCount);
    const hd = this.head;
    hd.fill(-1, 0, cellCount);

    const cellW = w / cols;
    const cellH = h / rows;
    const invCellW = 1 / cellW;
    const invCellH = 1 / cellH;

    for (let i = 0; i < n; i++) {
      let cx = Math.floor(x[i] * invCellW);
      let cy = Math.floor(y[i] * invCellH);
      if (cx < 0) cx = 0;
      else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0;
      else if (cy >= rows) cy = rows - 1;
      const idx = cy * cols + cx;
      next[i] = hd[idx];
      hd[idx] = i;
    }

    for (let i = 0; i < n; i++) {
      const px = x[i];
      const py = y[i];
      const base = type[i] * stride;
      let cx = Math.floor(px * invCellW);
      let cy = Math.floor(py * invCellH);
      if (cx < 0) cx = 0;
      else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0;
      else if (cy >= rows) cy = rows - 1;
      let aix = 0;
      let aiy = 0;

      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          let nx = cx + ox;
          let ny = cy + oy;
          let offX = 0;
          let offY = 0;
          if (wrap) {
            if (nx < 0) {
              nx += cols;
              offX = -w;
            } else if (nx >= cols) {
              nx -= cols;
              offX = w;
            }
            if (ny < 0) {
              ny += rows;
              offY = -h;
            } else if (ny >= rows) {
              ny -= rows;
              offY = h;
            }
          } else if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
            continue;
          }
          let j = hd[ny * cols + nx];
          while (j !== -1) {
            if (j !== i) {
              const dx = x[j] + offX - px;
              const dy = y[j] + offY - py;
              const d2 = dx * dx + dy * dy;
              if (d2 < rMax2 && d2 > 1e-6) {
                const d = Math.sqrt(d2);
                const r = d / rMax;
                const a = mat[base + type[j]];
                const f = forceOf(r, a, beta, invBeta, inv1b) * force;
                const invd = 1 / d;
                aix += dx * invd * f;
                aiy += dy * invd * f;
              }
            }
            j = next[j];
          }
        }
      }
      ax[i] = aix;
      ay[i] = aiy;
    }
  }
}

function forceOf(r, a, beta, invBeta, inv1b) {
  if (r < beta) return r * invBeta - 1;
  return a * (1 - Math.abs(2 * r - 1 - beta) * inv1b);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function mod(v, m) {
  return ((v % m) + m) % m;
}
