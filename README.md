# FIREBROX — *an infinite universe awaits*

A browser-based **No Man's Sky**: a procedurally generated galaxy you can fly through,
land on, mine, scan and warp across. Built with Three.js + Vite, no external assets —
every star, planet, texture, creature and sound is generated from a seed at runtime.

```bash
npm install
npm run dev      # http://localhost:5173
```

## What's in it

**A galaxy of 240 star systems** (`src/universe.js`) laid out in a three-armed spiral, each
with a seeded name, star class, economy, conflict level and 1–5 planets. Everything is
derived deterministically from seeds, so the same galaxy exists on every machine.

**Space flight** (`src/space.js`) — six-degree ship control, throttle, boost and a
pulse-warp drive that hits ~46,000 u/s. Planets orbit their star with moons, rings and
additive atmospheres; textures are painted per-planet from 3D simplex noise (continents,
sea level, mountains, polar caps). Shoot asteroids in the belt for Ferrite and Platinum,
dock at the space station to repair and refuel.

**Planetary landing** (`src/surface.js`) — fly close to any planet and hold **E**. The
surface is a streaming chunked heightmap (fbm + ridged noise, biome-tinted vertex colours)
with water, fog, flora, mineral formations and wandering low-poly fauna. First-person
movement with gravity, sprint, jump and a jetpack; a mining beam that harvests Carbon,
Ferrite, Sodium, Di-hydrogen and Platinum; environmental hazards that eat your protection
and then your life support.

**Nine biomes** — Lush, Scorched, Frozen, Toxic, Irradiated, Barren, Volcanic, Exotic and
Oceanic — each with its own palette, sky, hazard, flora/fauna density and terrain amplitude.

**Discovery & progression** — scan planets (+1500 units) and lifeforms (+400), craft Warp
Cells from 100 Di-hydrogen + 50 Ferrite, open the galactic map, pick a star inside your
220 ly hyperdrive range and jump. Everything autosaves to localStorage.

## Controls

| | |
|---|---|
| **Flight** | `W`/`S` throttle · mouse steer · `A`/`D` roll · `Shift` boost · `Space` pulse warp |
| **On foot** | `WASD` move · mouse look · `Space` jump / jetpack · `Shift` sprint |
| **Land / launch** | hold `E` near a planet's surface · `E` at your ship to launch |
| **Multi-tool** | left-click mine · `F` scan (planets & lifeforms) |
| **Utility** | `M` galaxy map (`Enter` to warp) · `C` craft warp cell · `R` recharge hazard protection with Sodium · `G` refuel launch thrusters with Di-hydrogen |
| **System** | `Tab` log / pause · `Ctrl+S` save · `Esc` release mouse |

## Layout

```
index.html        HUD, title, galaxy map and pause overlays
styles.css        the whole interface
src/main.js       renderer, mode switching, game loop
src/universe.js   galaxy / system / planet / biome generation
src/space.js      star system flight
src/surface.js    planetary surface, terrain streaming, mining, creatures
src/map.js        galactic map + hyperdrive jumps
src/assets3d.js   planet textures, starfield, ship model, sprites
src/noise.js      2D/3D simplex + fbm/ridged fractals
src/rng.js        seeded RNG and hashes
src/state.js      inventory, discoveries, save/load
src/ui.js         HUD binding
src/audio.js      synthesised SFX and engine hum
```
