// Tiny WebAudio SFX + ambience. No assets, all synthesised.
let ctx = null;
let master = null;
let ambient = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}

export const audio = {
  resume() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  },

  blip(freq = 660, dur = 0.09, type = 'sine', gain = 0.5) {
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(master);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  },

  sweep(from, to, dur = 0.5, type = 'sawtooth', gain = 0.32) {
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2200;
    o.type = type;
    o.frequency.setValueAtTime(from, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(f).connect(g).connect(master);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  },

  pickup() { this.blip(880, 0.08, 'triangle', 0.4); setTimeout(() => this.blip(1320, 0.1, 'triangle', 0.3), 70); },
  scan() { this.sweep(300, 1800, 0.6, 'sine', 0.22); },
  discovery() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'sine', 0.3), i * 110)); },
  warp() { this.sweep(90, 2400, 1.4, 'sawtooth', 0.3); },
  land() { this.sweep(700, 90, 1.2, 'sine', 0.3); },
  error() { this.blip(180, 0.22, 'square', 0.25); },

  // low engine hum whose pitch tracks speed
  hum(level) {
    const c = ensure();
    if (!c) return;
    if (!ambient) {
      const o = c.createOscillator();
      const o2 = c.createOscillator();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      o.type = 'sawtooth'; o.frequency.value = 52;
      o2.type = 'sine'; o2.frequency.value = 78;
      g.gain.value = 0;
      o.connect(f); o2.connect(f);
      f.connect(g).connect(master);
      o.start(); o2.start();
      ambient = { o, o2, g };
    }
    const t = c.currentTime;
    ambient.g.gain.setTargetAtTime(0.05 + level * 0.16, t, 0.25);
    ambient.o.frequency.setTargetAtTime(46 + level * 90, t, 0.3);
    ambient.o2.frequency.setTargetAtTime(70 + level * 130, t, 0.3);
  },

  quiet() {
    if (ambient && ctx) ambient.g.gain.setTargetAtTime(0.0, ctx.currentTime, 0.3);
  },
};
