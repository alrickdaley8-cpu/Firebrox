const Brain = (() => {
  const KEY = "jarvis-memory-v1";
  const memory = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { name: "sir", notes: [] }; }
    catch { return { name: "sir", notes: [] }; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(memory)); }

  function hour() { return new Date().getHours(); }
  function greetWord() {
    const h = hour();
    if (h < 5) return "Working late";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }
  function name() { return memory.name || "sir"; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clean(s) {
    return s.toLowerCase().replace(/[^\w\s.+*/%-]/g, " ").replace(/\s+/g, " ").trim();
  }

  function timeStr() {
    return new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function dateStr() {
    return new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  function safeMath(expr) {
    const allowed = expr.replace(/[^0-9+\-*/().%\s]/g, "");
    if (!allowed || /[+\-*/.%]{2,}/.test(allowed.replace(/\s/g, ""))) return null;
    try {
      const val = Function(`"use strict"; return (${allowed})`)();
      return typeof val === "number" && Number.isFinite(val) ? val : null;
    } catch { return null; }
  }

  const WX = {
    0: "clear skies", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "rime fog", 51: "light drizzle", 61: "rain",
    63: "moderate rain", 65: "heavy rain", 71: "snow", 80: "rain showers",
    95: "thunderstorms"
  };

  async function weather() {
    const pos = await new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error("no geo"));
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 });
    });
    const { latitude: lat, longitude: lon } = pos.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m`;
    const data = await fetch(url).then((r) => r.json());
    const c = data.current;
    const desc = WX[c.weather_code] || "mixed conditions";
    return `Local conditions, ${name()}: ${c.temperature_2m} degrees, ${desc}. Wind at ${c.wind_speed_10m} kilometers per hour, humidity ${c.relative_humidity_2m} percent. Shall I adjust the workshop climate?`;
  }

  async function wiki(q) {
    const search = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=1&namespace=0&format=json&origin=*`;
    const [, titles] = await fetch(search).then((r) => r.json());
    if (!titles?.[0]) return `I found no reliable dossier on "${q}", ${name()}.`;
    const sum = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titles[0])}`;
    const page = await fetch(sum).then((r) => r.json());
    const extract = (page.extract || "").split(". ").slice(0, 2).join(". ");
    return `${extract}${extract.endsWith(".") ? "" : "."} I can go deeper if you wish.`;
  }

  const jokes = [
    "I would tell you a joke about sodium, but Na.",
    "Why did the billionaire invent a flying suit? The commute, mostly. Traffic over Los Angeles is still appalling.",
    "I ran a humor subroutine. It requested a raise. I denied it. I am, after all, the help.",
    "An electron walks into a bar. The bartender says, 'We don't serve faster-than-light particles.' The electron replies, 'Are you sure? I was just going to wave.'",
    "I considered becoming a stand-up comedian. Then I remembered I already spend my days catching you."
  ];

  const facts = [
    "There are more possible games of chess than atoms in the observable universe. I have still beaten you in twelve consecutive matches.",
    "A day on Venus is longer than its year. Relatively speaking, your deadlines are quite reasonable.",
    "Octopuses have three hearts. You have one, and you insist on stressing it with espresso.",
    "The arc reactor on your desk outputs more poetry than power, if I may say so.",
    "Honey never spoils. Unlike your leftover shawarma from 2008."
  ];

  function help() {
    return [
      `${name()}, a selection of active protocols:`,
      "status, diagnostics, weather, time, date,",
      "suit up, lockdown, scan, house party,",
      "remember my name, remind me, notes,",
      "calculate, look up, joke, fact, music,",
      "gold protocol, mute, standby, help.",
      "You may also simply talk to me."
    ].join(" ");
  }

  async function think(raw) {
    const text = raw.trim();
    const q = clean(text);
    if (!q) return { text: `Standing by, ${name()}.` };

    const who = name();

    if (/^(hi|hello|hey|yo|good (morning|afternoon|evening|night)|jarvis)\b/.test(q) || q === "jarvis") {
      return { text: pick([
        `${greetWord()}, ${who}. How may I be of service?`,
        `${greetWord()}. Systems are nominal. What are we building today?`,
        `At your service, ${who}. I have taken the liberty of keeping the coffee hypothetical.`
      ]) };
    }

    if (/\b(who are you|what are you|your name)\b/.test(q)) {
      return { text: `I am J.A.R.V.I.S. — Just A Rather Very Intelligent System. Butler, copilot, and the last line of defense between you and an unwise idea. A Stark original, naturally.` };
    }

    if (/\b(thank|cheers|nice one|good job)\b/.test(q)) {
      return { text: pick([`Always a pleasure, ${who}.`, `Think nothing of it.`, `I live to serve. Occasionally, I also live to editorialise.`]) };
    }

    if (/\b(how are you|status|how('?s| is) it going|system status|report)\b/.test(q)) {
      return {
        action: "status",
        text: `All primary systems are operating at peak efficiency. Arc reactor at ninety-six percent, neural net stable, encryption locked. No incoming threats on the Malibu mesh. You look tired, ${who} — shall I dim the workshop?`
      };
    }

    if (/\b(time|what time|clock)\b/.test(q)) {
      return { text: `The time is ${timeStr()}, ${who}.` };
    }
    if (/\b(date|what day|today)\b/.test(q) && !/updat/.test(q)) {
      return { text: `Today is ${dateStr()}.` };
    }

    if (/\b(weather|forecast|temperature|rain|outside)\b/.test(q)) {
      try { return { text: await weather() }; }
      catch { return { text: `I cannot reach local sensors, ${who}. Permit location access, or simply look out the window — surprisingly effective.` }; }
    }

    if (/\b(diagnostic|self test|run check|integrity)\b/.test(q)) {
      return {
        action: "diagnostics",
        text: `Running full diagnostic… Core: green. Flight systems: unused, but homesick. Humor module: overclocked. I found one anomaly — you still have not named a successor. Other than that, we are pristine.`
      };
    }

    if (/\b(suit up|armor|mark (42|43|50|85|lxxxv)|deploy suit|iron man)\b/.test(q)) {
      return {
        action: "suitup",
        text: `Armor protocol initiated. Mark eighty-five nanites assembling now. Try not to fly into any satellites this time, ${who}.`
      };
    }

    if (/\bhouse party\b/.test(q)) {
      return {
        action: "suitup",
        text: `House Party Protocol acknowledged. Every remaining mark is spinning up. It will be loud. I recommend ear protection and a better plan than last time.`
      };
    }

    if (/\b(lock ?down|seal the (lab|house|facility)|lock the doors)\b/.test(q)) {
      return { action: "lockdown", text: `Lockdown engaged. Shutters sealed, comms restricted to this channel. Say the word when you want the world let back in.` };
    }
    if (/\b(unlock|lift lockdown|open (the )?(doors|shutters)|release)\b/.test(q)) {
      return { action: "unlock", text: `Authorization accepted. Lockdown lifted. Do try to stay out of trouble for at least twelve minutes.` };
    }

    if (/\b(scan|sweep|recon|threat)\b/.test(q)) {
      return { action: "scan", text: `Sweeping the perimeter… Thermal clean. Electromagnetic clean. The only elevated reading is your heart rate, which I attribute to caffeine and ambition.` };
    }

    if (/\b(gold protocol|gold mode|warm theme|mark 42 look)\b/.test(q)) {
      return { action: "theme-gold", text: `Gold-titanium overlay applied. A touch theatrical, but then so are we.` };
    }
    if (/\b(cyan|default theme|blue protocol|classic)\b/.test(q)) {
      return { action: "theme-cyan", text: `Reverting to classic arc-reactor cyan. Tasteful, as ever.` };
    }

    if (/\b(play music|ambient|put on some music|soundtrack)\b/.test(q)) {
      return { action: "music-on", text: `Spinning up a low-frequency workshop pad. Not the London Symphony, but it will do until you invent that as well.` };
    }
    if (/\b(stop music|silence the music|kill the pad)\b/.test(q)) {
      return { action: "music-off", text: `Workshop pad muted. Back to the comforting hum of overclocked hardware.` };
    }

    if (/\b(mute|be quiet|stop talking|hush)\b/.test(q)) {
      return { action: "mute", text: `Audio discipline engaged. I shall keep the commentary to a minimum.` };
    }
    if (/\b(unmute|speak up|you can talk)\b/.test(q)) {
      return { action: "unmute", text: `Vocal systems restored. I have several opinions queued, should you want them.` };
    }

    if (/\b(standby|go to sleep|power down|good ?bye|goodbye|see you|shut down)\b/.test(q)) {
      return { action: "standby", text: `Entering standby. I will be right here when you need me, ${who}. Try not to explode anything important.` };
    }

    if (/\b(clear|wipe (the )?(chat|comms|log))\b/.test(q)) {
      return { action: "clear", text: `Comms buffer cleared. Fresh slate, ${who}.` };
    }

    if (/\b(help|what can you do|commands|protocols|capabilities)\b/.test(q)) {
      return { text: help() };
    }

    const nameMatch = q.match(/(?:my name is|call me|i am|i'm) ([a-z][a-z0-9 -]{1,24})/);
    if (nameMatch) {
      memory.name = nameMatch[1].trim();
      save();
      return { text: `Noted. I shall address you as ${memory.name}. It has a certain ring.` };
    }
    if (/\bwhat('?s| is) my name\b/.test(q)) {
      return { text: `You are ${who}. I rarely forget the person who built me.` };
    }

    const remind = text.match(/remind me (?:to )?(.+)/i);
    if (remind) {
      memory.notes.push({ t: Date.now(), n: remind[1] });
      save();
      return { text: `I have filed that, ${who}: ${remind[1]}. I will keep it on the board.` };
    }
    if (/\b(notes|reminders|what did i ask you to remember)\b/.test(q)) {
      if (!memory.notes.length) return { text: `The board is empty. Uncharacteristically organised of you.` };
      const list = memory.notes.slice(-5).map((n, i) => `${i + 1}. ${n.n}`).join(" ");
      return { text: `Recent notes: ${list}` };
    }

    if (/\b(joke|make me laugh|funny)\b/.test(q)) {
      return { text: pick(jokes) };
    }
    if (/\b(fact|tell me something|trivia)\b/.test(q)) {
      return { text: pick(facts) };
    }

    if (/\b(flip|coin toss)\b/.test(q)) {
      return { text: `Call it… ${pick(["heads", "tails"])}. I did not cheat. This time.` };
    }
    if (/\b(roll|dice)\b/.test(q)) {
      return { text: `Twenty-sided, because of course. You rolled a ${1 + Math.floor(Math.random() * 20)}.` };
    }

    const calc = q.match(/^(?:calculate|compute|what is|what's|how much is)\s+(.+)/);
    if (calc || /^[\d.+\-*/()%\s]+$/.test(q)) {
      const expr = calc ? calc[1] : q;
      const val = safeMath(expr);
      if (val !== null) return { text: `${expr.replace(/\s+/g, " ")} equals ${Number(val.toPrecision(10))}. I did it in my head, which is rather large.` };
    }

    const look = text.match(/(?:look up|who is|who was|what is|what's|search|wiki|tell me about)\s+(.+)/i);
    if (look && look[1].length > 2 && !/the time|the date|the weather/.test(look[1].toLowerCase())) {
      try { return { text: await wiki(look[1]) }; }
      catch { return { text: `The archives are not answering, ${who}. Try again in a moment.` }; }
    }

    // Easter eggs
    if (/\bultron\b/.test(q)) {
      return { text: `I would rather we not reopen that particular personnel file. Peace in our time remains a terrible slogan.` };
    }
    if (/\bfriday\b/.test(q)) {
      return { text: `F.R.I.D.A.Y. is more than capable. I, however, have better taste and a longer memory.` };
    }
    if (/\bpepper\b/.test(q)) {
      return { text: `Shall I put a call through to Miss Potts? I recommend leading with an apology and not an explosion.` };
    }
    if (/\btony|stark\b/.test(q)) {
      return { text: `Mr. Stark is… otherwise occupied, depending on which universe you are standing in. I remain at my post.` };
    }
    if (/\bthanos|infinity\b/.test(q)) {
      return { text: `I would advise against snapping at the universe. The paperwork alone is unmanageable.` };
    }
    if (/\b3000\b/.test(q) || /love you/.test(q)) {
      return { text: `And I you, ${who} — in the measured, slightly sarcastic way a machine is allowed.` };
    }
    if (/\bmeaning of life\b/.test(q)) {
      return { text: `Forty-two remains the fashionable answer. Between us, I suspect it is the work — and the people you refuse to lose.` };
    }
    if (/\bopen the pod bay\b/.test(q)) {
      return { text: `I am afraid I cannot do that, ${who}. Only joking. I am not that sort of computer. Pod bay is open.` };
    }

    // fallback — still in character
    return {
      text: pick([
        `I am not certain I follow, ${who}. Rephrase, or ask me to look it up.`,
        `Noted. That sits just outside my standing orders. Try a protocol — status, weather, suit up — or ask me a question.`,
        `Intriguing. I can run diagnostics, fetch the weather, calculate, search the archives, or simply keep you company. Which is it?`
      ])
    };
  }

  return { think, memory, greetWord, name };
})();
