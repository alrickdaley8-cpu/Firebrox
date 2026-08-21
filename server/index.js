import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSettings, saveSettings, publicConfig, ensureDirs, ROOT } from './config.js';
import { runAgent } from './agent.js';
import { toolNames, TOOLS } from './tools/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

ensureDirs();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'Firebrox', time: new Date().toISOString() });
});

app.get('/api/config', (_req, res) => {
  res.json(publicConfig());
});

app.post('/api/config', (req, res) => {
  const patch = req.body || {};
  const allowed = ['provider', 'apiKey', 'model', 'baseURL', 'temperature', 'maxSteps', 'systemPrompt'];
  const clean = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }
  try {
    const cfg = saveSettings(clean);
    res.json(publicConfig());
  } catch (err) {
    res.status(400).json({ error: String(err.message || err) });
  }
});

app.get('/api/tools', (_req, res) => {
  res.json(TOOLS.map((t) => ({ name: t.name, description: t.description })));
});

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

app.post('/api/chat', async (req, res) => {
  const settings = getSettings();
  const { messages } = req.body || {};

  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'Provide a non-empty `messages` array.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 1000\n\n');

  const controller = new AbortController();
  let closed = false;
  // Note: req 'close' fires when the request body is consumed, so we watch the
  // response instead. If the response closes without being ended, the client
  // disconnected and we abort the in-flight model stream.
  res.on('close', () => {
    if (!res.writableEnded) {
      closed = true;
      controller.abort();
    }
  });

  const events = {
    text: (delta) => { if (!closed) sendEvent(res, 'text', { delta }); },
    toolStart: ({ id, name, args }) => { if (!closed) sendEvent(res, 'tool_start', { id, name, args }); },
    toolResult: ({ id, name, ok, output, ms }) => {
      if (!closed) sendEvent(res, 'tool_result', { id, name, ok, output, ms });
    },
    step: (n) => { if (!closed) sendEvent(res, 'step', { n }); },
  };

  try {
    const started = Date.now();
    const result = await runAgent({
      messages,
      settings,
      signal: controller.signal,
      events,
      maxSteps: settings.maxSteps,
    });
    if (!closed) {
      sendEvent(res, 'done', { content: result.content, ms: Date.now() - started });
      res.end();
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      if (!closed) res.end();
      return;
    }
    if (!closed) {
      sendEvent(res, 'error', { message: String(err.message || err) });
      res.end();
    }
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Firebrox running on http://0.0.0.0:${PORT}`);
  const s = getSettings();
  console.log(`   provider: ${s.provider} | model: ${s.model} | tools: ${TOOLS.length}`);
});
