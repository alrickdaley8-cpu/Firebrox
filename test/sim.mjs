// Headless smoke test: two AIs battle from start to finish.
// Verifies the engine never crashes, stays finite, and always reaches an end.
import * as E from '../js/engine.js';
import { OpponentAI } from '../js/ai.js';
import { ARENA, CARDS, SIDES } from '../js/config.js';

let failures = 0;
const assert = (cond, msg) => {
  if (!cond) { failures++; console.error(`  ❌ ${msg}`); }
};

// ---- deploy-zone sanity ----
{
  const g = E.createGame();
  assert(E.isValidDeploy(g, SIDES.PLAYER, 'knight', 270, 700), 'own-half deploy should be valid');
  assert(!E.isValidDeploy(g, SIDES.PLAYER, 'knight', 270, 480), 'river deploy should be invalid');
  assert(!E.isValidDeploy(g, SIDES.PLAYER, 'knight', 270, 200), 'enemy-half deploy invalid before tower falls');
  assert(E.isValidDeploy(g, SIDES.PLAYER, 'fireball', 270, 200), 'spells can target anywhere');
  const epl = g.towers.find((t) => t.id === 'epl');
  epl.alive = false; epl.hp = 0;
  assert(E.isValidDeploy(g, SIDES.PLAYER, 'knight', 120, 300), 'pocket opens after princess falls');
  assert(!E.isValidDeploy(g, SIDES.PLAYER, 'knight', 420, 300), 'pocket is lane-specific');
  console.log('✓ deploy-zone rules');
}

// ---- full AI vs AI simulation ----
for (let run = 0; run < 3; run++) {
  const game = E.createGame();
  const p1 = new OpponentAI(SIDES.PLAYER);
  const p2 = new OpponentAI(SIDES.ENEMY);
  const dt = 1 / 30;
  let simT = 0;
  const maxT = 300; // 3:00 + 1:00 OT + margin

  while (!game.over && simT < maxT) {
    p1.update(game, dt);
    p2.update(game, dt);
    E.update(game, dt);
    E.drainEvents(game);
    simT += dt;

    for (const u of game.units) {
      assert(Number.isFinite(u.x) && Number.isFinite(u.y), `unit ${u.key} has non-finite position @${simT.toFixed(1)}`);
    }
    assert(game.elixir.player >= 0 && game.elixir.player <= 10, 'player elixir out of bounds');
    assert(game.elixir.enemy >= 0 && game.elixir.enemy <= 10, 'enemy elixir out of bounds');
    if (failures > 10) break;
  }

  assert(game.over, `run ${run}: game should have ended within ${maxT}s (ended at ${simT.toFixed(1)}s)`);
  assert(game.winner === null || game.winner === SIDES.PLAYER || game.winner === SIDES.ENEMY, 'winner is valid');
  const left = game.towers.filter((t) => t.side === SIDES.PLAYER && t.alive).length;
  const right = game.towers.filter((t) => t.side === SIDES.ENEMY && t.alive).length;
  console.log(
    `✓ run ${run}: ${game.winner ?? 'draw'} in ${simT.toFixed(1)}s — ` +
    `crowns ${game.crowns.player}:${game.crowns.enemy}, ` +
    `towers left ${left} vs ${right}, reason: "${game.winReason}", ` +
    `units on field: ${game.units.length}`,
  );
  if (failures > 10) break;
}

// in-bounds check for arena constants
assert(ARENA.BRIDGES.every((b) => b.x > 0 && b.x < ARENA.W), 'bridges inside arena');
assert(Object.values(CARDS).every((c) => c.cost >= 1 && c.cost <= 10), 'card costs sane');

if (failures) {
  console.error(`\n💥 ${failures} failure(s)`);
  process.exit(1);
}
console.log('\n✅ all engine tests passed');
