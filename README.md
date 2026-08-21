# 🔥 Firebrox

A **provider-agnostic, multi-tool AI agent web app**. Firebrox runs a real
agent loop — it can search the web, fetch pages, run code, read and write
files, evaluate math, and keep long-term memory — and streams everything to a
polished chat UI, live.

Bring any model: **OpenAI, Anthropic, Google Gemini, Groq, Ollama**, or any
**OpenAI-compatible** endpoint (LM Studio, vLLM, Together, DeepSeek, …). No key?
Firebrox ships with an offline **demo brain** so it still works out of the box.

---

## ✨ Features

- **Agent loop with real tools** (streamed live over SSE):
  - 🌐 `web_search` — DuckDuckGo-backed search (no API key needed)
  - 📄 `fetch_page` — fetch & extract the text of any web page
  - 🧮 `calculator` — safe math evaluator (`+ - * / ^ %`, `sqrt`, `sin`, `log`, …)
  - 📁 `list_files` / 📖 `read_file` / ✍️ `write_file` — workspace file I/O
  - ⚡ `run_code` — execute Python, JavaScript, or bash in a sandboxed subprocess
  - 🧠 `remember` / `recall` — persistent long-term memory across chats
- **Provider-agnostic model layer** — one unified interface over 5+ providers,
  with streaming tool-calls parsed per-provider (OpenAI, Anthropic, Gemini).
- **Offline demo brain** — a deterministic fallback that routes requests to the
  real tools so the app is fully usable with zero API keys.
- **Polished UI** — dark theme, token streaming, collapsible tool-call cards
  with inputs/outputs & timing, inline settings panel, model status pill.
- **Live settings** — switch provider/model/key from the UI without restarting.
- **Chat history sidebar** — conversations are saved in your browser
  (localStorage) and listed in a sidebar; delete or switch between them.
- **Connect-a-model card** — paste an API key right on the main page.
- **iOS-ready** — install to your Home Screen (Add to Home Screen), full-screen
  standalone mode, safe-area/notch aware, no-zoom inputs, real app icons +
  PWA manifest. Also works great on Android/desktop.

## 🚀 Quickstart

```bash
npm install
npm start          # → http://localhost:3000
```

Open the app, click the **⚙ Settings** icon, choose a provider, paste your API
key (or point at your local Ollama), and start chatting.

Configuration is stored in `.firebrox/settings.json` (git-ignored). You can also
configure via environment variables — copy `.env.example` to `.env`:

```env
FIREBROX_PROVIDER=openai
FIREBROX_API_KEY=sk-...
FIREBROX_MODEL=gpt-4o-mini
```

Environment variables override the persisted settings.

## 🧠 Providers

| Provider             | Default model            | API key | Notes                                   |
| -------------------- | ------------------------ | :-----: | --------------------------------------- |
| OpenAI               | `gpt-4o-mini`            | ✓       |                                         |
| Anthropic            | `claude-3-5-haiku-latest`| ✓       |                                         |
| Google Gemini        | `gemini-2.0-flash`       | ✓       |                                         |
| Groq                 | `llama-3.3-70b-versatile`| ✓       | Fast open-weight models                 |
| Ollama (local)       | `llama3.1`               | —       | `http://localhost:11434/v1`             |
| OpenAI-compatible    | (your choice)            | optional| LM Studio / vLLM / Together / etc.       |
| Demo brain (offline) | —                        | —       | No network, no key — always works       |

## 🛠️ How the agent works

1. You send a message; the server attaches a system prompt describing the tools.
2. The model streams a response. If it chooses to call tools, Firebrox executes
   them in a loop (up to `maxSteps`), feeds results back, and repeats until the
   model produces a final answer.
3. Tool arguments/results and final text stream to the browser as SSE events
   (`text`, `tool_start`, `tool_result`, `done`, `error`).

## 🔌 API

| Method | Path           | Description                                  |
| ------ | -------------- | -------------------------------------------- |
| GET    | `/api/health`  | Health check                                 |
| GET    | `/api/config`  | Effective config (key redacted) + provider metadata |
| POST   | `/api/config`  | Update settings                              |
| GET    | `/api/tools`   | List available tools                         |
| POST   | `/api/chat`    | Run the agent; responds with an SSE stream   |

`POST /api/chat` body: `{ "messages": [{ "role": "user", "content": "…" }] }`.

## 📁 Project layout

```
server/
  index.js            Express app + SSE endpoint
  config.js           env + persisted settings
  agent.js            agent loop + system prompt
  providers/          openai.js, anthropic.js, gemini.js, demo.js
  tools/              calculator, web (search/fetch), files, run_code, memory
public/               chat UI (vanilla JS, no build step)
```

## ⚠️ Notes

- **`run_code` executes real code** in a subprocess (15s timeout, capped output)
  with the workspace as its working directory. It is intended for local use;
  don't expose Firebrox to untrusted users without additional sandboxing.
- **API keys are stored locally** in `.firebrox/settings.json`. Never commit
  that file (it's git-ignored).
- **Web search and live model calls need outbound network access.** In an
  environment with restricted egress they report a graceful error, while the
  offline tools (calculator, files, code, memory) and the demo brain keep working.

## 🧪 Try these

- `search the web for the latest AI news`
- `calculate (128 + 512) * 3 / 4`
- `run code: print the first 20 Fibonacci numbers`
- `write a file poem.txt with a haiku about fire`
- `remember my favorite color is blue` … then `recall my notes`

---

MIT License.
