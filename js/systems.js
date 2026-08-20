const Systems = (() => {
  const KEY = "jarvis-os-v12";
  const ARMOR = [
    { id: "mk3", mark: "III", name: "Mark III", note: "Classic gold-titanium" },
    { id: "mk7", mark: "VII", name: "Mark VII", note: "New York kit" },
    { id: "mk42", mark: "XLII", name: "Mark 42", note: "Prehensile" },
    { id: "mk43", mark: "XLIII", name: "Mark 43", note: "House upgrade" },
    { id: "mk50", mark: "L", name: "Mark 50", note: "Bleeding Edge" },
    { id: "mk85", mark: "LXXXV", name: "Mark 85", note: "Endgame plate" }
  ];

  const PROTOCOLS = [
    { cmd: "daily briefing", hint: "Time, weather, missions" },
    { cmd: "status report", hint: "System vitals" },
    { cmd: "run diagnostics", hint: "Full integrity check" },
    { cmd: "weather", hint: "Local forecast" },
    { cmd: "what's the news", hint: "World intel" },
    { cmd: "suit up", hint: "Assemble current mark" },
    { cmd: "deploy mark 42", hint: "Select and assemble" },
    { cmd: "house party protocol", hint: "All remaining marks" },
    { cmd: "lockdown", hint: "Seal the facility" },
    { cmd: "unlock", hint: "Lift lockdown" },
    { cmd: "initiate scan", hint: "Perimeter sweep" },
    { cmd: "threat assessment", hint: "Hostile analysis" },
    { cmd: "flight mode", hint: "Attitude overlay" },
    { cmd: "land", hint: "Disengage flight" },
    { cmd: "play music", hint: "Workshop pad" },
    { cmd: "stop music", hint: "Kill the pad" },
    { cmd: "gold protocol", hint: "Gold-titanium theme" },
    { cmd: "crimson protocol", hint: "Combat theme" },
    { cmd: "stealth protocol", hint: "Low-visibility theme" },
    { cmd: "cyan protocol", hint: "Classic theme" },
    { cmd: "dim lights", hint: "Calm motion" },
    { cmd: "set a timer for 2 minutes", hint: "Countdown" },
    { cmd: "start stopwatch", hint: "Mission clock" },
    { cmd: "new mission repair the gauntlet", hint: "File a mission" },
    { cmd: "look up arc reactor", hint: "Archives" },
    { cmd: "define entropy", hint: "Dictionary" },
    { cmd: "translate hello to french", hint: "Language" },
    { cmd: "convert 10 miles to km", hint: "Units" },
    { cmd: "100 usd to eur", hint: "Currency" },
    { cmd: "remind me to call Pepper", hint: "Notes" },
    { cmd: "my name is", hint: "Identity" },
    { cmd: "clean slate protocol", hint: "Wipe memory" },
    { cmd: "standby", hint: "Park systems" },
    { cmd: "help", hint: "Protocol index" }
  ];

  const UNITS = {
    km: 1, kilometer: 1, kilometers: 1,
    m: 0.001, meter: 0.001, meters: 0.001,
    mile: 1.60934, miles: 1.60934,
    ft: 0.0003048, feet: 0.0003048, foot: 0.0003048,
    inch: 0.0000254, inches: 0.0000254,
    kg: 1, kilogram: 1, kilograms: 1,
    lb: 0.453592, lbs: 0.453592, pound: 0.453592, pounds: 0.453592,
    g: 0.001, gram: 0.001, grams: 0.001,
    c: "temp", f: "temp", celsius: "temp", fahrenheit: "temp"
  };

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch { return {}; }
  }

  const saved = load();
  const state = {
    name: saved.name || "sir",
    notes: saved.notes || [],
    missions: saved.missions || [],
    theme: saved.theme || "cyan",
    armor: saved.armor || "mk85",
    voice: saved.voice !== false,
    tones: saved.tones !== false,
    started: Date.now(),
    lastWiki: null,
    lastIntent: "",
    lastRaw: "",
    timers: [],
    stopwatch: null,
    history: []
  };

  function persist() {
    localStorage.setItem(KEY, JSON.stringify({
      name: state.name,
      notes: state.notes,
      missions: state.missions,
      theme: state.theme,
      armor: state.armor,
      voice: state.voice,
      tones: state.tones
    }));
  }

  function convert(n, from, to) {
    const a = UNITS[from];
    const b = UNITS[to];
    if (a === "temp" || b === "temp") {
      const f = from[0];
      const t = to[0];
      if (f === "c" && t === "f") return n * 9 / 5 + 32;
      if (f === "f" && t === "c") return (n - 32) * 5 / 9;
      return null;
    }
    if (typeof a !== "number" || typeof b !== "number") return null;
    return n * a / b;
  }

  return {
    ARMOR,
    PROTOCOLS,
    state,
    persist,
    convert,
    armor() { return ARMOR.find((a) => a.id === state.armor) || ARMOR[5]; },
    addNote(n) {
      state.notes.push({ t: Date.now(), n });
      persist();
    },
    addMission(title) {
      const m = { id: Date.now(), title, done: false };
      state.missions.push(m);
      persist();
      return m;
    },
    completeMission(i) {
      const m = state.missions[i];
      if (m) { m.done = true; persist(); }
      return m;
    },
    wipe() {
      state.name = "sir";
      state.notes = [];
      state.missions = [];
      persist();
    },
    uptime() {
      const s = Math.floor((Date.now() - state.started) / 1000);
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const sec = String(s % 60).padStart(2, "0");
      return `${h}:${m}:${sec}`;
    }
  };
})();
