/* Procedural HUD audio — no external files */
const FX = (() => {
  let ctx;
  let padNodes = null;
  let muted = false;
  let tonesOn = true;
  let gainMul = 0.7;
  let alarmId = null;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur = 0.12, type = "sine", gain = 0.05, at = 0) {
    if (muted || !tonesOn) return;
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const amp = Math.max(0.0001, gain * gainMul);
    g.gain.setValueAtTime(0.0001, c.currentTime + at);
    g.gain.exponentialRampToValueAtTime(amp, c.currentTime + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + at);
    o.stop(c.currentTime + at + dur + 0.02);
  }

  function noise(dur = 0.25, gain = 0.03) {
    if (muted || !tonesOn) return;
    const c = ac();
    const n = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    src.buffer = n;
    f.type = "bandpass";
    f.frequency.value = 1800;
    g.gain.value = gain * gainMul;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  }

  return {
    unlock() { ac(); },
    beep() { tone(880, 0.07, "square", 0.028); },
    tick() { tone(1480, 0.035, "square", 0.016); },
    click() { tone(2100, 0.03, "square", 0.012); },
    confirm() {
      tone(523, 0.09, "triangle", 0.04);
      tone(784, 0.12, "triangle", 0.04, 0.08);
    },
    warn() {
      tone(220, 0.18, "sawtooth", 0.04);
      tone(180, 0.22, "sawtooth", 0.04, 0.1);
    },
    boot() {
      [196, 247, 330, 392, 523, 784].forEach((f, i) => tone(f, 0.16, "sine", 0.035, i * 0.07));
    },
    online() {
      tone(392, 0.18, "sine", 0.05);
      tone(523, 0.22, "sine", 0.05, 0.1);
      tone(784, 0.38, "sine", 0.05, 0.2);
    },
    assemble() {
      [330, 370, 415, 494, 587, 740, 880].forEach((f, i) => tone(f, 0.1, "triangle", 0.03, i * 0.05));
    },
    scan() { noise(0.35, 0.04); tone(920, 0.2, "sine", 0.02); },
    alarm() {
      this.stopAlarm();
      const pulse = () => {
        tone(880, 0.18, "square", 0.05);
        tone(660, 0.18, "square", 0.04, 0.2);
      };
      pulse();
      alarmId = setInterval(pulse, 700);
    },
    stopAlarm() {
      if (alarmId) { clearInterval(alarmId); alarmId = null; }
    },
    setTones(on) { tonesOn = !!on; },
    setGain(v) { gainMul = Math.max(0, Math.min(1, Number(v) || 0)); },
    toggleMute() {
      muted = !muted;
      if (muted) { this.stopPad(); this.stopAlarm(); }
      return muted;
    },
    setMuted(v) {
      muted = !!v;
      if (muted) { this.stopPad(); this.stopAlarm(); }
      return muted;
    },
    isMuted() { return muted; },
    startPad(mode = "workshop") {
      if (muted || padNodes) return;
      const c = ac();
      const master = c.createGain();
      master.gain.value = 0.03 * gainMul;
      master.connect(c.destination);
      const banks = {
        workshop: [110, 164.81, 220, 329.63],
        pulse: [98, 146.83, 196, 293.66],
        stealth: [82.41, 123.47, 164.81]
      };
      const notes = banks[mode] || banks.workshop;
      const oscs = notes.map((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = i % 2 ? "sine" : "triangle";
        o.frequency.value = f;
        g.gain.value = 0.18;
        const lfo = c.createOscillator();
        const lg = c.createGain();
        lfo.frequency.value = 0.07 + i * 0.03;
        lg.gain.value = 7;
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
