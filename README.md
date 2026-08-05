# 🔥 FIREBROX

A **Clash Royale–style** real-time arena card battler for the browser. No build
step, no dependencies — just Canvas 2D, ES modules and the Web Audio API.

Play cards, spend elixir, crush the Ice King's towers.

![genre](https://img.shields.io/badge/genre-RTS%20card%20battler-orange)

## ▶️ Run it

```bash
npm start          # serves on http://localhost:8000
# or: python3 -m http.server 8000
```

Open http://localhost:8000 in a browser (works great on mobile, too).

## 🎮 How to play

- **Tap a card** (or press `1`–`4`), then **tap your half** of the arena to deploy — or drag the card onto the field.
- 💧 **Elixir** refills over time (2× in the last minute). Every card costs elixir.
- 👑 Destroy a **Princess Tower** for a crown; the **King's Tower** ends the game instantly (it sleeps until damaged or a princess falls).
- ⌛ Most crowns at 3:00 wins. Tied? 60s **Sudden Death** — first tower wins, then a weakest-tower-HP tiebreaker.
- Cross the river via the **two bridges**; flying units don't care. Spells can land anywhere.
- Take down an enemy princess to unlock **pocket deploys** on that lane.

### The deck (8 cards)

| Card | Cost | Role |
|---|---|---|
| 🗡️ Knight | 3 | Sturdy melee tank |
| 🏹 Archers | 3 | Two ranged, hits air |
| 🧌 Giant | 5 | Huge HP, buildings only |
| 🔫 Musketeer | 4 | Long-range heavy hitter |
| 🤺 Mini PEKKA | 4 | Devastating melee DPS |
| 💀 Skeletons | 1 | 3-unit swarm |
| 🐉 Baby Dragon | 4 | Flying splash damage |
| 🔥 Fireball | 4 | AoE spell, reduced tower damage |

## 🤖 The AI — "❄️ FROSTBYTE"

A heuristic opponent that defends incoming pushes with counters (anti-air vs
dragons, Mini PEKKA vs tanks), fireballs clumped swarms, builds Giant-led
pushes on your weaker lane, snipes dying towers with fireball, and plays with
human-ish reaction delays and mistakes.

## 🧪 Tests

```bash
npm test    # headless AI-vs-AI simulations + deploy-rule checks (Node, no deps)
```

## 🗂️ Code layout

```
index.html        shell & overlays
css/style.css     HUD, cards, elixir bar, overlays
js/config.js      balance: cards, towers, arena geometry
js/engine.js      sim: elixir, targeting, river/bridge pathing, combat, OT   (DOM-free)
js/ai.js          the Frostbyte CPU                                          (DOM-free)
js/render.js      Canvas 2D renderer
js/audio.js       Web Audio synth SFX (zero audio assets)
js/main.js        input, HUD sync, game loop
server.mjs        tiny static server
test/sim.mjs      headless end-to-end engine tests
```
