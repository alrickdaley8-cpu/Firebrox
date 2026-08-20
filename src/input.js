// Keyboard / mouse input.
//
// Pointer lock is the nice path, but it is frequently refused — most importantly
// inside cross-origin preview iframes that lack allow="pointer-lock". The game must
// stay fully playable when that happens, so this layer supports two modes:
//
//   locked   — real pointer lock, cursor hidden, unlimited mouse travel
//   freeLook — fallback: we read movementX/Y from ordinary mousemove events
//
// Keyboard is never gated behind pointer lock.
export const input = {
  keys: new Set(),
  mouseDX: 0,
  mouseDY: 0,
  mouseDown: false,
  mouseRight: false,
  locked: false,
  freeLook: false,
  pointerLockBlocked: false,
  engaged: false,          // the player has clicked into the game at least once
  enabled: true,
  sensitivity: 1,
  invertY: false,
  onModeChange: null,
  _canvas: null,

  get active() {
    return this.locked || this.freeLook;
  },

  init(canvas) {
    this._canvas = canvas;
    canvas.setAttribute('tabindex', '0');

    // ---- keyboard (always live, regardless of pointer lock)
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.mouseRight = false;
    });

    // ---- pointer lock
    document.addEventListener('pointerlockchange', () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) {
        this.freeLook = false;
        this.pointerLockBlocked = false;   // it clearly works here
        this._gestureAttempt = false;
      } else if (wasLocked) {
        // Esc out of pointer lock: fall back to free look so the game stays playable
        this.freeLook = this.engaged;
        this.mouseDown = false;
        this.mouseRight = false;
      }
      this.applyCursor();
      this.onModeChange?.(this.mode());
    });
    document.addEventListener('pointerlockerror', () => {
      // A programmatic attempt (e.g. closing a menu) can fail simply because it was not
      // a user gesture — that is not the same as the browser forbidding pointer lock.
      if (this._gestureAttempt) {
        this.pointerLockBlocked = true;
        this.freeLook = this.engaged;
      }
      this.onModeChange?.(this.mode());
    });

    // ---- mouse look (works locked or free)
    const look = (e) => {
      if (!this.active) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    document.addEventListener('mousemove', look);

    // ---- buttons (no longer gated behind pointer lock)
    canvas.addEventListener('mousedown', (e) => {
      this.engage();
      if (!this.active) return;
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.mouseRight = true;
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.mouseRight = false;
      else this.mouseDown = false;
    });
    window.addEventListener('contextmenu', (e) => { if (this.active) e.preventDefault(); });

    // keep keyboard focus inside the (possibly iframed) game
    canvas.addEventListener('click', () => { try { window.focus(); canvas.focus(); } catch (err) { /* ignore */ } });
  },

  mode() {
    if (this.locked) return 'locked';
    if (this.freeLook) return 'freelook';
    return 'idle';
  },

  // Called on any click in the play area: try pointer lock, fall back to free look.
  engage() {
    this.engaged = true;
    if (this.locked) return;
    if (this.pointerLockBlocked) {
      this.freeLook = true;
      this.applyCursor();
      this.onModeChange?.(this.mode());
      return;
    }
    this._gestureAttempt = true;
    this.lock();
    // if pointer lock has not engaged shortly after the gesture, fall back to free look
    setTimeout(() => {
      this._gestureAttempt = false;
      if (!this.locked) {
        this.pointerLockBlocked = true;
        this.freeLook = true;
        this.applyCursor();
        this.onModeChange?.(this.mode());
      }
    }, 250);
  },

  applyCursor() {
    if (!this._canvas) return;
    this._canvas.style.cursor = this.freeLook ? 'none' : '';
  },

  lock() {
    if (this.locked || !this._canvas) return;
    if (this.pointerLockBlocked) {
      this.freeLook = this.engaged;
      return;
    }
    try {
      const r = this._canvas.requestPointerLock?.();
      if (r && typeof r.catch === 'function') {
        r.catch(() => {
          this.pointerLockBlocked = true;
          this.freeLook = this.engaged;
          this.onModeChange?.(this.mode());
        });
      }
    } catch (e) {
      if (this._gestureAttempt) {
        this.pointerLockBlocked = true;
        this.freeLook = this.engaged;
      }
      this.onModeChange?.(this.mode());
    }
  },

  // Menus call this so the cursor is usable again.
  unlock() {
    if (this.locked) document.exitPointerLock?.();
    this.freeLook = false;
    this.mouseDown = false;
    this.mouseRight = false;
    this.applyCursor();
    this.onModeChange?.(this.mode());
  },

  down(code) { return this.enabled && this.keys.has(code); },

  consumeMouse() {
    // arrow keys double as a look stick when no mouse is usable
    const K = 6 * this.sensitivity;
    if (this.enabled) {
      if (this.keys.has('ArrowLeft')) this.mouseDX -= K;
      if (this.keys.has('ArrowRight')) this.mouseDX += K;
      if (this.keys.has('ArrowUp')) this.mouseDY -= K;
      if (this.keys.has('ArrowDown')) this.mouseDY += K;
    }
    const d = {
      x: this.mouseDX * this.sensitivity,
      y: this.mouseDY * this.sensitivity * (this.invertY ? -1 : 1),
    };
    this.mouseDX = 0; this.mouseDY = 0;
    return this.enabled ? d : { x: 0, y: 0 };
  },
};
