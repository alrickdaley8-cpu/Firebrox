// Tiny WebAudio SFX + ambience. No assets, all synthesised.
let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let ambient = null;
let pads = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.8;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.5;
  musicBus.connect(master);
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
    o.connect(g).connect(sfxBus);
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
    o.connect(f).connect(g).connect(sfxBus);
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
      f.connect(g).connect(sfxBus);
      o.start(); o2.start();
      ambient = { o, o2, g };
    }
    const t = c.currentTime;
    ambient.g.gain.setTargetAtTime(0.05 + level * 0.16, t, 0.25);
    ambient.o.frequency.setTargetAtTime(46 + level * 90, t, 0.3);
    ambient.o2.frequency.setTargetAtTime(70 + level * 130, t, 0.3);
  },

  setVolumes(music = 0.5, sfx = 0.8) {
    const c = ensure();
    if (!c) return;
    musicBus.gain.setTargetAtTime(music, c.currentTime, 0.2);
    sfxBus.gain.setTargetAtTime(sfx, c.currentTime, 0.2);
  },

  // Slow evolving chord pad — generative, never repeats exactly.
  startAmbient() {
    const c = ensure();
    if (!c || pads) return;
    const roots = [110, 98, 130.81, 146.83];
    const voices = [];
    const bus = c.createGain();
    bus.gain.value = 0.16;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    bus.connect(filter).connect(musicBus);
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = roots[i] * (i > 1 ? 1.5 : 1);
      g.gain.value = 0.0;
      o.connect(g).connect(bus);
      o.start();
      voices.push({ o, g });
    }
    pads = { voices, bus, filter, roots };
    const evolve = () => {
      if (!pads || !ctx) return;
      const now = ctx.currentTime;
      const chord = [0, 3, 7, 10, 12][Math.floor(Math.random() * 5)];
      pads.voices.forEach((v, i) => {
        const semis = chord + [0, 7, 12, 16][i];
        v.o.frequency.setTargetAtTime(pads.roots[i % 4] * Math.pow(2, semis / 12), now, 3);
        v.g.gain.setTargetAtTime(0.05 + Math.random() * 0.07, now, 4);
      });
      pads.filter.frequency.setTargetAtTime(500 + Math.random() * 1400, now, 5);
      setTimeout(evolve, 9000 + Math.random() * 7000);
    };
    evolve();
  },

  quiet() {
    if (ambient && ctx) ambient.g.gain.setTargetAtTime(0.0, ctx.currentTime, 0.3);
  },
};
