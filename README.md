# 🔥 FIREBROX

A **Clash Royale–style** real-time arena card battler for the browser. No build
step, no dependencies — just Canvas 2D, ES modules and the Web Audio API.

Play cards, spend elixir, crush the Ice King's towers.

![genre](https://img.shields.io/badge/genre-RTS%20card%20battler-orange)

## 🌐 Play on GitHub Pages

The repo root contains a **self-contained `index.html`** (~62 KB, all CSS/JS
inlined — it even works when opened directly from disk).

To publish it on GitHub Pages:

1. Merge this branch into `main`
2. Repo **Settings → Pages → Source: "Deploy from a branch"**
3. Branch: **`main`**, folder: **`/ (root)`** → Save
4. Play at `https://<username>.github.io/Firebrox/`

## ▶️ Run locally

```bash
npm start          # serves on http://localhost:8000 (single-file build at /)
# or: python3 -m http.server 8000
```

- `/` — the single-file game (what GitHub Pages serves)
- `/dev.html` — the modular dev build (HMR-friendly sources)
- Opening `index.html` straight from disk works too (no server needed)

## 🔨 Development

The canonical sources live in `js/` + `css/` + `dev.html`. The shipped
`index.html` is **generated** — edit the sources, then rebuild:

```bash
npm run build      # regenerate index.html from the modular sources
npm test           # engine sims + UI smoke tests (both builds) + staleness check
```

Don't edit `index.html` by hand; `npm test` fails if it's out of date.

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
index.html        ⭐ GENERATED single-file game (GitHub Pages serves this)
dev.html          modular dev entry (uses js/* + css/*)
css/style.css     HUD, cards, elixir bar, overlays
js/config.js      balance: cards, towers, arena geometry
js/engine.js      sim: elixir, targeting, river/bridge pathing, combat, OT   (DOM-free)
js/ai.js          the Frostbyte CPU                                          (DOM-free)
js/render.js      Canvas 2D renderer
js/audio.js       Web Audio synth SFX (zero audio assets)
js/main.js        input, HUD sync, game loop
scripts/build.mjs generates index.html from the modular sources
server.mjs        tiny static server
test/sim.mjs      headless end-to-end engine tests
test/dom-smoke.mjs boots the real UI (both builds) under a stub DOM
```
