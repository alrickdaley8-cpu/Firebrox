# Firebrox — Green Lantern Mod

> *In brightest day, in blackest night, no evil shall escape my sight...*

A **Minecraft Fabric** mod that adds a Green Lantern–style **Power Ring** driven by
a "willpower" energy system. Charge your ring at a **Power Battery**, then spend
willpower on hard-light **constructs**: an energy beam, sustained flight, a
protective shield, and a hard-light platform.

- **Minecraft:** 1.20.1
- **Loader:** Fabric
- **Requires:** Fabric API
- **Java:** 17+

---

## Features

| Content | Description |
|---|---|
| **Power Ring** | Wearable/held item that stores up to **200 willpower**. Shows a green charge bar, a glint when charged, and a tooltip with current construct. |
| **Power Battery** | A glowing lantern block. Right-click it with a ring in hand to instantly recharge to full (green particle burst + beacon hum). |
| **Willpower Crystal** | Crafting component (emerald + diamond + glowstone) used to make the ring and battery. |
| **Constructs** | Cycle between four powers and activate the selected one. |
| **HUD** | A willpower gauge and the selected construct render bottom-left whenever you hold a ring. |

### Constructs & costs

| Construct | Cost | Effect |
|---|---|---|
| **Energy Beam** | 6 | Fires a hard-light bolt up to 24 blocks; ~7 damage + knockback to the first entity hit. |
| **Flight** | 2 / sec | Toggles sustained creative-style flight; drains willpower each second and drops you when empty. |
| **Shield** | 20 | 12s of Resistance IV + Absorption III + Fire Resistance, with a spherical particle shell. |
| **Platform** | 8 | Manifests a 3×3 hard-light (green stained glass) platform under your feet. |

### Controls (rebindable in Options → Controls → Green Lantern)

| Key | Action |
|---|---|
| **R** | Activate the selected construct |
| **V** | Next construct |
| **C** | Previous construct |
| **Right-click** the Power Battery | Recharge the ring |

---

## Crafting

**Willpower Crystal**
```
 E      E = Emerald
EDE     D = Diamond
 G      G = Glowstone Dust
```

**Power Ring**
```
 G      G = Gold Ingot
G C     C = Willpower Crystal
 G
```

**Power Battery**
```
IGI     I = Iron Ingot
ICI     G = Glass Pane
IGI     C = Willpower Crystal
```

You can also grab all items from the **Green Lantern** creative tab (the ring comes fully charged there).

---

## Building

This repository ships the complete Fabric source tree. It was authored in an
environment without network access to the Java/Gradle/Fabric toolchain, so you
build it locally:

### 1. One-time: generate the Gradle wrapper JAR

The text wrapper scripts (`gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.properties`)
are included, but the binary `gradle-wrapper.jar` is not committed. Generate it
once with a locally-installed Gradle (8.x):

```bash
gradle wrapper --gradle-version 8.7
```

If you don't have Gradle installed, get it from https://gradle.org/install/
(or `sdk install gradle 8.7` via SDKMAN). After this step you can use `./gradlew`
for everything.

### 2. Build the mod

```bash
./gradlew build
```

The finished jar lands in `build/libs/greenlantern-1.0.0.jar`. Drop it (and the
[Fabric API](https://modrinth.com/mod/fabric-api)) into your `.minecraft/mods`
folder alongside the Fabric loader for 1.20.1.

### 3. Run in a dev environment (optional)

```bash
./gradlew runClient
```

---

## Project layout

```
build.gradle, settings.gradle, gradle.properties   Fabric Loom build config
src/main/java/net/firebrox/greenlantern/
├── GreenLantern.java            Mod entrypoint / registry bootstrap
├── item/
│   ├── ModItems.java            Item + creative-tab registration
│   └── PowerRingItem.java       Ring item: NBT willpower + construct, bar, tooltip
├── block/
│   ├── ModBlocks.java           Block registration
│   └── PowerBatteryBlock.java   Charging station (right-click to refill)
├── power/
│   ├── RingConstruct.java       Enum of powers + costs
│   ├── RingPowerHandler.java    Server-side construct application (beam/shield/platform/flight)
│   └── FlightManager.java       Per-second flight drain + ability management
└── network/
    └── ModNetworking.java       Client→server activate / cycle packets
src/client/java/net/firebrox/greenlantern/client/
├── GreenLanternClient.java      Keybinds + packet sending
└── RingHudOverlay.java          Willpower HUD
src/main/resources/
├── fabric.mod.json              Mod metadata
├── assets/greenlantern/...      Lang, models, blockstates, textures, icon
└── data/greenlantern/...        Recipes, loot tables, tags
tools/gen_textures.py            Regenerates the pixel-art textures (stdlib only)
```

## Regenerating textures

```bash
python3 tools/gen_textures.py
```

## License

MIT — see [LICENSE](LICENSE).
