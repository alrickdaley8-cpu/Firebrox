const Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let speaking = false;
  let preferred = null;
  let rate = 1.02;
  let loop = false;
  let handlers = null;

  function pickVoice() {
    const voices = speechSynthesis.getVoices();
    const rank = (v) => {
      const n = `${v.name} ${v.lang}`.toLowerCase();
      let s = 0;
      if (/en-gb|en_gb|uk/.test(n)) s += 6;
      if (/daniel|google uk english male|arthur|rishi|oliver|uk english male/.test(n)) s += 5;
      if (/male/.test(n)) s += 2;
      if (/en-us|en_us/.test(n)) s += 2;
      if (v.localService) s += 1;
      return s;
    };
    preferred = voices.slice().sort((a, b) => rank(b) - rank(a))[0] || null;
  }

  function armRec() {
    if (!SR) return;
    rec = new SR();
    rec.lang = "en-GB";
    rec.interimResults = true;
    rec.continuous = loop;
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) handlers && handlers.onFinal && handlers.onFinal(text.trim());
        else handlers && handlers.onPartial && handlers.onPartial(text.trim());
      }
    };
    rec.onerror = (e) => handlers && handlers.onError && handlers.onError(e.error);
    rec.onend = () => {
      if (loop) {
        try { rec.start(); } catch (_) { /* restart race */ }
      }
      handlers && handlers.onEnd && handlers.onEnd();
    };
  }

  return {
    ready: !!SR,
    speaking() { return speaking; },
    init() {
      pickVoice();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.onvoiceschanged = pickVoice;
      armRec();
    },
    setRate(v) { rate = Number(v) || 1.02; },
    setLoop(on) {
      loop = !!on;
      armRec();
    },
    listen(h) {
      handlers = h;
      if (!rec) {
        h.onError && h.onError("Voice capture is unavailable in this browser. Type a directive instead.");
        return false;
      }
      try {
        rec.continuous = loop;
        rec.start();
        return true;
      } catch (err) {
        h.onError && h.onError(err.message);
        return false;
      }
    },
    stopListen() {
      loop = false;
      try { rec && rec.abort(); } catch (_) { /* ignore */ }
    },
    speak(text, { onstart, onend } = {}) {
      if (!window.speechSynthesis) {
        onend && onend();
        return;
      }
      speechSynthesis.cancel();
      const clean = String(text).replace(/[•—]/g, ", ").replace(/\s+/g, " ");
      const u = new SpeechSynthesisUtterance(clean);
      u.voice = preferred;
      u.rate = rate;
      u.pitch = 0.9;
      u.lang = preferred?.lang || "en-GB";
      u.onstart = () => { speaking = true; onstart && onstart(); };
      u.onend = () => { speaking = false; onend && onend(); };
      u.onerror = () => { speaking = false; onend && onend(); };
      speechSynthesis.speak(u);
    },
    hush() {
      speechSynthesis.cancel();
      speaking = false;
    }
  };
})();
