const HUD = (() => {
  let canvas, ctx, w, h, t = 0;
  let radar, rctx, sweep = 0;
  let wave, wctx;
  const particles = [];
  let energy = 0.25;
  let alert = false;
  let rgb = "62,224,255";
  let started = false;
  let hostile = false;

  function resize() {
    if (!canvas) return;
    w = canvas.width = window.innerWidth * devicePixelRatio;
    h = canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }

  function spawn() {
    particles.length = 0;
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        s: 0.2 + Math.random() * 1.5,
        v: 0.00012 + Math.random() * 0.00045,
        a: 0.12 + Math.random() * 0.5
      });
    }
  }

  function hex(n) {
    return n.toString(16).toUpperCase().padStart(2, "0");
  }

  function frame() {
    t += 0.008;
    energy += ((alert ? 0.85 : 0.22) - energy) * 0.04;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const W = window.innerWidth;
    const H = window.innerHeight;

    ctx.strokeStyle = `rgba(${rgb},0.06)`;
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 52) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 52) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    particles.forEach((p) => {
      p.y -= p.v * (0.8 + energy);
      if (p.y < 0) p.y = 1;
      ctx.fillStyle = `rgba(${rgb},${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.s, 0, Math.PI * 2);
      ctx.fill();
    });

    // linking threads
    ctx.strokeStyle = `rgba(${rgb},0.08)`;
    for (let i = 0; i < 6; i++) {
      const y = (Math.sin(t + i) * 0.5 + 0.5) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * 0.3, y + Math.sin(t * 2 + i) * 40, W * 0.7, y - 30, W, y);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(${rgb},0.5)`;
    ctx.lineWidth = 1.4;
    const m = 16, len = 26;
    [
      [m, m, 1, 1],
      [W - m, m, -1, 1],
      [m, H - m, 1, -1],
      [W - m, H - m, -1, -1]
    ].forEach(([x, y, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * len);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * len, y);
      ctx.stroke();
    });

    ctx.restore();
    drawRadar();
    drawWave();
    requestAnimationFrame(frame);
  }

  function drawRadar() {
    if (!radar) return;
    const s = radar.width;
    rctx.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2, r = s / 2 - 8;
    rctx.strokeStyle = `rgba(${rgb},0.28)`;
    rctx.lineWidth = 1;
    [0.33, 0.66, 1].forEach((k) => {
      rctx.beginPath();
      rctx.arc(cx, cy, r * k, 0, Math.PI * 2);
      rctx.stroke();
    });
    rctx.beginPath();
    rctx.moveTo(cx - r, cy); rctx.lineTo(cx + r, cy);
    rctx.moveTo(cx, cy - r); rctx.lineTo(cx, cy + r);
    rctx.stroke();

    sweep += hostile ? 0.05 : 0.025;
    rctx.save();
    rctx.translate(cx, cy);
    rctx.rotate(sweep);
    const g = rctx.createLinearGradient(0, 0, r, 0);
    g.addColorStop(0, `rgba(${rgb},0)`);
    g.addColorStop(1, `rgba(${rgb},0.38)`);
    rctx.fillStyle = g;
    rctx.beginPath();
    rctx.moveTo(0, 0);
    rctx.arc(0, 0, r, 0, 0.75);
    rctx.closePath();
    rctx.fill();
    rctx.restore();

    const count = hostile ? 7 : 3;
    for (let i = 0; i < count; i++) {
      const ang = i * 1.1 + Math.sin(t + i) * (hostile ? 0.4 : 0.05);
      const d = 0.25 + ((i * 37) % 60) / 100;
      const x = cx + Math.cos(ang) * r * d;
      const y = cy + Math.sin(ang) * r * d;
      rctx.fillStyle = hostile && i > 2 ? "#ff4d6a" : (i === 1 ? "#e8b84a" : `rgb(${rgb})`);
      rctx.beginPath();
      rctx.arc(x, y, hostile ? 3.4 : 3, 0, Math.PI * 2);
      rctx.fill();
    }
  }

  function drawWave() {
    if (!wave) return;
    const s = wave.width;
    wctx.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2;
    const rings = 3;
    for (let i = 0; i < rings; i++) {
      const rad = 90 + i * 22 + Math.sin(t * 6 + i) * 6 * energy;
      wctx.strokeStyle = `rgba(${rgb},${0.18 + energy * 0.25 - i * 0.04})`;
      wctx.lineWidth = 1.2;
      wctx.beginPath();
      for (let a = 0; a <= 64; a++) {
        const ang = (a / 64) * Math.PI * 2;
        const wob = Math.sin(ang * 8 + t * 8 + i) * (6 + energy * 18);
        const x = cx + Math.cos(ang) * (rad + wob);
        const y = cy + Math.sin(ang) * (rad + wob);
        if (a === 0) wctx.moveTo(x, y);
        else wctx.lineTo(x, y);
      }
      wctx.closePath();
      wctx.stroke();
    }
  }

  function setMeters(el) {
    if (!el) return;
    const rows = [
      ["ARC REACTOR", 96],
      ["NEURAL NET", 91],
      ["REPULSOR", 74],
      ["COOLANT", 83],
      ["ENCRYPTION", 99],
      ["NANITES", 87]
    ];
    el.innerHTML = rows.map(([name, v]) => `
      <div class="meter" data-base="${v}">
        <label>${name}<b>${v}%</b></label>
        <div class="track"><span style="width:${v}%"></span></div>
      </div>`).join("");
  }

  function jitterMeters() {
    document.querySelectorAll(".meter").forEach((m) => {
      const base = Number(m.dataset.base);
      const v = Math.max(38, Math.min(100, base + (Math.random() * 8 - 4)));
      m.querySelector("b").textContent = Math.round(v) + "%";
      m.querySelector("span").style.width = v + "%";
    });
    const lat = document.getElementById("lat");
    const up = document.getElementById("uplink");
    const cpu = document.getElementById("cpu");
    if (lat) lat.textContent = (7 + Math.floor(Math.random() * 20)) + "ms";
    if (up) up.textContent = (99.05 + Math.random() * 0.9).toFixed(2);
    if (cpu) cpu.textContent = (12 + Math.floor(Math.random() * 28)) + "%";
  }

  function fillDataCols() {
    const L = document.getElementById("data-left");
    const R = document.getElementById("data-right");
    if (!L || !R) return;
    const line = () => Array.from({ length: 18 }, () =>
      hex((Math.random() * 256) | 0) + hex((Math.random() * 256) | 0)
    ).join("\n");
    L.textContent = line();
    R.textContent = line();
  }

  return {
    init() {
      canvas = document.getElementById("hud-canvas");
      ctx = canvas.getContext("2d");
      radar = document.getElementById("radar");
      rctx = radar.getContext("2d");
      wave = document.getElementById("wave");
      wctx = wave.getContext("2d");
      resize();
      spawn();
      if (started) return;
      started = true;
      window.addEventListener("resize", resize);
      setMeters(document.getElementById("meters"));
      fillDataCols();
      setInterval(jitterMeters, 2200);
      setInterval(fillDataCols, 1600);
      requestAnimationFrame(frame);
    },
    setEnergy(v) { energy = Math.max(0.1, Math.min(1, v)); },
    setAlert(on) { alert = !!on; hostile = !!on; },
    setTheme(name) {
      const map = {
        cyan: "62,224,255",
        gold: "232,184,74",
        crimson: "255,77,106",
        stealth: "138,160,170"
      };
      rgb = map[name] || map.cyan;
    }
  };
})();
