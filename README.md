# FIREBROX — *an infinite universe awaits*

A browser-built **No Man's Sky**: a 320-system procedural galaxy you can fly through,
land on, mine, scan, trade, upgrade and fight across. Three.js + Vite, **no external
assets** — every star, planet texture, nebula, creature, ruin and sound effect is
generated from a seed at runtime.

```bash
node server.mjs        # or: npm start   →  http://localhost:5173
```

The server has **live reload** built in: it watches `src/`, `index.html` and `styles.css`,
and pushes a refresh to every open preview tab the moment anything changes. The game saves
on unload and resumes automatically after a reload, so an update never costs you progress.

**No build step and no runtime dependencies.** Three.js is vendored in `vendor/three/`
and wired up with an import map, so the game is just static files — any static server
(or `node server.mjs`) will do.

```bash
npm i -D jsdom && npm test   # headless smoke test: boots every module,
                             # drives thousands of frames, asserts zero errors
```

## Input: works with or without pointer lock

The preview runs inside a cross-origin iframe, and browsers refuse `requestPointerLock()`
there unless the frame carries `allow="pointer-lock"`. The input layer used to gate
**every key and mouse button** behind `input.locked`, so in that environment the game
rendered perfectly and ignored you completely.

Input now has two modes and picks automatically:

* **locked** — real pointer lock where it is permitted (cursor hidden, unlimited travel).
* **free-look** — the fallback: mouse look is read from ordinary `mousemove` deltas, the
  cursor is hidden over the canvas, and every button and key still works.

Keyboard is never gated behind pointer lock any more, mouse buttons register in both modes,
**arrow keys work as a look stick**, the canvas takes focus on click so an iframed game
receives key events, and a HUD pill tells you which mode you are in. A failed *programmatic*
lock (e.g. closing a menu) no longer condemns you to free-look — only a refused user gesture
does, so desktop players keep true pointer lock.

The boot test now simulates an iframe that refuses pointer lock and verifies all 57
controls under exactly those conditions.

## Controls audit & bug-fix pass

Every binding now comes from one source of truth (`src/controls.js`), which renders the
title screen list, the pause-menu **Controls** button and the **`F1`** overlay — so the
docs can never drift from the code. The boot test presses all 53 of them in the right
mode and asserts the effect: **53/53 verified**.

Fixed in this pass:

* Driving the Exocraft also walked your body — WASD moved the pilot *and* the rover,
  and `Space` fired the jetpack from the driver's seat. Player movement, jumping,
  mining and terrain editing are now suppressed while you drive.
* `B` opened build mode while flying the ship or driving the rover, leaving a ghost part
  stuck to the camera. Both are refused with an explanation now.
* `V` could drop the Exocraft mid-flight.
* Closing the galaxy map with `Esc` released the mouse and never recaptured it.
* Photo mode pushed an empty line into the message log every time you left it.
* Climbing to orbit was free — atmospheric launches and the instant `Q` launch now both
  burn launch-thruster fuel, with a warning when the tank is dry.
* Sentinel fire hit your exosuit shield while you were sealed inside your ship; it hits
  the hull now.
* Sentinels and their shots froze in mid-air while you flew overhead — the whole surface
  combat layer keeps simulating during atmospheric flight.
* Removed the dead instant-landing path left over from before seamless entry.

## Cockpit & seamless landings

* **First-person cockpit** (`T`) — a full interior: dashboard, canopy struts, side consoles
  with blinking LEDs, control grips, pilot seat, interior lighting, and **three live MFD
  screens** rendered from canvas textures showing speed, altitude, target, shield/hull/fuel
  bars and contacts. Works both in space and while flying in atmosphere; the hull hides
  itself from the inside so nothing clips your view.
* **Seamless atmospheric entry** — no "hold E to land", no cut. Fly your ship at a planet
  and you punch through the atmosphere: heat glow builds across the screen, the camera
  shakes, and you come out the other side *still flying your ship*, now over streaming
  terrain. Where you hit the globe determines where you arrive — entry point is mapped
  lat/long → surface coordinates, so the same approach always brings you to the same ground.
