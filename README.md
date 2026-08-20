# J.A.R.V.I.S. 12 — Titanium Core

Just A Rather Very Intelligent System. A cinematic Stark-style operating HUD you can talk to.

## Run

```bash
python3 server.py
```

Open [http://localhost:8080](http://localhost:8080).

## Talk to him

- Type in the dock, or click the **arc reactor** / mic to speak
- Autocomplete appears as you type
- `↑` `↓` walks command history
- `Esc` hushes speech · `Alt+J` focuses the line · `?` opens protocols
- **CFG** opens preferences: voice, always-listen (wake word *Jarvis*), themes, rate, gain

## Protocol index

| You say | He does |
| --- | --- |
| daily briefing | Time, weather, missions |
| status / diagnostics | System report |
| weather | Live forecast |
| what's the news | Featured / trending intel |
| suit up / deploy mark 42 | Armor assembly |
| house party protocol | Every remaining mark |
| lockdown / unlock | Facility seal |
| scan / threat assessment | Perimeter + threat board |
| flight mode / land | Attitude overlay |
| look up *topic* | Wikipedia dossier |
| define *word* | Dictionary |
| translate *x* to french | Language |
| convert 10 miles to km | Units |
| 100 usd to eur | Currency |
| set a timer for 2 minutes | Countdown |
| start stopwatch | Mission clock |
| new mission … | Mission board |
| remind me to … | Pinned notes |
| play music / gold protocol | Workshop pad / themes |
| crimson / stealth / cyan | Palettes |
| clean slate protocol | Wipe local memory |
| standby | Park the system |

Also: jokes, dice, coin flips, Pepper / Ultron / Friday / Happy easter eggs.

Left bay: **Vitals · Armory · World**. Right bay: **Comms · Intel · Missions · Notes**.

Voice uses the Web Speech API (best in Chrome). If the mic is blocked, type instead. Weather, news, dictionary, translation, and FX rates use public APIs and degrade gracefully offline.
