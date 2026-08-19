// Keyboard / mouse input with pointer lock.
export const input = {
  keys: new Set(),
  mouseDX: 0,
  mouseDY: 0,
  mouseDown: false,
  mouseRight: false,
  locked: false,
  enabled: true,
  sensitivity: 1,
  invertY: false,
  _canvas: null,

  init(canvas) {
    this._canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.keys.clear(); this.mouseDown = false; this.mouseRight = false; }
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.mouseRight = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.mouseRight = false;
      else this.mouseDown = false;
    });
    window.addEventListener('contextmenu', (e) => { if (this.locked) e.preventDefault(); });
  },

  lock() {
    if (this.locked || !this._canvas) return;
    try {
      const r = this._canvas.requestPointerLock?.();
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch (e) { /* needs a user gesture; the canvas click handler retries */ }
  },
  unlock() {
    if (this.locked) document.exitPointerLock?.();
  },

  down(code) { return this.enabled && this.keys.has(code); },
  consumeMouse() {
    const d = {
      x: this.mouseDX * this.sensitivity,
      y: this.mouseDY * this.sensitivity * (this.invertY ? -1 : 1),
    };
    this.mouseDX = 0; this.mouseDY = 0;
    return this.enabled ? d : { x: 0, y: 0 };
  },
};
