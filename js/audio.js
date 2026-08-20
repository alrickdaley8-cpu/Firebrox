/* Procedural HUD audio — no external files required */
const FX = (() => {
  let ctx;
  let padNodes = null;
  let muted = false;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur = 0.12, type = "sine", gain = 0.05, at = 0) {
    if (muted) return;
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime + at);
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + at);
    o.stop(c.currentTime + at + dur + 0.02);
  }

  return {
    unlock() { ac(); },
    beep() { tone(880, 0.08, "square", 0.03); },
    tick() { tone(1400, 0.04, "square", 0.02); },
    confirm() {
      tone(523, 0.09, "triangle", 0.04);
      tone(784, 0.12, "triangle", 0.04, 0.08);
    },
    warn() {
      tone(220, 0.18, "sawtooth", 0.04);
      tone(180, 0.22, "sawtooth", 0.04, 0.1);
    },
    boot() {
      [220, 330, 440, 659, 880].forEach((f, i) => tone(f, 0.18, "sine", 0.04, i * 0.09));
    },
    online() {
      tone(392, 0.2, "sine", 0.05);
      tone(523, 0.25, "sine", 0.05, 0.12);
      tone(784, 0.4, "sine", 0.05, 0.24);
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopPad();
      return muted;
    },
    setMuted(v) {
      muted = !!v;
      if (muted) this.stopPad();
      return muted;
    },
    isMuted() { return muted; },
    startPad() {
      if (muted || padNodes) return;
      const c = ac();
      const master = c.createGain();
      master.gain.value = 0.025;
      master.connect(c.destination);
      const notes = [110, 164.81, 220, 329.63];
      const oscs = notes.map((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = i % 2 ? "sine" : "triangle";
        o.frequency.value = f;
        g.gain.value = 0.2;
        const lfo = c.createOscillator();
        const lg = c.createGain();
        lfo.frequency.value = 0.08 + i * 0.03;
        lg.gain.value = 8;
        lfo.connect(lg).connect(o.frequency);
        o.connect(g).connect(master);
        o.start();
        lfo.start();
        return { o, lfo };
      });
      padNodes = { master, oscs };
    },
    stopPad() {
      if (!padNodes) return;
      padNodes.oscs.forEach(({ o, lfo }) => {
        try { o.stop(); lfo.stop(); } catch (_) { /* already stopped */ }
      });
      padNodes = null;
    },
    padOn() { return !!padNodes; }
  };
})();
