const Intel = (() => {
  const WX = {
    0: "clear skies", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "rime fog", 51: "light drizzle", 53: "drizzle",
    61: "rain", 63: "moderate rain", 65: "heavy rain", 71: "snow",
    80: "rain showers", 85: "snow showers", 95: "thunderstorms"
  };

  async function geo() {
    try {
      const pos = await new Promise((res, rej) => {
        if (!navigator.geolocation) return rej(new Error("no geo"));
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 7000 });
      });
      return { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "YOUR POSITION" };
    } catch {
      return { lat: 29.2858, lon: -81.0559, label: "ORMOND BEACH" };
    }
  }

  return {
    WX,
    geo,
    async weather(coords) {
      const c = coords || await geo();
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature`;
      const data = await fetch(url).then((r) => r.json());
      const cur = data.current;
      return {
        ...c,
        temp: cur.temperature_2m,
        feel: cur.apparent_temperature,
        wind: cur.wind_speed_10m,
        hum: cur.relative_humidity_2m,
        code: cur.weather_code,
        desc: WX[cur.weather_code] || "mixed conditions"
      };
    },
    async wiki(q) {
      const search = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=1&namespace=0&format=json&origin=*`;
      const [, titles] = await fetch(search).then((r) => r.json());
      if (!titles?.[0]) return null;
      const sum = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titles[0])}`;
      const page = await fetch(sum).then((r) => r.json());
      return {
        title: page.title,
        extract: page.extract || "",
        url: page.content_urls?.desktop?.page || ""
      };
    },
    async news() {
      const d = new Date();
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${y}/${m}/${day}`;
      const data = await fetch(url).then((r) => r.json());
      const items = [];
      if (data.tfa?.displaytitle) {
        items.push({
          kicker: "FEATURED",
          title: data.tfa.titles?.normalized || "Featured article",
          text: (data.tfa.extract || "").slice(0, 280)
        });
      }
      (data.mostread?.articles || []).slice(0, 4).forEach((a) => {
        items.push({
          kicker: "TRENDING",
          title: a.normalizedtitle || a.title,
          text: (a.extract || "").slice(0, 180)
        });
      });
      (data.news || []).slice(0, 3).forEach((n) => {
        items.push({
          kicker: "WIRE",
          title: n.story ? n.story.replace(/<[^>]+>/g, "").slice(0, 90) : "Dispatch",
          text: (n.links?.[0]?.extract || "").slice(0, 200)
        });
      });
      return items.slice(0, 7);
    },
    async define(word) {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      const data = await fetch(url).then((r) => r.json());
      const e = data[0];
      if (!e) return null;
      const m = e.meanings?.[0];
      return {
        word: e.word,
        phonetic: e.phonetic || e.phonetics?.find((p) => p.text)?.text || "",
        pos: m?.partOfSpeech || "",
        def: m?.definitions?.[0]?.definition || "",
        ex: m?.definitions?.[0]?.example || ""
      };
    },
    async translate(text, to = "es") {
      const map = { spanish: "es", french: "fr", german: "de", italian: "it", portuguese: "pt", japanese: "ja", chinese: "zh", arabic: "ar", hindi: "hi", russian: "ru" };
      const lang = map[to.toLowerCase()] || to.toLowerCase().slice(0, 2);
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`;
      const data = await fetch(url).then((r) => r.json());
      return data.responseData?.translatedText || null;
    },
    async fx(amount, from, to) {
      const url = `https://api.frankfurter.app/latest?amount=${amount}&from=${from.toUpperCase()}&to=${to.toUpperCase()}`;
      const data = await fetch(url).then((r) => r.json());
      const val = data.rates?.[to.toUpperCase()];
      return val == null ? null : { amount, from: from.toUpperCase(), to: to.toUpperCase(), value: val };
    }
  };
})();
