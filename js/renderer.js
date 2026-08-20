const TAU = Math.PI * 2;

const VS = `
attribute vec2 a_pos;
attribute vec3 a_color;
uniform vec2 u_res;
uniform float u_size;
varying vec3 v_color;
void main() {
  vec2 clip = (a_pos / u_res) * 2.0 - 1.0;
  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
  gl_PointSize = u_size;
  v_color = a_color;
}
`;

const FS = `
precision mediump float;
varying vec3 v_color;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = dot(p, p);
  if (d > 1.0) discard;
  float alpha = 1.0 - smoothstep(0.78, 1.0, d);
  gl_FragColor = vec4(v_color, alpha);
}
`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.dpr = 1;
    this.cssW = 1;
    this.cssH = 1;
    this.colors = [];
    this.colorF = [];
    this.size = 3.4;
    this.focus = -1;
    this.bg = '#000000';
    this.gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    this.useGL = false;
    this.ctx = null;
    this.buf = new Float32Array(0);
    if (this.gl) this.useGL = this.#initGL(this.gl);
    if (!this.useGL) {
      this.gl = null;
      this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    }
  }

  setPalette(colors) {
    this.colors = colors.map((c) => c.slice());
    this.colorF = this.colors.map((c) => [c[0] / 255, c[1] / 255, c[2] / 255]);
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
    if (this.useGL) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  render(sim) {
    if (this.useGL) this.#renderGL(sim);
    else this.#render2D(sim);
  }

  capture() {
    return this.canvas.toDataURL('image/png');
  }

  #initGL(gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, VS);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    this.prog = prog;
    this.aPos = gl.getAttribLocation(prog, 'a_pos');
    this.aColor = gl.getAttribLocation(prog, 'a_color');
    this.uRes = gl.getUniformLocation(prog, 'u_res');
    this.uSize = gl.getUniformLocation(prog, 'u_size');
    this.vbo = gl.createBuffer();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    return true;
  }

  #renderGL(sim) {
    const gl = this.gl;
    const n = sim.n;
    const dpr = this.dpr;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (n === 0) return;

    const stride = 5;
    if (this.buf.length < n * stride) this.buf = new Float32Array(n * stride);
    const buf = this.buf;
    const x = sim.x;
    const y = sim.y;
    const type = sim.type;
    const cols = this.colorF;
    const focus = this.focus;
    let w = 0;
    for (let i = 0; i < n; i++) {
      const t = type[i];
      const c = cols[t];
      if (!c) continue;
      const dim = focus !== -1 && t !== focus;
      buf[w++] = x[i] * dpr;
      buf[w++] = y[i] * dpr;
      const k = dim ? 0.18 : 1;
      buf[w++] = c[0] * k;
      buf[w++] = c[1] * k;
      buf[w++] = c[2] * k;
    }
    const drawn = (w / stride) | 0;

    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, drawn * stride), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, stride * 4, 0);
    gl.enableVertexAttribArray(this.aColor);
    gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, stride * 4, 8);
    gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uSize, Math.max(2, this.size * 2 * dpr));
    gl.drawArrays(gl.POINTS, 0, drawn);
  }

  #render2D(sim) {
    const ctx = this.ctx;
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

    const radius = Math.max(1.1, this.size * dpr);
    const x = sim.x;
    const y = sim.y;
    const type = sim.type;
    const colors = this.colors;
    const focus = this.focus;
    const species = sim.species;

    ctx.imageSmoothingEnabled = true;
    for (let t = 0; t < species; t++) {
      const c = colors[t];
      if (!c) continue;
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
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

    if (sim.mouse.active && sim.mouse.mode !== 'off') this.#drawMouse(sim);
  }

  #drawMouse(sim) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const m = sim.mouse;
    const r = m.radius * dpr;
    ctx.beginPath();
    ctx.arc(m.x * dpr, m.y * dpr, r, 0, TAU);
    const color =
      m.mode === 'repel' ? '255, 61, 107' : m.mode === 'spawn' ? '122, 240, 255' : '61, 255, 176';
    ctx.strokeStyle = `rgba(${color}, 0.4)`;
    ctx.lineWidth = 1.2 * dpr;
    ctx.stroke();
  }
}

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
