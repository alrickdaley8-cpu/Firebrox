(() => {
  const $ = (id) => document.getElementById(id);
  const bootA = [
    [50, "kernel", "STARK OS 12.0.7 — Titanium"],
    [280, "ok", "Biometric ghost: match"],
    [540, "kernel", "Neural lattice 8192 mounted"],
    [820, "warn", "Humor module: overclocked"],
    [1100, "kernel", "Arc reactor handshake 96%"],
    [1400, "ok", "Personality matrix online"]
  ];
  const bootB = [
    [120, "kernel", "SAT-07 mesh encrypted"],
    [400, "kernel", "Armor bay: 6 marks idle"],
    [700, "ok", "Weather stack linked"],
    [980, "kernel", "Intel wire: wikipedia/fx"],
    [1280, "warn", "Flight systems homesick"],
    [1600, "ok", "All primary systems green"]
  ];

  let listening = false;
  let power = 100;
  let hist = [];
  let histI = -1;
  let suggestI = -1;
  let voiceOn = true;
  let always = false;
  let flightTimer = null;
  let bootBar = null;

  function tickClock() {
    const now = new Date();
    $("clock").textContent = now.toLocaleTimeString(undefined, { hour12: false });
    $("date-line").textContent = now.toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric", year: "numeric"
    }).toUpperCase();
    $("utc-line").textContent = "UTC " + now.toISOString().slice(11, 19);
    $("uptime").textContent = "UP " + Systems.uptime();
    const wc = $("world-clocks");
    if (wc) {
      const zones = [
        ["MALIBU", "America/Los_Angeles"],
        ["NEW YORK", "America/New_York"],
        ["LONDON", "Europe/London"],
        ["TOKYO", "Asia/Tokyo"]
      ];
      wc.innerHTML = zones.map(([n, z]) => {
        const t = now.toLocaleTimeString("en-GB", { timeZone: z, hour: "2-digit", minute: "2-digit" });
        return `<div><span>${n}</span><b>${t}</b></div>`;
      }).join("");
    }
  }

  function setCaption(s) { $("reactor-caption").textContent = s; }

  function addMsg(role, text) {
    const el = document.createElement("div");
    el.className = "msg " + role;
    el.innerHTML = `<div class="who">${role === "user" ? "YOU" : "J.A.R.V.I.S."}</div><p></p>`;
    el.querySelector("p").textContent = text;
    $("feed").appendChild(el);
    $("feed").scrollTop = $("feed").scrollHeight;
  }

  function addCard(parent, kicker, title, body) {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<div class="who">${kicker}</div><h3></h3><p></p>`;
    el.querySelector("h3").textContent = title;
    el.querySelector("p").textContent = body || "";
    parent.prepend(el);
  }

  function typeSpoken(text) {
    const node = $("spoken");
    node.textContent = "";
    let i = 0;
    const step = () => {
      i += 2;
      node.textContent = text.slice(0, i);
      if (i < text.length) requestAnimationFrame(step);
    };
    step();
  }

  function setListening(on) {
    listening = on;
    $("reactor").classList.toggle("listening", on);
    $("mic-btn").classList.toggle("hot", on);
    setCaption(on ? "LISTENING" : "AWAITING DIRECTIVE");
    HUD.setEnergy(on ? 0.8 : 0.22);
  }

  function setSpeaking(on) {
    $("reactor").classList.toggle("speaking", on);
    if (on) { setCaption("SPEAKING"); HUD.setEnergy(0.7); }
    else if (!listening) { setCaption("AWAITING DIRECTIVE"); HUD.setEnergy(0.22); }
  }

  function showPane(group, name) {
    group.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.pane === name));
    const root = group.parentElement;
    root.querySelectorAll(".pane").forEach((p) => p.classList.toggle("on", p.id === "pane-" + name));
  }

  function renderArmor() {
    const box = $("armor-grid");
    box.innerHTML = Systems.ARMOR.map((a) => `
      <button type="button" class="armor-card ${a.id === Systems.state.armor ? "on" : ""}" data-armor="${a.id}">
        <img src="assets/armor.png" alt="" />
        <span><strong>${a.name}</strong><em>${a.note}</em></span>
        <span class="st">${a.id === Systems.state.armor ? "READY" : "STOW"}</span>
      </button>`).join("");
    $("armor-chip").textContent = Systems.armor().name.toUpperCase();
  }

  function renderMissions() {
    const box = $("missions-body");
    if (!Systems.state.missions.length) {
      box.innerHTML = `<p class="hint">No missions filed.</p>`;
      return;
    }
    box.innerHTML = Systems.state.missions.map((m, i) => `
      <div class="row-item ${m.done ? "done" : ""}">
        <span>${i + 1}. ${m.title}</span>
        ${m.done ? "<em>DONE</em>" : `<button type="button" data-done="${i}">CLOSE</button>`}
      </div>`).join("");
  }

  function renderNotes() {
    const box = $("notes-body");
    if (!Systems.state.notes.length) {
      box.innerHTML = `<p class="hint">Nothing pinned.</p>`;
      return;
    }
    box.innerHTML = Systems.state.notes.slice().reverse().map((n) => `
      <div class="row-item"><span>${n.n}</span></div>`).join("");
  }

  function applyTheme(name) {
    document.body.classList.remove("theme-gold", "theme-crimson", "theme-stealth");
    if (name !== "cyan") document.body.classList.add("theme-" + name);
    Systems.state.theme = name;
    Systems.persist();
    HUD.setTheme(name);
  }

  function toast(title, body) {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<span></span><b></b>`;
    el.querySelector("span").textContent = title;
    el.querySelector("b").textContent = body;
    $("toasts").appendChild(el);
    return el;
  }

  function startTimer(sec) {
    const el = toast("TIMER", formatSec(sec));
    const ends = Date.now() + sec * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
      el.querySelector("b").textContent = formatSec(left);
      if (left <= 0) {
        clearInterval(id);
        el.querySelector("span").textContent = "TIMER COMPLETE";
        FX.alarm();
        const line = "Timer complete, sir.";
        addMsg("jarvis", line);
        typeSpoken(line);
        if (voiceOn && !FX.isMuted()) Voice.speak(line);
        setTimeout(() => { FX.stopAlarm(); el.remove(); }, 6000);
      }
    }, 250);
  }

  function formatSec(s) {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  }

  function startStopwatch() {
    $("toasts").querySelectorAll("[data-sw]").forEach((n) => n.remove());
    const el = toast("STOPWATCH", "00:00");
    el.dataset.sw = "1";
    const t0 = Date.now();
    el._id = setInterval(() => {
      el.querySelector("b").textContent = formatSec(Math.floor((Date.now() - t0) / 1000));
    }, 250);
    Systems.state.stopwatch = el;
  }

  function stopStopwatch() {
    const el = Systems.state.stopwatch;
    if (!el) return;
    clearInterval(el._id);
    el.remove();
    Systems.state.stopwatch = null;
  }

  async function handle(text) {
    const said = text.trim();
    if (!said) return;
    FX.beep();
    hist.unshift(said);
    histI = -1;
    addMsg("user", said);
    $("cmd").value = "";
    hideSuggest();
    setCaption("PROCESSING");
    let reply;
    try { reply = await Brain.think(said); }
    catch { reply = { text: "A transient fault, sir. Ask me again." }; }
    await applyAction(reply);
    addMsg("jarvis", reply.text);
    typeSpoken(reply.text);
    if (voiceOn && !FX.isMuted()) {
      setSpeaking(true);
      Voice.speak(reply.text, { onend: () => setSpeaking(false) });
    }
  }

  async function applyAction(reply) {
    const a = reply.action;
    const p = reply.payload || {};
    if (!a) return;
    if (a === "suitup") await suitUp(p.armor || Systems.armor());
    if (a === "party") await houseParty();
    if (a === "lockdown") lockdown(true);
    if (a === "unlock") lockdown(false);
    if (a === "scan") await scan(false);
    if (a === "threat") await scan(true);
    if (a === "diagnostics") {
      $("mode-chip").textContent = "DIAGNOSTIC";
      setTimeout(() => { if ($("mode-chip").textContent === "DIAGNOSTIC") $("mode-chip").textContent = "CIVILIAN"; }, 4000);
    }
    if (a === "theme") applyTheme(p.theme);
    if (a === "music-on") { FX.stopPad(); FX.startPad(p.mode || "workshop"); }
    if (a === "music-off") FX.stopPad();
    if (a === "mute") { Voice.hush(); voiceOn = false; $("set-voice").checked = false; }
    if (a === "unmute") { voiceOn = true; $("set-voice").checked = true; }
    if (a === "clear") $("feed").innerHTML = "";
    if (a === "standby") standby();
    if (a === "wipe") {
      Systems.wipe();
      renderMissions();
      renderNotes();
      $("prompt").textContent = "SIR >";
    }
    if (a === "rename") $("prompt").textContent = Systems.state.name.toUpperCase() + " >";
    if (a === "timer") startTimer(p.seconds);
    if (a === "stopwatch-on") startStopwatch();
    if (a === "stopwatch-off") stopStopwatch();
    if (a === "missions") { renderMissions(); showPane($("right-tabs"), "missions"); }
    if (a === "notes") { renderNotes(); showPane($("right-tabs"), "notes"); }
    if (a === "news") {
      showPane($("right-tabs"), "intel");
      (p || []).forEach((item) => addCard($("intel-body"), item.kicker, item.title, item.text));
      if (p[0]) updateTicker(p.map((i) => i.title).join("  ·  "));
    }
    if (a === "wiki" && p) {
      showPane($("right-tabs"), "intel");
      addCard($("intel-body"), "ARCHIVE", p.title, p.extract);
    }
    if (a === "define" && p) {
      showPane($("right-tabs"), "intel");
      addCard($("intel-body"), "LEXICON", p.word, p.def);
    }
    if (a === "weather" && p) paintWeather(p);
    if (a === "flight-on") flight(true);
    if (a === "flight-off") flight(false);
    if (a === "calm-on") document.body.classList.add("calm");
    if (a === "calm-off") document.body.classList.remove("calm");
    if (a === "help") {
      $("help-body").innerHTML = Systems.PROTOCOLS.map((x) =>
        `<div><b>${x.cmd}</b>${x.hint}</div>`).join("");
      $("help-modal").hidden = false;
    }
    if (a === "briefing") {
      renderMissions();
      renderNotes();
    }
  }

  function paintWeather(w) {
    $("wx-loc").textContent = w.label;
    $("wx-temp").textContent = Math.round(w.temp) + "°";
    $("wx-desc").textContent = w.desc;
    showPane($("left-tabs"), "world");
  }

  function updateTicker(text) {
    $("ticker").textContent = "J.A.R.V.I.S. 12  ·  " + text;
  }

  function suitUp(armor) {
    return new Promise((resolve) => {
      const ov = $("suitup");
      const fill = $("suit-fill");
      const line = $("suit-line");
      const subs = ["Repulsors", "Nanites", "HUD visor", "Unibeam", "Thrusters", "Seal"];
      $("suit-mark").textContent = armor.name.toUpperCase();
      $("suit-subs").innerHTML = subs.map((s) => `<li>${s}</li>`).join("");
      ov.hidden = false;
      $("mode-chip").textContent = "COMBAT";
      $("armor-chip").textContent = armor.name.toUpperCase();
      Systems.state.armor = armor.id;
      Systems.persist();
      renderArmor();
      FX.assemble();
      let p = 0;
      const id = setInterval(() => {
        p += 3;
        fill.style.width = p + "%";
        const idx = Math.min(subs.length - 1, Math.floor(p / 16));
        line.textContent = "Online: " + subs[idx];
        [...$("suit-subs").children].forEach((li, i) => li.classList.toggle("on", i <= idx));
        if (p >= 100) {
          clearInterval(id);
          line.textContent = armor.name + " ready.";
          setTimeout(() => { ov.hidden = true; resolve(); }, 700);
        }
      }, 36);
    });
  }

  function houseParty() {
    return new Promise((resolve) => {
      const ov = $("party");
      const grid = $("party-grid");
      grid.innerHTML = Systems.ARMOR.map((a) => `<span>${a.name}</span>`).join("");
      ov.hidden = false;
      $("mode-chip").textContent = "OMEGA";
      FX.assemble();
      let i = 0;
      const id = setInterval(() => {
        if (i < grid.children.length) {
          grid.children[i].classList.add("on");
          $("party-line").textContent = Systems.ARMOR[i].name + " spinning up…";
          FX.tick();
          i += 1;
        } else {
          clearInterval(id);
          $("party-line").textContent = "All remaining marks are live.";
          setTimeout(() => { ov.hidden = true; resolve(); }, 900);
        }
      }, 380);
    });
  }

  function lockdown(on) {
    $("lockdown").hidden = !on;
    document.body.classList.toggle("lock", on);
    $("mode-chip").textContent = on ? "LOCKDOWN" : "CIVILIAN";
    $("threat-chip").classList.toggle("hot", on);
    $("threat-chip").textContent = on ? "THREAT HOLD" : "THREAT LOW";
    if (on) FX.warn(); else FX.confirm();
  }

  function scan(hostile) {
    return new Promise((resolve) => {
      $("scanfx").hidden = false;
      $("radar-note").textContent = hostile ? "Multiple returns…" : "Sweep in progress…";
      $("threat-chip").classList.toggle("hot", hostile);
      $("threat-chip").textContent = hostile ? "THREAT AMBER" : "THREAT LOW";
      HUD.setAlert(hostile);
      FX.scan();
      showPane($("left-tabs"), "vitals");
      setTimeout(() => {
        $("scanfx").hidden = true;
        $("radar-note").textContent = hostile ? "Amber — tracking 3" : "Perimeter clear";
        if (!hostile) HUD.setAlert(false);
        resolve();
      }, 2400);
    });
  }

  function flight(on) {
    $("flight").hidden = !on;
    $("mode-chip").textContent = on ? "FLIGHT" : "CIVILIAN";
    if (flightTimer) { clearInterval(flightTimer); flightTimer = null; }
    if (!on) return;
    let alt = 120, spd = 80, hdg = 184, pitch = 0;
    flightTimer = setInterval(() => {
      alt += 6 + Math.random() * 10;
      spd = 180 + Math.sin(Date.now() / 700) * 40;
      hdg = (hdg + 0.4) % 360;
      pitch = Math.sin(Date.now() / 900) * 8;
      $("flt-alt").textContent = String(Math.round(alt)).padStart(5, "0");
      $("flt-spd").textContent = String(Math.round(spd)).padStart(3, "0");
      $("flt-hdg").textContent = String(Math.round(hdg)).padStart(3, "0");
      $("flt-g").textContent = (1 + Math.abs(pitch) / 40).toFixed(2);
      $("horizon").style.transform = `rotate(${pitch}deg) translateY(${pitch * 3}px)`;
    }, 80);
  }

  function standby() {
    Voice.hush();
    FX.stopPad();
    flight(false);
    $("app").hidden = true;
    $("boot").hidden = false;
    $("boot-log").innerHTML = "";
    $("boot-log-2").innerHTML = "";
    $("boot-fill").style.width = "0%";
    $("boot-pct").textContent = "STANDBY";
    const li = document.createElement("li");
    li.className = "ok";
    li.textContent = "> Systems parked. Click skip to wake.";
    $("boot-log").appendChild(li);
  }

  function startListen(fromAlways) {
    FX.unlock();
    if (!fromAlways) Voice.hush();
    setListening(true);
    const ok = Voice.listen({
      onPartial(t) { $("spoken").textContent = t; },
      onFinal(t) {
        if (!always) setListening(false);
        const wake = /^jarvis[\s,]+/i;
        if (always && !wake.test(t) && !/^jarvis$/i.test(t)) return;
        handle(t.replace(wake, ""));
      },
      onEnd() { if (!always) setListening(false); },
      onError(err) {
        if (always && err === "no-speech") return;
        setListening(false);
        if (err === "aborted") return;
        const msg = err === "not-allowed"
          ? "Microphone permission denied. Type instead, sir."
          : "Voice capture failed. The keyboard remains loyal.";
        addMsg("jarvis", msg);
        typeSpoken(msg);
      }
    });
    if (!ok) setListening(false);
  }

  function pushLog(el, delay, kind, line) {
    setTimeout(() => {
      const li = document.createElement("li");
      li.className = kind === "ok" ? "ok" : kind === "warn" ? "warn" : "";
      li.textContent = "> " + line;
      el.appendChild(li);
      FX.tick();
    }, delay);
  }

  function runBoot() {
    $("boot").hidden = false;
    $("app").hidden = true;
    $("boot-log").innerHTML = "";
    $("boot-log-2").innerHTML = "";
    $("boot-fill").style.width = "0%";
    let pct = 0;
    bootBar = setInterval(() => {
      pct = Math.min(100, pct + 1.15);
      $("boot-fill").style.width = pct + "%";
      $("boot-pct").textContent = String(Math.floor(pct)).padStart(2, "0") + "%";
      if (pct >= 100) clearInterval(bootBar);
    }, 40);
    bootA.forEach((row) => pushLog($("boot-log"), ...row));
    bootB.forEach((row) => pushLog($("boot-log-2"), ...row));
    setTimeout(finishBoot, 3200);
  }

  function finishBoot() {
    if ($("app").hidden === false) return;
    if (bootBar) clearInterval(bootBar);
    FX.online();
    $("boot").hidden = true;
    $("app").hidden = false;
    HUD.init();
    applyTheme(Systems.state.theme);
    renderArmor();
    renderMissions();
    renderNotes();
    $("prompt").textContent = Systems.state.name.toUpperCase() + " >";
    tickClock();
    const hello = `${Brain.greetWord()}, ${Brain.name()}. J.A.R.V.I.S. twelve, Titanium Core, online.`;
    addMsg("jarvis", hello);
    typeSpoken(hello);
    if (voiceOn && !FX.isMuted()) {
      setSpeaking(true);
      Voice.speak(hello, { onend: () => setSpeaking(false) });
    }
    primeIntel();
  }

  async function primeIntel() {
    try {
      const w = await Intel.weather();
      paintWeather(w);
      updateTicker(`${w.label} ${Math.round(w.temp)}° ${w.desc}  ·  mesh secure  ·  ${Systems.armor().name} standby`);
    } catch {
      updateTicker("mesh secure  ·  weather sensors optional  ·  titanium core");
    }
    try {
      const items = await Intel.news();
      items.slice(0, 4).forEach((item) => addCard($("intel-body"), item.kicker, item.title, item.text));
      if (items[0]) updateTicker(items.map((i) => i.title).join("  ·  "));
    } catch { /* offline intel is fine */ }
  }

  function hideSuggest() {
    $("suggest").hidden = true;
    suggestI = -1;
  }

  function showSuggest() {
    const q = $("cmd").value.toLowerCase().trim();
    const box = $("suggest");
    if (!q) { hideSuggest(); return; }
    const hits = Systems.PROTOCOLS.filter((p) => p.cmd.includes(q) || p.hint.toLowerCase().includes(q)).slice(0, 7);
    if (!hits.length) { hideSuggest(); return; }
    box.hidden = false;
    box.innerHTML = hits.map((h, i) => `<li data-cmd="${h.cmd}" class="${i === 0 ? "on" : ""}">${h.cmd} — ${h.hint}</li>`).join("");
    suggestI = 0;
  }

  function bind() {
    $("boot-skip").addEventListener("click", () => {
      FX.unlock();
      FX.boot();
      finishBoot();
    });
    $("cmd-form").addEventListener("submit", (e) => {
      e.preventDefault();
      FX.unlock();
      const pick = $("suggest").querySelector("li.on");
      if (!$("suggest").hidden && pick) {
        handle(pick.dataset.cmd);
        return;
      }
      handle($("cmd").value);
    });
    $("cmd").addEventListener("input", showSuggest);
    $("suggest").addEventListener("mousedown", (e) => {
      const li = e.target.closest("li");
      if (li) handle(li.dataset.cmd);
    });
    $("mic-btn").addEventListener("click", () => {
      if (listening && !always) { Voice.stopListen(); setListening(false); }
      else startListen(false);
    });
    $("reactor").addEventListener("click", () => {
      if (listening && !always) { Voice.stopListen(); setListening(false); }
      else startListen(false);
    });
    $("quick").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn) handle(btn.dataset.cmd);
    });
    $("unlock-btn").addEventListener("click", () => handle("unlock"));
    $("left-tabs").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) { FX.click(); showPane($("left-tabs"), b.dataset.pane); }
    });
    $("right-tabs").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) { FX.click(); showPane($("right-tabs"), b.dataset.pane); }
    });
    $("armor-grid").addEventListener("click", (e) => {
      const card = e.target.closest("[data-armor]");
      if (card) handle("deploy " + Systems.ARMOR.find((a) => a.id === card.dataset.armor).name);
    });
    $("missions-body").addEventListener("click", (e) => {
      const b = e.target.closest("[data-done]");
      if (!b) return;
      Systems.completeMission(Number(b.dataset.done));
      renderMissions();
    });
    $("mission-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("mission-in").value.trim();
      if (!v) return;
      $("mission-in").value = "";
      handle("new mission " + v);
    });
    $("note-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = $("note-in").value.trim();
      if (!v) return;
      $("note-in").value = "";
      handle("remind me " + v);
    });
    $("settings-btn").addEventListener("click", () => { $("settings").hidden = !$("settings").hidden; });
    $("settings-close").addEventListener("click", () => { $("settings").hidden = true; });
    $("help-close").addEventListener("click", () => { $("help-modal").hidden = true; });
    $("help-modal").addEventListener("click", (e) => {
      if (e.target.id === "help-modal") $("help-modal").hidden = true;
    });
    $("set-voice").addEventListener("change", (e) => { voiceOn = e.target.checked; });
    $("set-fx").addEventListener("change", (e) => FX.setTones(e.target.checked));
    $("set-calm").addEventListener("change", (e) => document.body.classList.toggle("calm", e.target.checked));
    $("set-rate").addEventListener("input", (e) => Voice.setRate(e.target.value));
    $("set-gain").addEventListener("input", (e) => FX.setGain(e.target.value));
    $("set-listen").addEventListener("change", (e) => {
      always = e.target.checked;
      Voice.setLoop(always);
      if (always) startListen(true);
      else { Voice.stopListen(); setListening(false); }
    });
    document.querySelector(".theme-row").addEventListener("click", (e) => {
      const b = e.target.closest("[data-theme]");
      if (b) applyTheme(b.dataset.theme);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        Voice.hush();
        if (!always) { Voice.stopListen(); setListening(false); }
        setSpeaking(false);
        $("help-modal").hidden = true;
        $("settings").hidden = true;
        hideSuggest();
      }
      if (e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        $("cmd").focus();
      }
      if (e.key === "?" && document.activeElement !== $("cmd") && document.activeElement.tagName !== "INPUT") {
        handle("help");
      }
      if (document.activeElement === $("cmd") && !$("suggest").hidden) {
        const items = [...$("suggest").children];
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          suggestI = e.key === "ArrowDown"
            ? Math.min(items.length - 1, suggestI + 1)
            : Math.max(0, suggestI - 1);
          items.forEach((li, i) => li.classList.toggle("on", i === suggestI));
          return;
        }
      }
      if (document.activeElement === $("cmd") && (e.key === "ArrowUp" || e.key === "ArrowDown") && $("suggest").hidden) {
        if (!hist.length) return;
        e.preventDefault();
        if (e.key === "ArrowUp") histI = Math.min(hist.length - 1, histI + 1);
        else histI = Math.max(-1, histI - 1);
        $("cmd").value = histI < 0 ? "" : hist[histI];
      }
    });
  }

  function drain() {
    power = Math.max(74, power - Math.random() * 0.05);
    $("pwr").textContent = Math.round(power) + "%";
  }

  function init() {
    Voice.init();
    FX.setTones(true);
    bind();
    tickClock();
    setInterval(tickClock, 1000);
    setInterval(drain, 4000);
    runBoot();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
