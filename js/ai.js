// ============ FIREBROX — AI opponent ("FROSTBYTE") ============
// Simple but lively heuristic CPU: defends pushes, punishes swarms with
// fireball, builds its own attacks, and finishes low towers with spells.
import * as E from './engine.js';
import { ARENA, CARDS, SIDES, otherSide } from './config.js';

const UNIT_CARDS = Object.values(CARDS).filter((c) => c.type === 'unit').map((c) => c.key);

export class OpponentAI {
  constructor(side, opts = {}) {
    this.side = side;
    this.foe = otherSide(side);
    this.reaction = opts.reaction ?? 1.0;       // seconds to answer a threat
    this.offenseElixir = opts.offenseElixir ?? 7.5;
    this.offenseGap = opts.offenseGap ?? 3.2;   // min seconds between pushes
    this.mistake = opts.mistake ?? 0.06;        // chance to skip a thought
    this.think = 0.8;                            // countdown to next thought
    this.clock = 0;
    this.pending = [];
    this.lastOffense = -99;
  }

  // --- side-aware geometry (AI works for either side, used by tests too) ---
  get isTop() { return this.side === SIDES.ENEMY; }
  myBackY()   { return this.isTop ? 178 : 782; }
  myBridgeY() { return this.isTop ? ARENA.RIVER_TOP - 18 : ARENA.RIVER_BOT + 18; }
  myHalf(u)   { return this.isTop ? u.y < ARENA.RIVER_TOP : u.y > ARENA.RIVER_BOT; }

