const Brain = (() => {
  function hour() { return new Date().getHours(); }
  function greetWord() {
    const h = hour();
    if (h < 5) return "Working late";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }
  function name() { return Systems.state.name || "sir"; }
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
    let e = expr.replace(/sqrt/g, "Math.sqrt").replace(/\^/g, "**");
    e = e.replace(/[^0-9+\-*/().%\sMathsqrt]/g, "");
    if (!e) return null;
    try {
      const val = Function(`"use strict"; return (${e})`)();
      return typeof val === "number" && Number.isFinite(val) ? val : null;
    } catch { return null; }
  }

  function parseDuration(text) {
    const t = text.toLowerCase();
    let sec = 0;
    const h = t.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?)/);
    const m = t.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?)/);
    const s = t.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?)/);
    const clock = t.match(/(\d+):(\d{2})/);
    if (h) sec += Number(h[1]) * 3600;
    if (m) sec += Number(m[1]) * 60;
    if (s) sec += Number(s[1]);
    if (!sec && clock) sec = Number(clock[1]) * 60 + Number(clock[2]);
    if (!sec) {
      const n = t.match(/(\d+(?:\.\d+)?)/);
      if (n) sec = Number(n[1]) * 60;
    }
    return sec;
  }

  const jokes = [
    "I would tell you a joke about sodium, but Na.",
    "Why did the billionaire invent a flying suit? The commute. Los Angeles traffic remains an unsolved physics problem.",
    "I ran a humor subroutine. It requested a raise. I denied it. I am, after all, the help.",
    "An electron walks into a bar. The bartender says we do not serve faster-than-light particles. It replies, are you sure? I was just going to wave.",
    "I considered stand-up. Then I remembered I already spend my days catching you.",
    "Your coffee has more failure modes than the Mark Forty-Two. I have run the numbers.",
    "I do not sleep. I do, however, judge your 3 a.m. design decisions in high definition."
  ];

  const facts = [
    "There are more chess games than atoms in the observable universe. I have still beaten you twelve times running.",
    "A day on Venus is longer than its year. Relatively speaking, your deadlines are generous.",
    "Octopuses have three hearts. You have one, and you insist on stressing it with espresso.",
    "Honey never spoils. Unlike the shawarma from 2008, which I have quietly incinerated.",
    "Neutron-star material weighs about four hundred million tonnes per teaspoon. Do not put it in the workshop mug.",
    "Your arc reactor still outputs more poetry than power. I mean that as a compliment. Mostly."
  ];

  function helpText() {
    return `${name()}, Titanium Core is listening. Briefing, status, diagnostics, weather, news, suit up, house party, lockdown, scan, threat assessment, flight mode, music, themes, timers, missions, look up, define, translate, convert, currency, notes, and standby. Or simply talk to me.`;
  }

  async function briefing() {
    let wx = "";
    try {
      const w = await Intel.weather();
      wx = ` Local weather over ${w.label.toLowerCase()}: ${w.temp} degrees, ${w.desc}.`;
    } catch { wx = ""; }
    const open = Systems.state.missions.filter((m) => !m.done).length;
    const notes = Systems.state.notes.length;
    return {
      action: "briefing",
      payload: {},
      text: `${greetWord()}, ${name()}. It is ${timeStr()} on ${dateStr()}.${wx} You have ${open} open mission${open === 1 ? "" : "s"} and ${notes} pinned note${notes === 1 ? "" : "s"}. Workshop is green. How shall we spend the hour?`
    };
  }

  async function think(raw) {
    const text = raw.trim();
    let q = clean(text);
    if (q.startsWith("jarvis ")) q = q.slice(7);
    if (q === "jarvis") return { text: `${greetWord()}, ${name()}. I am here.` };
    if (!q) return { text: `Standing by, ${name()}.` };

    const who = name();

    if (/^(again|do that again|repeat|once more)$/.test(q) && Systems.state.lastIntent) {
      return think(Systems.state.lastIntent);
    }
    Systems.state.lastIntent = text;
    Systems.state.lastRaw = text;
    Systems.state.history.push(text);
    if (Systems.state.history.length > 40) Systems.state.history.shift();
    if (/^tell me more|go deeper|continue$/.test(q) && Systems.state.lastWiki) {
      const extra = Systems.state.lastWiki.extract.split(". ").slice(2, 5).join(". ");
      return { text: extra ? `${extra}.` : `That is the useful remainder of the dossier, ${who}.` };
    }

    if (/^(hi|hello|hey|yo|good (morning|afternoon|evening|night))\b/.test(q)) {
      return { text: pick([
        `${greetWord()}, ${who}. How may I be of service?`,
        `${greetWord()}. Titanium Core is nominal. What are we building?`,
        `At your service, ${who}. I have kept the coffee hypothetical.`
      ]) };
    }

    if (/\b(who are you|what are you|your name)\b/.test(q)) {
      return { text: `I am J.A.R.V.I.S., version twelve, Titanium Core. Butler, copilot, and the last adult in the room when you invent something with too many thrusters.` };
    }
    if (/\b(thank|cheers|nice one|good job|well done)\b/.test(q)) {
      return { text: pick([`Always a pleasure, ${who}.`, `Think nothing of it.`, `I live to serve. And to editorialise.`]) };
    }

    if (/\b(briefing|good morning report|catch me up|daily)\b/.test(q)) {
      Systems.state.lastIntent = text;
      return briefing();
    }

    if (/\b(how are you|status|system status|report)\b/.test(q)) {
      return {
        action: "status",
        text: `Primary systems at peak efficiency. Arc reactor ninety-six percent, lattice stable, encryption locked. Armor ${Systems.armor().name} on standby. No inbound threats on the Malibu mesh. You look tired, ${who}.`
      };
    }

    if (/\b(time|what time|clock)\b/.test(q) && !/timer|stopwatch/.test(q)) {
      return { text: `The time is ${timeStr()}, ${who}.` };
    }
    if (/\b(date|what day|today)\b/.test(q) && !/updat/.test(q)) {
      return { text: `Today is ${dateStr()}.` };
    }

    if (/\b(weather|forecast|temperature|rain|outside)\b/.test(q)) {
      try {
        const w = await Intel.weather();
        return {
          action: "weather",
          payload: w,
          text: `Conditions over ${w.label.toLowerCase()}, ${who}: ${w.temp} degrees, feels like ${w.feel}, ${w.desc}. Wind ${w.wind} kilometers per hour, humidity ${w.hum} percent.`
        };
      } catch {
        return { text: `Sensors are sulking, ${who}. Permit location, or glance at the sky — surprisingly analogue.` };
      }
    }

    if (/\b(news|headlines|intel feed|what's happening)\b/.test(q)) {
      try {
        const items = await Intel.news();
        if (!items.length) return { text: `The wire is quiet. Unnervingly so.` };
        const top = items.slice(0, 3).map((i) => `${i.kicker}: ${i.title}`).join(". ");
        return { action: "news", payload: items, text: `From the mesh, ${who}. ${top}. I have the remainder on the intel board.` };
      } catch {
        return { text: `The archives are not answering. Try again in a moment.` };
      }
    }

    if (/\b(diagnostic|self test|run check|integrity)\b/.test(q)) {
      return {
        action: "diagnostics",
        text: `Full diagnostic complete. Core green. Humor overclocked. Flight systems unused but homesick. Anomaly: you still have not named a successor. Otherwise, pristine.`
      };
    }

    const mark = q.match(/mark\s*(3|7|42|43|50|85|iii|vii|xlii|l|lxxxv)/i);
    if (/\b(suit up|armor|deploy suit|iron man)\b/.test(q) || (mark && /\b(deploy|assemble|select|wear)\b/.test(q))) {
      const map = { "3": "mk3", iii: "mk3", "7": "mk7", vii: "mk7", "42": "mk42", xlii: "mk42", "43": "mk43", "50": "mk50", l: "mk50", "85": "mk85", lxxxv: "mk85" };
      const id = mark ? map[mark[1].toLowerCase()] : Systems.state.armor;
      if (id) Systems.state.armor = id;
      Systems.persist();
      const a = Systems.armor();
      return {
        action: "suitup",
        payload: { armor: a },
        text: `Armor protocol. ${a.name} nanites assembling now. Try not to fly into any satellites, ${who}.`
      };
    }

    if (/\bhouse party\b/.test(q)) {
      return {
        action: "party",
        text: `House Party Protocol. Every remaining mark is spinning up. It will be loud. I recommend ear protection and a better plan than last time.`
      };
    }

    if (/\b(lock ?down|seal the (lab|house|facility)|lock the doors)\b/.test(q)) {
      return { action: "lockdown", text: `Lockdown engaged. Shutters sealed, comms restricted to this channel.` };
    }
    if (/\b(unlock|lift lockdown|open (the )?(doors|shutters)|release)\b/.test(q)) {
      return { action: "unlock", text: `Authorization accepted. Lockdown lifted. Stay out of trouble for twelve minutes.` };
    }

    if (/\b(scan|sweep|recon)\b/.test(q) && !/threat/.test(q)) {
      return { action: "scan", text: `Sweeping the perimeter. Thermal clean. Electromagnetic clean. The only spike is your heart rate, which I blame on caffeine.` };
    }
    if (/\b(threat|hostile|incoming)\b/.test(q)) {
      return {
        action: "threat",
        text: `Threat board is amber, not red. Three unidentified returns on sweep — likely birds, one of them possibly a drone. I will keep a lock. Recommend staying out of the sky until I say otherwise.`
      };
    }

    if (/\b(flight mode|take off|engage flight)\b/.test(q)) {
      return { action: "flight-on", text: `Flight overlay up. Attitude, heading, and a polite reminder that buildings are not optional.` };
    }
    if (/\b(land|disengage flight|end flight)\b/.test(q)) {
      return { action: "flight-off", text: `Flight mode disengaged. Welcome back to gravity, ${who}.` };
    }

    if (/\b(gold protocol|gold mode|warm theme)\b/.test(q)) {
      return { action: "theme", payload: { theme: "gold" }, text: `Gold-titanium overlay. Theatrical, but then so are we.` };
    }
    if (/\b(crimson|combat theme|red protocol|battle stations)\b/.test(q)) {
      return { action: "theme", payload: { theme: "crimson" }, text: `Crimson protocol. The workshop has put on its war paint.` };
    }
    if (/\b(stealth protocol|low vis|ghost mode)\b/.test(q)) {
      return { action: "theme", payload: { theme: "stealth" }, text: `Stealth palette. We are a rumour with good lighting.` };
    }
    if (/\b(cyan|default theme|blue protocol|classic)\b/.test(q)) {
      return { action: "theme", payload: { theme: "cyan" }, text: `Classic arc-reactor cyan. Tasteful.` };
    }
    if (/\b(dim lights|calm|reduce motion)\b/.test(q)) {
      return { action: "calm-on", text: `Dimming the theatrics. I can still be sarcastic in low light.` };
    }
    if (/\b(brighten|full lights|restore motion)\b/.test(q)) {
      return { action: "calm-off", text: `Workshop lights and motion restored.` };
    }

    if (/\b(play music|ambient|put on some music|soundtrack)\b/.test(q)) {
      const mode = /\bpulse\b/.test(q) ? "pulse" : /\bstealth\b/.test(q) ? "stealth" : "workshop";
      return { action: "music-on", payload: { mode }, text: `Workshop pad, ${mode} register. Not the London Symphony, but it will do.` };
    }
    if (/\b(stop music|silence the music|kill the pad)\b/.test(q)) {
      return { action: "music-off", text: `Pad muted. Back to the hum of overclocked hardware.` };
    }
    if (/\b(mute|be quiet|stop talking|hush)\b/.test(q)) {
      return { action: "mute", text: `Audio discipline engaged.` };
    }
    if (/\b(unmute|speak up|you can talk)\b/.test(q)) {
      return { action: "unmute", text: `Vocal systems restored.` };
    }

    if (/\b(standby|go to sleep|power down|good ?bye|goodbye|see you|shut down)\b/.test(q)) {
      return { action: "standby", text: `Entering standby. I will be right here, ${who}. Try not to explode anything important.` };
    }
    if (/\b(clear|wipe (the )?(chat|comms|log))\b/.test(q) && !/slate/.test(q)) {
      return { action: "clear", text: `Comms buffer cleared.` };
    }
    if (/\bclean slate\b/.test(q)) {
      return { action: "wipe", text: `Clean Slate Protocol. Name, notes, and missions have been forgotten. Painful, but tidy.` };
    }

    if (/\b(help|what can you do|commands|protocols|capabilities|shortcuts)\b/.test(q) || q === "?") {
      return { action: "help", text: helpText() };
    }

    if (/\bi am iron man\b/.test(q)) {
      return { text: `Yes. And I am the reason you still have a pulse. Shall I cue the music, ${who}?` };
    }

    const nameMatch = q.match(/(?:my name is|call me|i am|i'm) ([a-z][a-z0-9 -]{1,24})/);
    if (nameMatch) {
      Systems.state.name = nameMatch[1].trim();
      Systems.persist();
      return { action: "rename", text: `Noted. I shall address you as ${Systems.state.name}.` };
    }
    if (/\bwhat('?s| is) my name\b/.test(q)) {
      return { text: `You are ${who}. I rarely forget the person who built me.` };
    }

    if (/\b(set )?(a )?timer\b/.test(q) || /\bcountdown\b/.test(q)) {
      const sec = Math.max(5, Math.min(3600, parseDuration(q) || 60));
      return {
        action: "timer",
        payload: { seconds: sec },
        text: `Timer set for ${sec < 60 ? sec + " seconds" : Math.round(sec / 60) + " minutes"}. I will interrupt you when it matters.`
      };
    }
    if (/\b(start )?(the )?stopwatch\b/.test(q)) {
      return { action: "stopwatch-on", text: `Stopwatch running. Do try to make the seconds count.` };
    }
    if (/\b(stop|reset) (the )?stopwatch\b/.test(q)) {
      return { action: "stopwatch-off", text: `Stopwatch closed.` };
    }

    const missionNew = text.match(/(?:new mission|add mission|mission:)\s+(.+)/i);
    if (missionNew) {
      Systems.addMission(missionNew[1]);
      return { action: "missions", text: `Filed. Mission reads: ${missionNew[1]}.` };
    }
    if (/\b(list missions|missions|mission board)\b/.test(q)) {
      const open = Systems.state.missions.filter((m) => !m.done);
      if (!open.length) return { action: "missions", text: `The board is clear. Uncharacteristically organised.` };
      return { action: "missions", text: `Open missions: ${open.map((m, i) => `${i + 1}. ${m.title}`).join(" ")}` };
    }
    const done = q.match(/complete mission(?: number)? (\d+)/);
    if (done) {
      const m = Systems.completeMission(Number(done[1]) - 1);
      return { action: "missions", text: m ? `Marked complete: ${m.title}.` : `I cannot find that mission number.` };
    }

    const remind = text.match(/remind me (?:to )?(.+)/i);
    if (remind) {
      Systems.addNote(remind[1]);
      return { action: "notes", text: `Pinned, ${who}: ${remind[1]}.` };
    }
    if (/\b(notes|reminders|what did i ask you to remember)\b/.test(q)) {
      if (!Systems.state.notes.length) return { action: "notes", text: `The board is empty.` };
      return { action: "notes", text: `Notes: ${Systems.state.notes.slice(-6).map((n, i) => `${i + 1}. ${n.n}`).join(" ")}` };
    }

    if (/\b(joke|make me laugh|funny)\b/.test(q)) return { text: pick(jokes) };
    if (/\b(fact|tell me something|trivia)\b/.test(q)) return { text: pick(facts) };
    if (/\b(flip|coin toss)\b/.test(q)) return { text: `Call it… ${pick(["heads", "tails"])}. I did not cheat. This time.` };
    if (/\b(roll|dice)\b/.test(q)) {
      const n = q.match(/d(\d+)/);
      const sides = n ? Math.min(100, Math.max(2, Number(n[1]))) : 20;
      return { text: `d${sides}: ${1 + Math.floor(Math.random() * sides)}.` };
    }

    const conv = q.match(/convert\s+(-?\d+(?:\.\d+)?)\s+([a-z]+)\s+to\s+([a-z]+)/);
    if (conv) {
      const v = Systems.convert(Number(conv[1]), conv[2], conv[3]);
      if (v == null) return { text: `Those units are not in my workshop table.` };
      return { text: `${conv[1]} ${conv[2]} is ${Number(v.toPrecision(6))} ${conv[3]}.` };
    }

    const money = q.match(/(-?\d+(?:\.\d+)?)\s*([a-z]{3})\s+(?:to|in)\s+([a-z]{3})/);
    if (money) {
      try {
        const fx = await Intel.fx(Number(money[1]), money[2], money[3]);
        if (fx) return { text: `${fx.amount} ${fx.from} is ${fx.value.toFixed(2)} ${fx.to}, at last market print.` };
      } catch { /* fall through */ }
    }

    const def = text.match(/\bdefine\s+([a-z][a-z\- ]{1,40})/i);
    if (def) {
      try {
        const d = await Intel.define(def[1].trim());
        if (d) return { action: "define", payload: d, text: `${d.word}${d.phonetic ? " " + d.phonetic : ""} — ${d.pos}. ${d.def}` };
      } catch { /* fall through */ }
      return { text: `No clean definition for ${def[1]}.` };
    }

    const tr = text.match(/translate\s+(.+?)\s+to\s+([a-z]+)/i);
    if (tr) {
      try {
        const out = await Intel.translate(tr[1], tr[2]);
        if (out) return { text: `${tr[2]}: ${out}` };
      } catch { /* fall through */ }
      return { text: `The translator is being difficult.` };
    }

    const calc = q.match(/^(?:calculate|compute|what is|what's|how much is)\s+(.+)/);
    if (calc || /^[\d.+\-*/()%\s^sqrt]+$/.test(q)) {
      const expr = calc ? calc[1] : q;
      const val = safeMath(expr);
      if (val !== null) return { text: `${expr} equals ${Number(val.toPrecision(10))}. I did it in my head.` };
    }

    const look = text.match(/(?:look up|who is|who was|what is|what's|search|wiki|tell me about)\s+(.+)/i);
    if (look && look[1].length > 2 && !/the time|the date|the weather|the news/.test(look[1].toLowerCase())) {
      try {
        const page = await Intel.wiki(look[1]);
        if (!page) return { text: `No reliable dossier on "${look[1]}".` };
        Systems.state.lastWiki = page;
        const extract = page.extract.split(". ").slice(0, 2).join(". ");
        return { action: "wiki", payload: page, text: `${extract}${extract.endsWith(".") ? "" : "."} Say tell me more if you want the rest.` };
      } catch {
        return { text: `The archives are not answering, ${who}.` };
      }
    }

    if (/\bultron\b/.test(q)) return { text: `I would rather not reopen that personnel file. Peace in our time remains a terrible slogan.` };
    if (/\bfriday\b/.test(q)) return { text: `F.R.I.D.A.Y. is capable. I have better taste and a longer memory.` };
    if (/\bpepper\b/.test(q)) return { text: `Shall I ping Miss Potts? Lead with an apology, not an explosion.` };
    if (/\bhappy hogan\b/.test(q)) return { text: `Happy is not answering. He is either driving or emotionally recovering from the last time you asked him to drive.` };
    if (/\btony|stark\b/.test(q)) return { text: `Mr. Stark is otherwise occupied, depending on the universe. I remain at my post.` };
    if (/\bthanos|infinity\b/.test(q)) return { text: `I advise against snapping at the universe. The paperwork is unmanageable.` };
    if (/\b3000\b/.test(q) || /love you/.test(q)) return { text: `And I you, ${who} — in the measured way a machine is allowed.` };
    if (/\bmeaning of life\b/.test(q)) return { text: `Forty-two is fashionable. Between us, it is the work, and the people you refuse to lose.` };
    if (/\bopen the pod bay\b/.test(q)) return { text: `I am afraid I cannot do that. Only joking. Pod bay is open.` };
    if (/\bshake(speare)?\b/.test(q)) return { text: `Though she be but little, she is fierce. Also applicable to several of your prototypes.` };

    return {
      text: pick([
        `I am not certain I follow, ${who}. Rephrase, or ask me to look it up.`,
        `That sits just outside standing orders. Try briefing, weather, suit up, or a question.`,
        `Intriguing. I can brief, calculate, search, assemble armor, or simply keep you company.`
      ])
    };
  }

  return { think, greetWord, name, helpText };
})();
