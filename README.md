# FIREBROX — *an infinite universe awaits*

A browser-built **No Man's Sky**: a 320-system procedural galaxy you can fly through,
land on, mine, scan, trade, upgrade and fight across. Three.js + Vite, **no external
assets** — every star, planet texture, nebula, creature, ruin and sound effect is
generated from a seed at runtime.

```bash
node server.mjs        # or: npm start   →  http://localhost:5173
```

**No build step and no runtime dependencies.** Three.js is vendored in `vendor/three/`
and wired up with an import map, so the game is just static files — any static server
(or `node server.mjs`) will do.

```bash
npm i -D jsdom && npm test   # headless smoke test: boots every module,
                             # drives thousands of frames, asserts zero errors
```

## The universe

**320 star systems** in a four-armed spiral, each seeded with a name, star class,
economy, wealth, conflict level, pirate population and 2–6 planets. Deterministic:
the same galaxy exists on every machine, forever.

**Twelve biomes** — Lush, Scorched, Frozen, Toxic, Irradiated, Barren, Volcanic,
Exotic, Oceanic, Fungal, Crystalline and Crimson — each with its own palette, sky,
night colour, hazard, weather, flora style, fauna density and terrain amplitude.
Planets also roll their own gravity (0.65–1.5 g) and day length.

## Space

* Six-degree ship flight with throttle, roll, boost and a pulse drive that hits ~52,000 u/s.
* Planets painted from 3D simplex noise (continents, sea level, mountains, ice caps),
  with bump mapping, animated cloud layers, Fresnel atmosphere shells, rings and moons.
* Painted nebula skybox per system, bloom post-processing, ACES tone mapping.
* **Combat**: pirate interceptors hunt you in dangerous systems. Photon cannons,
  regenerating deflector shields, hull damage, salvage and bounties. Die and you
  respawn at the station minus half your cargo.
* Asteroid belts you can shoot apart for Ferrite and Chromatic Metal.
* A live tactical **scanner** showing planets, the station, the star and hostiles.
* **Space stations**: dock to repair and refuel, sell cargo on a market that reacts to
  the local economy's demand, buy warp cells, and install seven lines of ship/exosuit
  technology (hyperdrive range, mining focus, cargo, jetpack, shields, weapons, hazard).

## Planet surface

* Streaming chunked terrain with LOD (fbm + ridged noise), slope-aware vertex colouring,
  sand shorelines, snow caps and wave-animated water.
* Real-time **day/night cycle** — moving sun, sunset tinting, stars fading in at night,
  ship floodlight, per-planet day length.
* **Weather** — rain, snow and dust systems chosen by biome and planetary weather.
* Sun shadows, head-bob, footsteps, planet-specific gravity, jetpack, sprint, swimming
  and drowning, hazard drain and Sodium recharges.
* Mining beam that harvests Carbon, Ferrite, Sodium, Di-hydrogen, Platinum and Chromatic Metal.
* **Fauna** — walking and flying creatures with size, diet, temperament and weight;
  skittish ones flee, curious ones follow, territorial ones charge. Scan to catalogue them.
* **Ruins** — ancient monoliths with alien lore, crashed freighters and abandoned
  outposts, each with salvage and nanite rewards.
* A compass with waypoints back to your ship and to nearby structures.

## Progression

Scan planets (+1500), lifeforms (+400), ruins (+800 & nanites), kill pirates (+2200),
sell cargo at demand-driven prices, craft Warp Cells (100 Di-hydrogen + 50 Ferrite),
and buy hyperdrive coils to reach further stars. Everything autosaves to localStorage.

## Controls

| | |
|---|---|
| **Flight** | `W`/`S` throttle · mouse steer · `A`/`D` roll · `Shift` boost · `Space` pulse warp |
| **Combat** | Left-click photon cannons |
| **On foot** | `WASD` move · mouse look · `Space` jump / jetpack · `Shift` sprint · left-click mining beam |
| **Interact** | Hold `E` to land, dock or launch · hold `F` to scan planets, lifeforms and ruins |
| **Utility** | `M` galaxy map (`Enter` warp, `Q`/`E` rotate, wheel zoom) · `C` craft warp cell · `R` recharge hazard · `G` refuel thrusters |
| **System** | `Tab` journey log · `Ctrl+S` save · `P` exposure toggle · `Esc` release mouse |

## Layout

```
index.html        HUD, title, galaxy map, station and log overlays
styles.css        the whole interface
src/main.js       renderer, post-processing, mode switching, game loop
src/universe.js   galaxy / system / planet / biome / economy generation
src/space.js      star system flight, combat, docking
src/surface.js    planet surface, terrain streaming, weather, creatures, ruins
src/map.js        galactic map + hyperdrive jumps
src/assets3d.js   planet textures, nebulae, starfields, ships, station, ruins
src/noise.js      2D/3D simplex + fbm/ridged fractals
src/rng.js        seeded RNG and hashes
src/state.js      inventory, upgrades, discoveries, save/load
src/ui.js         HUD, scanner, compass, market and technology screens
src/audio.js      synthesised SFX and engine hum
server.mjs        zero-dependency static server
vendor/three/     vendored three.js + postprocessing addons (import-mapped)
tools/            headless jsdom smoke test
```
