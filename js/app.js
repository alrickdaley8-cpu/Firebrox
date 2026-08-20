(() => {
  const $ = (id) => document.getElementById(id);
  const bootLogs = [
    [40, "kernel", "STARK OS 11.4.2 — Malibu core"],
    [220, "ok", "Authenticating biometric ghost… match"],
    [480, "kernel", "Mounting neural lattice 4096-wide"],
    [760, "warn", "Humor module: slightly overclocked"],
    [1040, "kernel", "Arc reactor handshake… 96% nominal"],
    [1320, "kernel", "Uplink SAT-07 encrypted"],
    [1600, "ok", "J.A.R.V.I.S. personality matrix loaded"],
    [1900, "ok", "All systems online. Welcome back."]
  ];

  let booting = true;
  let listening = false;
  let power = 100;

  function tickClock() {
    const now = new Date();
    $("clock").textContent = now.toLocaleTimeString(undefined, { hour12: false });
    $("date-line").textContent = now.toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric", year: "numeric"
    }).toUpperCase();
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

  function typeSpoken(text) {
    const node = $("spoken");
    node.textContent = "";
    let i = 0;
    const step = () => {
      i += 1;
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
  }

  function setSpeaking(on) {
    $("reactor").classList.toggle("speaking", on);
    if (on) setCaption("SPEAKING");
    else if (!listening) setCaption("AWAITING DIRECTIVE");
  }

  async function handle(text, { silentUser = false } = {}) {
    const said = text.trim();
    if (!said) return;
    FX.beep();
    if (!silentUser) addMsg("user", said);
    $("cmd").value = "";
    setCaption("PROCESSING");
    let reply;
    try {
      reply = await Brain.think(said);
    } catch {
      reply = { text: "A transient fault, sir. Ask me again." };
    }
    await applyAction(reply.action);
    addMsg("jarvis", reply.text);
    typeSpoken(reply.text);
    if (!FX.isMuted()) {
      setSpeaking(true);
      Voice.speak(reply.text, { onend: () => setSpeaking(false) });
    }
  }

  async function applyAction(action) {
    if (!action) return;
    if (action === "suitup") await suitUp();
    if (action === "lockdown") lockdown(true);
    if (action === "unlock") lockdown(false);
    if (action === "scan") await scan();
    if (action === "diagnostics") {
      $("mode-chip").textContent = "DIAGNOSTIC";
      setTimeout(() => { $("mode-chip").textContent = "CIVILIAN"; }, 4000);
    }
    if (action === "status") $("sat-chip").textContent = "SAT-07";
    if (action === "theme-gold") document.body.classList.add("theme-gold");
    if (action === "theme-cyan") document.body.classList.remove("theme-gold");
    if (action === "music-on") FX.startPad();
    if (action === "music-off") FX.stopPad();
    if (action === "mute") { Voice.hush(); FX.setMuted(true); }
    if (action === "unmute") FX.setMuted(false);
    if (action === "clear") $("feed").innerHTML = "";
    if (action === "standby") standby();
  }

  function suitUp() {
    return new Promise((resolve) => {
      const ov = $("suitup");
      const fill = $("suit-fill");
      const line = $("suit-line");
      const lines = [
        "Assembling nanotech lattice…",
        "Repulsors primed…",
        "HUD visor calibrated…",
        "Mark LXXXV ready."
      ];
      ov.hidden = false;
      $("mode-chip").textContent = "COMBAT";
      FX.confirm();
      let p = 0;
      const id = setInterval(() => {
        p += 4;
        fill.style.width = p + "%";
        line.textContent = lines[Math.min(lines.length - 1, Math.floor(p / 25))];
        if (p >= 100) {
          clearInterval(id);
          setTimeout(() => { ov.hidden = true; resolve(); }, 700);
        }
      }, 40);
    });
  }

  function lockdown(on) {
    $("lockdown").hidden = !on;
    document.body.classList.toggle("lock", on);
    $("mode-chip").textContent = on ? "LOCKDOWN" : "CIVILIAN";
    if (on) FX.warn(); else FX.confirm();
  }

  function scan() {
    return new Promise((resolve) => {
      $("scanfx").hidden = false;
      $("radar-note").textContent = "Sweep in progress…";
      FX.tick();
      setTimeout(() => {
        $("scanfx").hidden = true;
        $("radar-note").textContent = "Perimeter clear";
        resolve();
      }, 2200);
    });
  }

  function standby() {
    Voice.hush();
    FX.stopPad();
    $("app").hidden = true;
    $("boot").hidden = false;
    $("boot-log").innerHTML = "";
    $("boot-fill").style.width = "0%";
    $("boot-pct").textContent = "STANDBY";
    const li = document.createElement("li");
    li.className = "ok";
    li.textContent = "> Systems parked. Click skip to wake.";
    $("boot-log").appendChild(li);
    booting = false;
  }

  function startListen() {
    FX.unlock();
    Voice.hush();
    setListening(true);
    const ok = Voice.listen({
      onPartial(t) { $("spoken").textContent = t; },
      onFinal(t) {
        setListening(false);
        handle(t);
      },
      onEnd() { setListening(false); },
      onError(err) {
        setListening(false);
        const msg = err === "not-allowed"
          ? "Microphone permission denied. Type your directive instead, sir."
          : "Voice capture failed. The keyboard remains loyal.";
        addMsg("jarvis", msg);
        typeSpoken(msg);
      }
    });
    if (!ok) setListening(false);
  }

  function runBoot() {
    $("boot").hidden = false;
    $("app").hidden = true;
    $("boot-log").innerHTML = "";
    $("boot-fill").style.width = "0%";
    let pct = 0;
    const bar = setInterval(() => {
      pct = Math.min(100, pct + 1.6);
      $("boot-fill").style.width = pct + "%";
      $("boot-pct").textContent = String(Math.floor(pct)).padStart(2, "0") + "%";
      if (pct >= 100) clearInterval(bar);
    }, 40);
    bootLogs.forEach(([delay, kind, line]) => {
      setTimeout(() => {
        const li = document.createElement("li");
        li.className = kind === "ok" ? "ok" : kind === "warn" ? "warn" : "";
        li.textContent = "> " + line;
        $("boot-log").appendChild(li);
        FX.tick();
      }, delay);
    });
    setTimeout(finishBoot, 2800);
  }

  function finishBoot() {
    if ($("app").hidden === false) return;
    FX.online();
    $("boot").hidden = true;
    $("app").hidden = false;
    HUD.init();
    tickClock();
    const hello = `${Brain.greetWord()}, ${Brain.name()}. J.A.R.V.I.S. online. How may I assist you?`;
    addMsg("jarvis", hello);
    typeSpoken(hello);
    if (!FX.isMuted()) {
      setSpeaking(true);
      Voice.speak(hello, { onend: () => setSpeaking(false) });
    }
  }

  function drain() {
    power = Math.max(72, power - Math.random() * 0.04);
    $("pwr").textContent = Math.round(power) + "%";
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
      handle($("cmd").value);
    });
    $("mic-btn").addEventListener("click", () => {
      if (listening) { Voice.stopListen(); setListening(false); }
      else startListen();
    });
    $("reactor").addEventListener("click", () => {
      if (listening) { Voice.stopListen(); setListening(false); }
      else startListen();
    });
    $("quick").addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn) handle(btn.dataset.cmd);
    });
    $("unlock-btn").addEventListener("click", () => handle("unlock"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        Voice.hush();
        Voice.stopListen();
        setListening(false);
        setSpeaking(false);
      }
      if (e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        $("cmd").focus();
      }
    });
  }

  function init() {
    Voice.init();
    bind();
    tickClock();
    setInterval(tickClock, 1000);
    setInterval(drain, 4000);
    runBoot();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
