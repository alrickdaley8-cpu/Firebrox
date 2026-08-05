// ============ FIREBROX — tiny WebAudio synth SFX (no assets) ============
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
  }

  // must be called from a user gesture
  unlock() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  tone(f0, f1, dur, type = 'square', vol = 0.15, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.25, fLow = 200, fHigh = 1200, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(fHigh, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, fLow), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t);
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'click':    this.tone(660, 660, 0.05, 'square', 0.07); break;
      case 'select':   this.tone(520, 780, 0.07, 'triangle', 0.12); break;
      case 'error':    this.tone(170, 120, 0.16, 'sawtooth', 0.12); break;
      case 'deploy':   this.tone(320, 170, 0.13, 'square', 0.16); this.noise(0.08, 0.06, 300, 900); break;
      case 'shoot':    this.tone(880, 520, 0.05, 'square', 0.04); break;
      case 'hit':      this.tone(230, 150, 0.05, 'triangle', 0.05); break;
      case 'heavy':    this.tone(160, 70, 0.13, 'sawtooth', 0.14); break;
      case 'die':      this.tone(420, 130, 0.12, 'triangle', 0.06); this.noise(0.07, 0.04, 300, 900); break;
      case 'boom':     this.noise(0.5, 0.35, 70, 900); this.tone(130, 45, 0.4, 'sine', 0.3); break;
      case 'tower':
        this.noise(0.6, 0.35, 60, 400);
        this.tone(98, 49, 0.5, 'sawtooth', 0.22);
        this.tone(392, 392, 0.1, 'square', 0.1, 0);
        this.tone(311, 311, 0.1, 'square', 0.1, 0.12);
        this.tone(262, 262, 0.16, 'square', 0.1, 0.24);
        break;
      case 'horn':
        [262, 392, 523].forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.11, i * 0.09));
        break;
      case 'double':   this.tone(880, 1320, 0.16, 'sine', 0.13); break;
      case 'overtime':
        [523, 659, 784].forEach((f, i) => this.tone(f, f, 0.1, 'sawtooth', 0.09, i * 0.07));
        break;
      case 'wake':     this.tone(196, 392, 0.2, 'square', 0.1); break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, i === 3 ? 0.4 : 0.14, 'triangle', 0.14, i * 0.12));
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, f, i === 3 ? 0.45 : 0.15, 'sawtooth', 0.1, i * 0.13));
        break;
    }
  }
}
