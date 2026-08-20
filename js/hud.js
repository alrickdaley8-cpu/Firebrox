const HUD = (() => {
  let canvas, ctx, w, h, t = 0;
  let radar, rctx, sweep = 0;
  const particles = [];

  function resize() {
    w = canvas.width = window.innerWidth * devicePixelRatio;
    h = canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }

  function spawn() {
    particles.length = 0;
    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        s: 0.2 + Math.random() * 1.4,
        v: 0.00015 + Math.random() * 0.0004,
        a: 0.15 + Math.random() * 0.45
      });
    }
  }

  function frame() {
    t += 0.008;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const W = window.innerWidth;
    const H = window.innerHeight;

    ctx.strokeStyle = "rgba(62,224,255,0.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    particles.forEach((p) => {
      p.y -= p.v;
      if (p.y < 0) p.y = 1;
      ctx.fillStyle = `rgba(62,224,255,${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.s, 0, Math.PI * 2);
      ctx.fill();
    });

    // corner brackets
    ctx.strokeStyle = "rgba(62,224,255,0.45)";
    ctx.lineWidth = 1.4;
    const m = 18, len = 28;
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
    requestAnimationFrame(frame);
  }

  function drawRadar() {
    if (!radar) return;
    const s = radar.width;
    rctx.clearRect(0, 0, s, s);
    const cx = s / 2, cy = s / 2, r = s / 2 - 8;
    rctx.strokeStyle = "rgba(62,224,255,0.25)";
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

    sweep += 0.025;
    const grd = rctx.createConicalGradient
      ? null
      : null;
    rctx.save();
    rctx.translate(cx, cy);
    rctx.rotate(sweep);
    const g = rctx.createLinearGradient(0, 0, r, 0);
    g.addColorStop(0, "rgba(62,224,255,0)");
    g.addColorStop(1, "rgba(62,224,255,0.35)");
    rctx.fillStyle = g;
    rctx.beginPath();
    rctx.moveTo(0, 0);
    rctx.arc(0, 0, r, 0, 0.7);
    rctx.closePath();
    rctx.fill();
    rctx.restore();

    // blips
    const blips = [
      { a: 0.6, d: 0.45 },
      { a: 2.2, d: 0.72 },
      { a: 4.1, d: 0.3 }
    ];
    blips.forEach((b, i) => {
      const ang = b.a + Math.sin(t + i) * 0.05;
      const x = cx + Math.cos(ang) * r * b.d;
      const y = cy + Math.sin(ang) * r * b.d;
      rctx.fillStyle = i === 1 ? "#e8b84a" : "#3ee0ff";
      rctx.beginPath();
      rctx.arc(x, y, 3, 0, Math.PI * 2);
      rctx.fill();
    });
  }

  function setMeters(el) {
    const rows = [
      ["ARC REACTOR", 96],
      ["NEURAL NET", 88],
      ["REPULSOR", 74],
      ["COOLANT", 81],
      ["ENCRYPTION", 99]
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
      const v = Math.max(40, Math.min(100, base + (Math.random() * 8 - 4)));
      m.querySelector("b").textContent = Math.round(v) + "%";
      m.querySelector("span").style.width = v + "%";
    });
    const lat = document.getElementById("lat");
    const up = document.getElementById("uplink");
    if (lat) lat.textContent = (8 + Math.floor(Math.random() * 18)) + "ms";
    if (up) up.textContent = (99.1 + Math.random() * 0.8).toFixed(2);
  }

  let started = false;

  return {
    init() {
      canvas = document.getElementById("hud-canvas");
      ctx = canvas.getContext("2d");
      radar = document.getElementById("radar");
      rctx = radar.getContext("2d");
      resize();
      spawn();
      if (started) return;
      started = true;
      window.addEventListener("resize", resize);
      setMeters(document.getElementById("meters"));
      setInterval(jitterMeters, 2200);
      requestAnimationFrame(frame);
    }
  };
})();