* **Atmospheric flight** — proper low-altitude flight model with throttle, pitch/yaw/roll,
  vertical thrusters (`Space`/`Ctrl`), hover assist that releases near the ground so you
  actually settle on your gear, and hard-landing hull damage if you slam it in.
* **Land anywhere, walk away** — set down, press `F` to disembark, explore on foot, then
  board again (`E`) and climb. Pass 1,400 m on the way up and you slide straight back into
  space above the point you left from. `Q` at the ship still does an instant launch to orbit.

## The "everything" update

* **Base building** — eight part types (habitat pods, storage containers, signal beacons,
  hydroponic trays, solar panels, teleporters, floodlights, walls) placed with a ghost
  preview in build mode (`B`). Bases persist per planet in your save, storage containers
  raise your stack limit, habitats restore life support, solar panels trickle-charge your
  shield, and beacons show up on your compass.
* **Base teleporter network** — build teleporters on two worlds and hop between them
  instantly, across systems and even galaxies.
* **Farming** — plant five crop types in hydroponic trays. They grow in real time
  (3–7 minutes), visibly sprouting, and pay out resources when harvested.
* **Terrain manipulator** — `Z` digs, `X` raises. Deformations are stored per planet,
  folded into the height function, and the affected chunks rebuild immediately.
* **Exocraft rover** — buy one at the Anomaly for nanites, summon it anywhere with `V`,
  board with `F`, and drive with proper suspension, boost and wheel spin.
* **Crashed starships** — find wrecks planetside, pay the repair bill in salvage, and
  claim them as new ships with randomised stats that join your fleet.
* **Three alien races** — Gek, Korvax and Vy'keen, with standing, procedural dialogue
  encounters at outposts and stations, branching choices, and a **language** you learn
  one word at a time (24 words to find).
* **Capital freighters & frigate expeditions** — buy a capital ship, hire up to five
  frigates, and send them on real-time expeditions that return with units, nanites and cargo.
* **The Atlas Path** — a seven-step story chain with lore, objectives tracked on the HUD,
  and Atlas Interfaces floating in deep space that give you Atlas Seeds.
* **Milestones** — eight journey achievements with four tiers each and unit payouts.
* **Nutrient processor** — four cooked meals granting timed buffs: hazard immunity,
  jetpack efficiency, mining speed and shield capacity.
* **Buy-side market** — stations now sell stock as well as buy it, so you can run
  genuine trade routes between economies.

## The galaxies update

* **Sixteen named galaxies** — Euclid-VII, Hilbert Dimension, Calypso, Hesperius, Hyades,
  Ickjamatew, Budullangr, Kikolgallr, Eltiensleen, Eissentam, Elkupalos, Aptarkaba,
  Ontiniangp, Odiwagiri, Ogtialabi and Muhacksonto — each with its **own shape**
  (spiral, barred, elliptical, ring, irregular), palette, size, and traits that change
  play: hostility, resource richness and exotic-world frequency.
* **Wormholes** — stable paired mouths scattered through every galaxy. Fly into one and
  you come out hundreds of light years away, free of your jump range. The map draws the
  whole network as arcs.
* **The Gate** — one rare intergalactic rift per galaxy, out on the rim, that tears you
  into an entirely different galaxy without going anywhere near the core.
* **Ancient portals** — roughly a third of worlds hide a glyph portal. Step through it
  and you are standing on a planet in a completely different star system, ship and all.
* **Star-class gating & drives** — red, green, blue and pink dwarf stars need the
  Cadmium, Emeril and Indium drives. Buy them with nanites at…
* **The Space Anomaly** — a way station that appears in ~30% of systems. Nanite exchange,
  hyperdrive upgrades, full restoration, and your traveller record.
* **Route planner** — pick any star and the map plots a legal multi-jump path (wormholes
  included, locked stars excluded). `Enter` takes the next hop automatically.
* **Intergalactic map view** (`G` in the map) — all sixteen galaxies drawn as little
  procedural portraits, showing which you have charted.
* **The Core** now moves you to the *next named galaxy* rather than a reskin, with the
  full 250,000 unit + 1,500 nanite breach bonus.

