/* Firebrox frontend */
(() => {
  'use strict';

  // ---------- State ----------
  const state = {
    config: null,
    history: [], // [{ role: 'user'|'assistant', content }] sent to the API
    busy: false,
    controller: null,
  };

  // ---------- DOM helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const chatEl = $('#chat');
  const messagesEl = $('#messages');
  const emptyEl = $('#emptyState');
  const inputEl = $('#input');
  const sendBtn = $('#sendBtn');
  const stopBtn = $('#stopBtn');
  const hintEl = $('#composerHint');
  const toastEl = $('#toast');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  let toastTimer;
  function toast(msg, isErr = false) {
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 3200);
  }

  function scrollToBottom() {
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  // ---------- Markdown-lite renderer (safe: escapes HTML first) ----------
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderMarkdown(src) {
    const text = String(src ?? '');
    // Split out fenced code blocks first.
    const parts = [];
    const fenceRe = /```([\w+-]*)\n?([\s\S]*?)(?:```|$)/g;
    let last = 0;
    let m;
    while ((m = fenceRe.exec(text)) !== null) {
      if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
      parts.push({ type: 'code', lang: m[1], value: m[2] });
      last = fenceRe.lastIndex;
    }
    if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });

    return parts.map((p) => {
      if (p.type === 'code') {
        const pre = el('pre');
        const code = el('code', null, p.value.replace(/\n$/, ''));
        pre.appendChild(code);
        return pre;
      }
      return renderInline(p.value);
    });
  }

  function renderInline(text) {
    let html = escapeHtml(text);

    // Inline code
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Bold / italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');

    // Lists (bulleted + numbered) on their own lines.
    const lines = html.split('\n');
    const out = [];
    let listType = null;
    let list = null;
    const closeList = () => { if (list) { out.push(list); list = null; listType = null; } };
    for (const line of lines) {
      const ul = line.match(/^\s*[-*]\s+(.*)$/);
      const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (ul || ol) {
        const type = ul ? 'ul' : 'ol';
        if (listType !== type) { closeList(); listType = type; list = el(type); }
        list.appendChild(el('li', null, '')).innerHTML = (ul ? ul[1] : ol[2]);
        continue;
      }
      closeList();
      if (line.trim() === '') { out.push(el('br')); }
      else if (line.startsWith('### ')) out.push(el('h3', null, line.slice(4)));
      else if (line.startsWith('## ')) out.push(el('h2', null, line.slice(3)));
      else if (line.startsWith('# ')) out.push(el('h1', null, line.slice(2)));
      else if (line.startsWith('&gt; ')) { const bq = el('blockquote'); bq.innerHTML = line.slice(5); out.push(bq); }
      else { const p = el('p'); p.innerHTML = line; out.push(p); }
    }
    closeList();

    const frag = document.createDocumentFragment();
    for (const node of out) {
      if (typeof node === 'string') {
        const span = el('span');
        span.innerHTML = node;
        frag.appendChild(span);
      } else frag.appendChild(node);
    }
    return frag;
  }

  // ---------- Messages ----------
  function hideEmpty() { emptyEl.classList.add('hidden'); }

  function addUserMessage(text) {
    hideEmpty();
    const msg = el('div', 'msg user');
    msg.appendChild(el('div', 'avatar', '🧑'));
    const bubble = el('div', 'bubble', text);
    msg.appendChild(bubble);
    messagesEl.appendChild(msg);
    scrollToBottom();
    return msg;
  }

  function addAssistantMessage() {
    hideEmpty();
    const msg = el('div', 'msg assistant');
    msg.appendChild(el('div', 'avatar', '🔥'));
    const body = el('div', 'msg-body');
    body.style.cssText = 'flex:1;min-width:0;';

    const toolsWrap = el('div', 'tools-wrap');
    const bubble = el('div', 'bubble');
    const typing = el('div', 'typing');
    typing.innerHTML = '<span></span><span></span><span></span>';
    bubble.appendChild(typing);
    bubble.classList.add('hidden');

    body.appendChild(toolsWrap);
    body.appendChild(bubble);
    msg.appendChild(body);
    messagesEl.appendChild(msg);
    scrollToBottom();
    return { msg, body, bubble, typing, toolsWrap, text: '' };
  }

  function createToolCard({ id, name, args }) {
    const icons = {
      web_search: '🌐', fetch_page: '📄', calculator: '🧮',
      list_files: '📁', read_file: '📖', write_file: '✍️',
      run_code: '⚡', remember: '🧠', recall: '🪄',
    };
    const card = el('div', 'tool');
    card.dataset.id = id;

    const head = el('div', 'tool-head');
    head.appendChild(el('div', 'tool-icon', icons[name] || '🛠️'));
    head.appendChild(el('div', 'tool-name', name));
    const status = el('div', 'tool-status');
    status.appendChild(el('span', 'spinner'));
    head.appendChild(status);
    head.appendChild(el('div', 'tool-caret', '▶'));

    const body = el('div', 'tool-body');
    const inputSec = el('div', 'tool-sec');
    inputSec.appendChild(el('h4', null, 'Input'));
    const inputPre = el('pre', null, JSON.stringify(args || {}, null, 2));
    inputSec.appendChild(inputPre);
    body.appendChild(inputSec);

    const outputSec = el('div', 'tool-sec');
    outputSec.appendChild(el('h4', null, 'Output'));
    const outputPre = el('pre', null, '…');
    outputSec.appendChild(outputPre);
    body.appendChild(outputSec);

    head.addEventListener('click', () => card.classList.toggle('open'));
    card.appendChild(head);
    card.appendChild(body);
    return { card, head, status, outputSec, outputPre };
  }

  function finishToolCard(card, { ok, output, ms }) {
    card.status.innerHTML = '';
    if (ok) {
      card.status.appendChild(el('span', 'ok', '✓ ' + (ms ?? '') + 'ms'));
    } else {
      card.status.appendChild(el('span', 'err', '✕ failed'));
    }
    card.outputPre.textContent = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    card.classList.add('open');
  }

  // ---------- SSE client ----------
  async function streamChat(messages, handlers) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: state.controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const rawEvent = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        dispatchEvent(rawEvent, handlers);
      }
    }
  }

  function dispatchEvent(raw, handlers) {
    let eventName = 'message';
    let data = null;
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) {
        try { data = JSON.parse(line.slice(5).trim()); } catch { data = null; }
      }
    }
    if (!data) return;
    const h = handlers[eventName];
    if (h) h(data);
  }

  // ---------- Send ----------
  async function send(text) {
    const content = text.trim();
    if (!content || state.busy) return;

    state.busy = true;
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    inputEl.value = '';
    autoResize();

    addUserMessage(content);
    state.history.push({ role: 'user', content });

    const { body, bubble, typing, toolsWrap, text: acc } = addAssistantMessage();
    const toolCards = new Map();
    let preambleDone = false;

    state.controller = new AbortController();

    const handlers = {
      text: ({ delta }) => {
        typing.remove();
        bubble.classList.remove('hidden');
        acc.text += delta;
        // re-render bubble text (simple + efficient for our sizes)
        bubble.innerHTML = '';
        renderMarkdown(acc.text).forEach((n) => bubble.appendChild(n));
        scrollToBottom();
      },
      tool_start: ({ id, name, args }) => {
        typing.remove();
        // On the first tool call, split off any text streamed so far as a
        // "thinking" preamble, then start the final-answer bubble fresh.
        if (!preambleDone) {
          preambleDone = true;
          if (acc.text.trim()) {
            const pre = el('div', 'bubble preamble');
            renderMarkdown(acc.text).forEach((n) => pre.appendChild(n));
            body.insertBefore(pre, toolsWrap);
          }
          acc.text = '';
          bubble.innerHTML = '';
          bubble.classList.add('hidden');
        }
        const card = createToolCard({ id, name, args });
        toolsWrap.appendChild(card);
        toolCards.set(id, card);
        scrollToBottom();
      },
      tool_result: ({ id, name, ok, output, ms }) => {
        const card = toolCards.get(id);
        if (card) finishToolCard(card, { ok, output, ms });
        scrollToBottom();
      },
      done: () => {
        if (!acc.text.trim()) {
          typing.remove();
          if (toolCards.size === 0) {
            bubble.classList.remove('hidden');
            bubble.appendChild(el('em', null, '(no response)'));
          } else {
            bubble.classList.add('hidden');
          }
        }
        scrollToBottom();
      },
      error: ({ message }) => {
        typing.remove();
        bubble.classList.remove('hidden');
        bubble.innerHTML = '';
        bubble.appendChild(el('strong', null, '⚠️ ' + message));
      },
    };

    try {
      await streamChat(state.history, handlers);
      state.history.push({ role: 'assistant', content: acc.text || '(no response)' });
    } catch (err) {
      if (err.name === 'AbortError') {
        if (acc.text) {
          bubble.innerHTML = '';
          renderMarkdown(acc.text + '\n\n_(stopped)_').forEach((n) => bubble.appendChild(n));
          state.history.push({ role: 'assistant', content: acc.text });
        } else {
          typing.remove();
          bubble.classList.remove('hidden');
          bubble.appendChild(el('em', null, '_(stopped)_'));
        }
      } else {
        typing.remove();
        bubble.classList.remove('hidden');
        bubble.innerHTML = '';
        bubble.appendChild(el('strong', null, '⚠️ ' + err.message));
        toast(err.message, true);
      }
    } finally {
      state.busy = false;
      state.controller = null;
      sendBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
      inputEl.focus();
    }
  }

  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
  }

  // ---------- Settings ----------
  const providerSelect = $('#providerSelect');
  const modelInput = $('#model');
  const modelList = $('#modelList');
  const apiKeyInput = $('#apiKey');
  const baseURLInput = $('#baseURL');
  const temperatureInput = $('#temperature');
  const tempVal = $('#tempVal');
  const maxStepsInput = $('#maxSteps');
  const systemPromptInput = $('#systemPrompt');
  const keyStatus = $('#keyStatus');

  function populateProviders(providers) {
    providerSelect.innerHTML = '';
    for (const [key, meta] of Object.entries(providers)) {
      const opt = el('option', null, meta.label);
      opt.value = key;
      providerSelect.appendChild(opt);
    }
  }

  function syncModelSuggestions() {
    const meta = state.config?.providers?.[providerSelect.value];
    modelList.innerHTML = '';
    if (meta?.models) {
      for (const m of meta.models) {
        const opt = el('option');
        opt.value = m;
        modelList.appendChild(opt);
      }
    }
    modelInput.placeholder = meta?.defaultModel ? `e.g. ${meta.defaultModel}` : 'model name';
    apiKeyInput.disabled = !meta?.needsKey;
  }

  function loadConfigIntoForm() {
    const c = state.config;
    providerSelect.value = c.provider;
    modelInput.value = c.model || '';
    baseURLInput.value = c.baseURL || '';
    temperatureInput.value = c.temperature ?? 0.7;
    tempVal.textContent = temperatureInput.value;
    maxStepsInput.value = c.maxSteps ?? 8;
    systemPromptInput.value = c.systemPrompt || '';
    apiKeyInput.value = '';
    keyStatus.textContent = c.hasKey ? '(saved ✓)' : '(not set)';
    syncModelSuggestions();
    updatePill();
  }

  function updatePill() {
    const c = state.config;
    if (!c) return;
    const label = c.providers?.[c.provider]?.label || c.provider;
    $('#modelLabel').textContent = `${label} · ${c.model || 'default'}`;
    const dot = $('#modelDot');
    const needsKey = c.providers?.[c.provider]?.needsKey;
    dot.className = 'dot' + (needsKey && !c.hasKey ? ' warn' : '');
    hintEl.textContent = (needsKey && !c.hasKey)
      ? `No API key set for ${label} — set one in Settings, or switch to the Demo brain.`
      : `Running on ${label}${c.model ? ' · ' + c.model : ''}.`;
  }

  async function loadConfig() {
    const res = await fetch('/api/config');
    state.config = await res.json();
    populateProviders(state.config.providers);
    loadConfigIntoForm();
  }

  async function saveConfig() {
    const patch = {
      provider: providerSelect.value,
      model: modelInput.value.trim(),
      baseURL: baseURLInput.value.trim(),
      temperature: Number(temperatureInput.value),
      maxSteps: Number(maxStepsInput.value),
      systemPrompt: systemPromptInput.value.trim(),
    };
    if (apiKeyInput.value.trim()) patch.apiKey = apiKeyInput.value.trim();

    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save');
    state.config = data;
    loadConfigIntoForm();
    apiKeyInput.value = '';
    $('#saveStatus').textContent = 'Saved ✓';
    toast('Settings saved.');
    setTimeout(() => { $('#saveStatus').textContent = ''; }, 2500);
  }

  // ---------- Wire up ----------
  sendBtn.addEventListener('click', () => send(inputEl.value));
  inputEl.addEventListener('input', autoResize);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(inputEl.value);
    }
  });
  stopBtn.addEventListener('click', () => state.controller?.abort());

  $('#newChatBtn').addEventListener('click', () => {
    if (state.busy) return;
    state.history = [];
    messagesEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    inputEl.focus();
  });

  $('#modelPill').addEventListener('click', () => $('#settingsOverlay').classList.remove('hidden'));
  $('#settingsBtn').addEventListener('click', () => $('#settingsOverlay').classList.remove('hidden'));
  $('#closeSettings').addEventListener('click', () => $('#settingsOverlay').classList.add('hidden'));
  $('#settingsOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) $('#settingsOverlay').classList.add('hidden');
  });

  providerSelect.addEventListener('change', syncModelSuggestions);
  temperatureInput.addEventListener('input', () => { tempVal.textContent = temperatureInput.value; });

  $('#saveSettings').addEventListener('click', async () => {
    try { await saveConfig(); }
    catch (err) { toast(err.message, true); }
  });

  $('#chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) send(chip.textContent);
  });

  // ---------- Boot ----------
  loadConfig().catch((err) => toast('Could not load config: ' + err.message, true));
  inputEl.focus();
})();
