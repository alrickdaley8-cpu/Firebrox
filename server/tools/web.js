/** Web search + page fetch, no API key required (DuckDuckGo). */

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function webSearch(query) {
  const q = String(query).trim();
  if (!q) throw new Error('Empty search query');

  const results = [];
  const seen = new Set();

  // 1) DuckDuckGo Instant Answer (facts, definitions, disambiguation).
  let instant = null;
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Firebrox/0.1' } });
    if (res.ok) {
      const j = await res.json();
      if (j.AbstractText) instant = { title: j.Heading || j.AbstractSource || q, url: j.AbstractURL, snippet: j.AbstractText };
      if (j.Answer) instant = { title: q, url: j.AbstractURL || '', snippet: String(j.Answer) };
      for (const rt of j.RelatedTopics || []) {
        if (rt.Text && rt.FirstURL) {
          const s = rt.Text.replace(/<[^>]+>/g, '');
          if (s && !seen.has(rt.FirstURL)) {
            seen.add(rt.FirstURL);
            results.push({ title: (rt.Text.match(/^([^<]+)/) || [rt.Text.slice(0, 60)])[0], url: rt.FirstURL, snippet: s });
          }
        }
      }
    }
  } catch { /* ignore */ }

  // 2) DuckDuckGo Lite HTML results for a broader list of links.
  try {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Firebrox/0.1)' } });
    if (res.ok) {
      const html = await res.text();
      const linkRe = /<a[^>]+href="([^"]+)"[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>/g;
      const snippetRe = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
      const links = [...html.matchAll(linkRe)];
      const snippets = [...html.matchAll(snippetRe)];
      links.forEach((m, idx) => {
        let href = m[1];
        // DDG wraps real URLs in a redirect query param.
        const uddg = href.match(/uddg=([^&]+)/);
        if (uddg) href = decodeURIComponent(uddg[1]);
        const title = htmlToText(m[2]).slice(0, 120);
        const snippet = snippets[idx] ? htmlToText(snippets[idx][1]).slice(0, 300) : '';
        if (href && !seen.has(href) && href.startsWith('http')) {
          seen.add(href);
          results.push({ title, url: href, snippet });
        }
      });
    }
  } catch { /* ignore */ }

  if (instant && !seen.has(instant.url || instant.title)) results.unshift(instant);

  if (!results.length) {
    return { query: q, results: [], note: 'No results found. The search backend may be unreachable from this environment.' };
  }
  return { query: q, results: results.slice(0, 8) };
}

export async function fetchPage(url) {
  const target = String(url).trim();
  if (!/^https?:\/\//i.test(target)) throw new Error('URL must start with http:// or https://');
  const res = await fetch(target, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Firebrox/0.1)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${target}`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new Error(`Unsupported content type "${contentType}" — only HTML/plain text is fetched.`);
  }
  const html = await res.text();
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || target;
  const text = htmlToText(html);
  const truncated = text.length > 12000 ? text.slice(0, 12000) + '\n…[truncated]' : text;
  return { url: target, title: htmlToText(title), length: text.length, text: truncated };
}