## What's in the combat & economy update

* **Sentinels & on-foot combat** — strip a planet and drones come looking. A 3-level
  wanted system escalates the swarm; fight back with the right-click boltcaster, an
  exosuit shield that regenerates out of combat, and a death/revive loop that costs cargo.
* **Mission board** — procedural contracts at every station (xenobiology surveys, bounty
  hunts, supply runs, cartography, archaeology, sentinel suppression) with a live HUD
  tracker and units + nanite payouts.
* **Refiner & fabricator** (`C`) — nine recipes: warp cells, chromatic smelting, carbon
  fusion, life-support gel, hazard cells, shield batteries, launch fuel, nanite clusters,
  hull plates.
* **Shipyard** — four ships (Radiant Shuttle, Vyk-3 Interceptor, Ponderous Freighter,
  Long Sight Explorer) with real trade-offs in speed, damage, shields, cargo and warp range.
* **Freighters & cargo pods** — capital ships drift through systems; crack their pods for salvage.
* **Black holes** — a gravity well that drags you in and spits you out hundreds of light
  years closer to the centre of the galaxy, at the cost of hull integrity.
* **The Galactic Core** — reach the innermost system and fly into the singularity to break
  through into an entirely new procedural galaxy, keeping everything you own.
* **Stars burn** — fly too close and your shields, then your hull, cook off.
* **Three new upgrade lines** — exosuit shielding, boltcaster module, analysis visor.
* **Settings menu** — FOV, sensitivity, invert Y, bloom, render scale, shadows, music/SFX.
* **Photo mode** (`H`), **renameable discoveries**, **creature feeding** (`G`),
  **auroras**, **shooting stars** and a **generative ambient soundtrack**.

## The universe

**Up to 380 star systems per galaxy**, laid out by the galaxy's own shape function, each
seeded with a name, star class, economy, wealth, conflict level, pirate population,
wormhole links and 2–6 planets. Deterministic: the same sixteen galaxies exist on every
machine, forever. Generation guarantees no system is ever stranded outside jump range.

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
| **Flying** | Fly at a planet to enter its atmosphere · `Space`/`Ctrl` climb and descend · `F` disembark · `T` cockpit view |
| **Interact** | Hold `E` to dock, `E` to board your ship, `Q` for instant launch · hold `F` to scan planets, lifeforms and ruins |
| **On-foot combat** | Right-click boltcaster · sentinels escalate as you mine |
| **Building** | `B` build mode · `[` `]` cycle parts · left-click place · `X` demolish |
| **Terraform** | `Z` dig · `X` raise (outside build mode) |
| **Exocraft** | `V` summon · `F` board/leave · WASD drive · Shift boost |
| **Navigation** | `M` galaxy map · `Enter` warp / next hop · `G` intergalactic view · `Q`/`E` rotate · wheel zoom |
| **Utility** | `C` refiner · `R` recharge hazard · `G` refuel ship / feed fauna |
| **System** | `Tab` journey log · `H` photo mode · `Ctrl+S` save · `P` exposure · `Esc` release mouse |

## Layout

```
index.html        HUD, title, galaxy map, station and log overlays
styles.css        the whole interface
src/main.js       renderer, post-processing, mode switching, game loop
src/universe.js   galaxy / system / planet / biome / economy generation
src/missions.js   procedural contracts and progress tracking
src/crafting.js   refiner recipes and cooked buffs
src/building.js   base parts, farming, teleport network
src/aliens.js     races, standing, language, dialogue encounters
src/fleet.js      capital ships and frigate expeditions
src/story.js      the Atlas Path and journey milestones
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
tools/            headless jsdom test rigs (npm test, npm run test:boot)
```

## Tests

`npm test` drives every subsystem headlessly (thousands of frames of flight, combat,
landing, terrain streaming, missions, crafting, shipyard, black holes, the core).
`npm run test:boot` goes further: it boots the *real* `src/main.js` against a stubbed
WebGL2 context, clicks through the title screen and overlays, lands on a planet and
launches again — asserting zero console errors throughout.
