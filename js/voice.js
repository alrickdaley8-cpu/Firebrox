const Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let speaking = false;
  let preferred = null;

  function pickVoice() {
    const voices = speechSynthesis.getVoices();
    const rank = (v) => {
      const n = `${v.name} ${v.lang}`.toLowerCase();
      let s = 0;
      if (/en-gb|en_gb|uk/.test(n)) s += 6;
      if (/daniel|google uk|male|arthur|rishi|oliver/.test(n)) s += 4;
      if (/en-us|en_us/.test(n)) s += 2;
      if (v.localService) s += 1;
      return s;
    };
    preferred = voices.slice().sort((a, b) => rank(b) - rank(a))[0] || null;
  }

  return {
    ready: !!SR,
    speaking() { return speaking; },
    init() {
      pickVoice();
      speechSynthesis.onvoiceschanged = pickVoice;
      if (!SR) return;
      rec = new SR();
      rec.lang = "en-GB";
      rec.interimResults = true;
      rec.continuous = false;
    },
    listen({ onPartial, onFinal, onEnd, onError }) {
      if (!rec) {
        onError && onError("Voice capture is unavailable in this browser. Type a directive instead.");
        return false;
      }
      try {
        rec.onresult = (e) => {
          let text = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            text += e.results[i][0].transcript;
            if (e.results[i].isFinal) onFinal && onFinal(text.trim());
            else onPartial && onPartial(text.trim());
          }
        };
        rec.onerror = (e) => onError && onError(e.error);
        rec.onend = () => onEnd && onEnd();
        rec.start();
        return true;
      } catch (err) {
        onError && onError(err.message);
        return false;
      }
    },
    stopListen() {
      try { rec && rec.abort(); } catch (_) { /* ignore */ }
    },
    speak(text, { onstart, onend } = {}) {
      if (!window.speechSynthesis) {
        onend && onend();
        return;
      }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = preferred;
      u.rate = 1.02;
      u.pitch = 0.92;
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