  update(s, dt) {
    if (s.over) return;
    this.clock += dt;

    // run scheduled plays
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.clock >= this.pending[i].at) {
        const p = this.pending.splice(i, 1)[0];
        p.fn();
      }
    }

    this.think -= dt;
    if (this.think > 0) return;
    this.think = 0.55 + Math.random() * 0.35;
    if (Math.random() < this.mistake) return;

    this.plan(s);
  }

  schedule(delay, fn) {
    if (this.pending.length < 3) this.pending.push({ at: this.clock + delay, fn });
  }

  // Find a legal deploy spot near (x, y), nudging around until valid.
  findSpot(s, key, x, y) {
    const tries = [
      [0, 0], [26, 0], [-26, 0], [0, 26], [0, -26],
      [52, 0], [-52, 0], [0, 52], [0, -52], [34, 34], [-34, 34], [34, -34], [-34, -34],
    ];
    for (const [ox, oy] of tries) {
      const px = Math.max(20, Math.min(ARENA.W - 20, x + ox));
      const py = Math.max(20, Math.min(ARENA.H - 20, y + oy));
      if (E.isValidDeploy(s, this.side, key, px, py)) return { x: px, y: py };
    }
    return null;
  }

  plan(s) {
    const foes = s.units.filter((u) => u.side === this.foe && u.hp > 0);
    const me = this.side;

    // ---------- 1. DEFENSE ----------
    const threats = foes.filter((u) =>
      this.myHalf(u) ||
      E.towersOf(s, me).some((t) => t.alive && Math.hypot(u.x - t.x, u.y - t.y) < 240),
    );
    if (threats.length) {
      // biggest cluster
      let cluster = threats;
      if (threats.length >= 2) {
        let bestGroup = [threats[0]];
        for (const a of threats) {
          const g = threats.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < 75);
          if (g.length > bestGroup.length) bestGroup = g;
        }
        cluster = bestGroup;
      }
      const cx = cluster.reduce((n, u) => n + u.x, 0) / cluster.length;
      const cy = cluster.reduce((n, u) => n + u.y, 0) / cluster.length;
      const clusterHp = cluster.reduce((n, u) => n + u.hp, 0);
      const airThreat = threats.some((u) => u.flying);
      const tankThreat = threats.some((u) => u.targetsBuildings && u.maxHp > 1200);

      // fireball a fat clump
      if (cluster.length >= 3 && clusterHp > 280 && E.cardInHand(s, me, 'fireball') >= 0 && s.elixir[me] >= 4) {
        this.schedule(this.reaction, () => E.deployCard(s, me, 'fireball', cx, cy));
        return;
      }

      // pick a counter card
      let pick = null;
      if (airThreat) pick = ['musketeer', 'archers', 'babydragon'].find((k) => E.cardInHand(s, me, k) >= 0 && s.elixir[me] >= CARDS[k].cost);
      if (!pick && tankThreat) pick = ['minipekka', 'skeletons', 'knight'].find((k) => E.cardInHand(s, me, k) >= 0 && s.elixir[me] >= CARDS[k].cost);
      if (!pick) {
        pick = ['knight', 'minipekka', 'babydragon', 'archers', 'musketeer', 'skeletons']
          .filter((k) => E.cardInHand(s, me, k) >= 0 && s.elixir[me] >= CARDS[k].cost)
          .sort((a, b) => CARDS[a].cost - CARDS[b].cost)[0];
      }
      if (!pick) return;

      // interpose between the threat and my king
      const king = E.towersOf(s, me).find((t) => t.kind === 'king');
      const dx = king.x - cx, dy = king.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const sx = cx + (dx / d) * 55;
      const sy = cy + (dy / d) * 55;
      this.schedule(this.reaction * (0.7 + Math.random() * 0.7), () => {
        const spot = this.findSpot(s, pick, sx, sy);
        if (spot) E.deployCard(s, me, pick, spot.x, spot.y);
      });
      return;
    }

    // ---------- 2. SPELL FINISHER ----------
    const dying = E.towersOf(s, this.foe).find((t) => t.alive && t.kind !== 'king' && t.hp <= CARDS.fireball.dmg * CARDS.fireball.towerScale + 25);
    if (dying && E.cardInHand(s, me, 'fireball') >= 0 && s.elixir[me] >= 6 && Math.random() < 0.6) {
      this.schedule(0.8, () => E.deployCard(s, me, 'fireball', dying.x, dying.y));
      return;
    }

    // ---------- 3. OFFENSE ----------
    if (this.clock - this.lastOffense < this.offenseGap) return;
    if (s.elixir[me] < this.offenseElixir && !(s.elixir[me] >= 5 && Math.random() < 0.3)) return;

    // attack the weaker lane
    const princesses = E.towersOf(s, this.foe).filter((t) => t.alive && t.kind === 'princess');
    let laneX;
    if (!princesses.length) laneX = Math.random() < 0.5 ? ARENA.BRIDGES[0].x : ARENA.BRIDGES[1].x;
    else {
      const weakest = princesses.sort((a, b) => a.hp - b.hp)[0];
      laneX = weakest.lane === 'left' ? ARENA.BRIDGES[0].x : ARENA.BRIDGES[1].x;
    }

    const has = (k) => E.cardInHand(s, me, k) >= 0 && s.elixir[me] >= CARDS[k].cost;

    // Giant-led push when possible
    if (has('giant') && s.elixir[me] >= 8) {
      const bx = laneX, by = this.myBackY();
      this.schedule(0.5, () => {
        const spot = this.findSpot(s, 'giant', bx, by);
        if (spot && E.deployCard(s, me, 'giant', spot.x, spot.y).ok) {
          this.lastOffense = this.clock;
          // follow-up support behind the giant
          this.schedule(1.7, () => {
            const support = ['musketeer', 'babydragon', 'archers']
              .find((k) => E.cardInHand(s, me, k) >= 0 && s.elixir[me] >= CARDS[k].cost + 2);
            if (!support) return;
            const g = s.units.filter((u) => u.side === me && u.key === 'giant').pop();
            const px = g ? g.x : bx;
            const py = g ? g.y + (this.isTop ? -46 : 46) : this.myBridgeY();
            const sp2 = this.findSpot(s, support, px, py);
            if (sp2) E.deployCard(s, me, support, sp2.x, sp2.y);
          });
        }
      });
      return;
    }

    // otherwise: bridge pressure with the beefiest affordable unit
    const pick = UNIT_CARDS
      .filter((k) => has(k) && k !== 'skeletons')
      .sort((a, b) => CARDS[b].hp - CARDS[a].hp)[0] || (has('skeletons') ? 'skeletons' : null);
    if (!pick) return;
    this.schedule(0.4, () => {
      const spot = this.findSpot(s, pick, laneX + (Math.random() * 30 - 15), this.myBridgeY());
      if (spot && E.deployCard(s, me, pick, spot.x, spot.y).ok) this.lastOffense = this.clock;
    });
  }
}
